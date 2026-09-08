import type { CellarLabel, CellarPackImportResult, ImportedCellarLabel } from '../cellarpack/types'
import { parseContribution, parseSource, SOURCE_KEY } from '../contributions'
import { checkAvery94502Compatibility } from '../sheets'
import { findExactTobacco, resolveTobaccoId } from '../tobacco-catalog'
import { finish, identityForDesign, newRow } from './commands'
import { sha256 } from './validation'
import { CollectionError, type Collection, type CollectionDesign, type CollectionRow, type ImportCandidate, type ImportDecisions, type ImportPlan, type PrepareImportOptions } from './types'

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en-US').trim().replace(/\s+/g, ' ')
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (record(value)) return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}
function projectLabel(label: CellarLabel): CellarLabel {
  const { id, maker, blend, displayName, artworkAssetId, surface, writeInAreas, research } = label
  const catalog = findExactTobacco(maker, blend)
  const sources = label.extensions?.[SOURCE_KEY]
  const checked = catalog && Array.isArray(sources) ? sources.flatMap(source => {
    const valid = record(source) ? parseSource({ ...source, catalogId: catalog.id }) : null
    return valid ? [valid] : []
  }).slice(0, 10) : []
  return JSON.parse(JSON.stringify({ id, maker, blend, ...(displayName ? { displayName } : {}), artworkAssetId, surface, writeInAreas, research, ...(checked.length ? { extensions: { [SOURCE_KEY]: checked } } : {}) })) as CellarLabel
}

/** IDs and paths belong to their source archive; they are not artwork identity. */
export async function designFingerprint(item: ImportedCellarLabel): Promise<string> {
  const label = projectLabel(item.label)
  const { id: _id, artworkAssetId: _assetId, ...semanticLabel } = label
  const { path: _path, ...asset } = item.artwork.asset
  return sha256(stable({ label: semanticLabel, asset }))
}

export async function prepareImport(result: CellarPackImportResult, options: PrepareImportOptions): Promise<ImportCandidate> {
  // A repair can add missing files without changing the manifest. Local reports
  // distinguish the actual accepted artwork and validation outcome; the separate
  // contribution keeps its original manifest-derived submission identity.
  const receiptId = options.receiptId ?? await sha256(stable({
    manifest: result.manifest,
    status: result.status,
    accepted: result.labels.map(item => ({ id: item.id, sha256: item.artwork.asset.sha256 })),
    quarantined: result.quarantinedLabels.map(item => ({ id: item.id, issues: item.issues })),
    issues: result.issues,
  }))
  const contribution = options.contribution ? parseContribution(options.contribution) : null
  if (options.contribution && !contribution) throw new CollectionError('invalid', 'The diagnostic receipt was not valid. The current labels have not changed.')
  const candidate: ImportCandidate = {
    receipt: { id: receiptId, title: (result.manifest?.title ?? 'Imported labels').slice(0, 300), createdAt: new Date().toISOString(), protocolContext: options.protocolContext ?? { status: 'legacy' }, repairPrompt: options.repairPrompt ?? '', issues: result.issues.map(issue => ({ ...issue })), quarantined: result.quarantinedLabels.map(item => ({ id: item.id, reason: item.issues.map(issue => [issue.message, issue.recovery].filter(Boolean).join(' ')).join(' ') })), contribution, delivery: contribution ? 'pending' : 'none' },
    designs: [],
  }
  candidate.receipt.origin = options.origin
  for (const original of result.labels) {
    if (!checkAvery94502Compatibility(original.label.surface).compatible) throw new CollectionError('invalid', 'This artwork must be a compatible 2.5-inch circle before it can be added.')
    if (await sha256(original.artwork.data) !== original.artwork.asset.sha256) throw new CollectionError('invalid', 'The artwork does not match the verified ZIP. Import the original ZIP again.')
    const item: ImportedCellarLabel = { id: original.id, label: projectLabel(original.label), artwork: { ...original.artwork, asset: { ...original.artwork.asset } }, issues: original.issues.map(issue => ({ ...issue })) }
    const fingerprint = await designFingerprint(item)
    if (candidate.designs.some(design => design.fingerprint === fingerprint)) continue
    candidate.designs.push({ id: fingerprint, fingerprint, item, origin: options.origin, ...(options.publicationId ? { publicationId: options.publicationId } : {}), receiptId })
  }
  // This comes only from the website's validated publication download operation,
  // never from claims in a manifest. Keep hashes after selected bytes are removed.
  if (options.origin === 'gallery') candidate.receipt.knownGalleryHashes = [...new Set(candidate.designs.map(design => design.item.artwork.asset.sha256))]
  return candidate
}

function editionFor(design: CollectionDesign): string {
  const edition = design.item.label.research.observedPackage.variantDateOrEdition.trim()
  return /^(unknown|not recorded|not recorded in the shared label)$/i.test(edition) ? '' : edition
}
function matches(row: CollectionRow, design: CollectionDesign): boolean {
  const label = design.item.label
  const catalog = findExactTobacco(label.maker, label.blend)
  const canonical = row.catalogId ? resolveTobaccoId(row.catalogId) : undefined
  const identity = canonical ? canonical.id === catalog?.id : normalize(row.maker) === normalize(label.maker) && normalize(row.blend) === normalize(label.blend) || !row.maker && normalize(row.blend) === normalize(`${label.maker} — ${label.blend}`)
  return identity && (!row.edition || normalize(row.edition) === normalize(editionFor(design)))
}

export function planImport(collection: Collection, candidate: ImportCandidate): ImportPlan {
  return { baseRevision: collection.revision, collectionId: collection.id, candidate, entries: candidate.designs.map(design => {
    const all = collection.rows.filter(row => matches(row, design))
    const frozenMatches = all.filter(row => collection.handoff?.targets.some(target => target.rowId === row.id && target.revision === row.revision))
    const rows = frozenMatches.length ? frozenMatches : all
    const single = rows.length === 1 ? rows[0] : null
    const stale = single && collection.handoff?.targets.some(target => target.rowId === single.id && target.revision !== single.revision)
    // A retained previous design is available for reuse, but it is not selected.
    // Reimporting it must still be able to complete an unfinished request.
    if (Object.values(collection.designs).some(existing => existing.fingerprint === design.fingerprint)) {
      if (single && !single.designId && !stale) return { designId: design.id, sourceLabelId: design.item.id, matchRowIds: [single.id], kind: 'fill' }
      if (rows.some(row => !row.designId)) return { designId: design.id, sourceLabelId: design.item.id, matchRowIds: rows.map(row => row.id), kind: 'choice' }
      return { designId: design.id, sourceLabelId: design.item.id, matchRowIds: collection.rows.filter(row => row.designId === design.id).map(row => row.id), kind: 'duplicate' }
    }
    return { designId: design.id, sourceLabelId: design.item.id, matchRowIds: rows.map(row => row.id), kind: single && !single.designId && !stale ? 'fill' : rows.length ? 'choice' : 'add' }
  }) }
}

export function applyImport(collection: Collection, plan: ImportPlan, decisions: ImportDecisions = {}): Collection {
  if (collection.revision !== plan.baseRevision || collection.id !== plan.collectionId) throw new CollectionError('conflict', 'Your labels changed while this ZIP was being reviewed. Review its additions again.')
  const rows = [...collection.rows], designs = { ...collection.designs }
  const replaced = new Set<string>()
  for (const entry of plan.entries) {
    const incoming = plan.candidate.designs.find(design => design.id === entry.designId)
    if (!incoming) throw new CollectionError('invalid', 'The import review is incomplete. Choose the ZIP again.')
    const decision = decisions[entry.designId] ?? (entry.kind === 'fill' ? { action: 'replace', rowId: entry.matchRowIds[0] } : entry.kind === 'add' ? { action: 'add' } : { action: 'skip' })
    if (decision.action === 'skip') continue
    // An identical design may still explicitly fill another requested row, but
    // importing it again never creates another row or increments its quantity.
    if (entry.kind === 'duplicate' && decision.action === 'add') continue
    const design = designs[incoming.id] ?? incoming
    if (decision.action === 'replace') {
      const index = rows.findIndex(row => row.id === decision.rowId)
      if (index < 0 || replaced.has(rows[index].id)) throw new CollectionError('conflict', 'Choose a different requested label for each returned design.')
      replaced.add(rows[index].id)
      rows[index] = { ...rows[index], designId: design.id, createRequested: false, revision: rows[index].revision + 1 }
      delete rows[index].previousDesignId
    } else if (decision.action === 'add') {
      const row = newRow({ ...identityForDesign(design.item.label.maker, design.item.label.blend), edition: editionFor(design) })
      rows.push({ ...row, designId: design.id })
    } else throw new CollectionError('invalid', 'Choose how to add each returned label.')
    designs[design.id] = design
  }
  const existingReceipt = collection.receipts.find(receipt => receipt.id === plan.candidate.receipt.id)
  const originalSubmission = plan.candidate.receipt.contribution && collection.receipts.find(receipt => receipt.contribution?.submissionId === plan.candidate.receipt.contribution!.submissionId)
  const incomingReceipt = originalSubmission ? { ...plan.candidate.receipt, contribution: originalSubmission.contribution, delivery: originalSubmission.delivery } : plan.candidate.receipt
  const observedHashes = plan.candidate.receipt.knownGalleryHashes
  const receipts: Collection['receipts'] = existingReceipt
    ? collection.receipts.map(receipt => receipt.id === existingReceipt.id ? {
      ...receipt,
      origin: receipt.origin === 'local' || incomingReceipt.origin === 'local' || receipt.contribution !== null || Object.values(collection.designs).some(design => design.receiptId === receipt.id && design.origin === 'local') ? 'local' : receipt.origin ?? incomingReceipt.origin,
      ...(observedHashes?.length ? { knownGalleryHashes: [...new Set([...(receipt.knownGalleryHashes ?? []), ...observedHashes])] } : {}),
    } : receipt)
    : [...collection.receipts, incomingReceipt]
  return finish({ ...collection, rows, designs, receipts })
}
