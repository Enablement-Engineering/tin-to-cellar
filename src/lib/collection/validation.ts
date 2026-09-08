import { validateManifest } from '../cellarpack/schema'
import type { CellarPackManifest } from '../cellarpack/types'
import { checkAvery94502Compatibility } from '../sheets'
import { parseContribution, SOURCE_KEY } from '../contributions'
import { parseImageMetadata } from '../cellarpack/image'
import { COLLECTION_LIMITS, CollectionError, type Collection, type CollectionDesign } from './types'

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const string = (value: unknown, max: number, empty = false): value is string => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0)
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const bufferByteLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!
function encodedBuffer(value: unknown): value is ArrayBuffer {
  try { return bufferByteLength.call(value) > 0 } catch { return false }
}
function invalid(): never { throw new CollectionError('invalid', 'The saved labels could not be read safely. Keep your downloaded ZIPs and retry without replacing this saved work.') }
function capacity(message: string): never { throw new CollectionError('capacity', message) }

/** Older saved rows kept replacement-request artwork active. Retain it only for restore. */
export function readCollection(value: unknown): Collection {
  const migrated = record(value) && value.version === 1 && Array.isArray(value.rows)
    ? { ...value, rows: value.rows.map(row => record(row) && row.createRequested === true && typeof row.designId === 'string' && row.previousDesignId === undefined
      ? { ...row, previousDesignId: row.designId, designId: null }
      : row) }
    : value
  assertCollection(migrated)
  return migrated
}

export function manifestForDesign(design: CollectionDesign): CellarPackManifest {
  return { format: 'tin-to-cellar/cellarpack', schemaVersion: '0.1.0', packId: 'urn:uuid:43649b43-8094-4a32-b5ee-8be75208fb63', createdAt: '2026-09-07T00:00:00Z', generator: { name: 'Tin to Cellar', version: '1.0.0' }, labels: [design.item.label], assets: { [design.item.label.artworkAssetId]: design.item.artwork.asset } }
}

/** Checks saved metadata and resource limits; no network, decoding, or writes. */
export function assertCollection(value: unknown): asserts value is Collection {
  if (!record(value) || value.version !== 1 || !string(value.id, 100) || !integer(value.revision) || !Array.isArray(value.rows) || !record(value.designs) || !Array.isArray(value.receipts) || !record(value.printSettings)) invalid()
  if (Object.keys(value).some(key => !['version', 'id', 'revision', 'rows', 'designs', 'receipts', 'handoff', 'printSettings'].includes(key))) invalid()
  if (value.rows.length > COLLECTION_LIMITS.rows || Object.keys(value.designs).length > COLLECTION_LIMITS.designs) capacity('Your labels can contain up to 100 requested labels and 100 designs. Remove a few or add fewer from this ZIP.')
  const rowIds = new Set<string>(), selected = new Set<string>()
  let copies = 0
  for (const row of value.rows) {
    if (!record(row) || !string(row.id, 100) || rowIds.has(row.id) || !integer(row.revision) || !(row.catalogId === null || string(row.catalogId, 200)) || !string(row.maker, 200, true) || !string(row.blend, 200) || !string(row.edition, 300, true) || !string(row.notes, 3000, true) || !integer(row.quantity, 0, 99) || typeof row.createRequested !== 'boolean' || !(row.designId === null || string(row.designId, 100))) invalid()
    rowIds.add(row.id)
    if (row.previousDesignId !== undefined) {
      if (!string(row.previousDesignId, 100) || !row.createRequested || row.designId !== null || !Object.hasOwn(value.designs, row.previousDesignId)) invalid()
      selected.add(row.previousDesignId)
    }
    if (row.createRequested && row.designId !== null) invalid()
    if (row.designId) { if (!Object.hasOwn(value.designs, row.designId)) invalid(); selected.add(row.designId); copies += row.quantity }
  }
  if (copies > 450) capacity('One print job can contain up to 450 labels. Reduce quantities before adding more.')
  const settings = value.printSettings
  if (!integer(settings.page, 0, 100) || !integer(settings.firstSlot, 1, 9) || !record(settings.offset)) invalid()
  const offset = settings.offset
  if (!['x', 'y'].every(axis => typeof offset[axis] === 'number' && Number.isFinite(offset[axis]) && Math.abs(offset[axis]) <= .25)) invalid()
  let bytes = 0, pixels = 0
  const artwork = new Set<string>()
  for (const [id, entry] of Object.entries(value.designs)) {
    if (!record(entry) || entry.id !== id || !selected.has(id) || !hex(entry.fingerprint) || !['local', 'gallery', 'example'].includes(String(entry.origin)) || !string(entry.receiptId, 100) || !(entry.publicationId === undefined || string(entry.publicationId, 100)) || !record(entry.item) || !record(entry.item.artwork) || !record(entry.item.artwork.asset) || !record(entry.item.label) || !Array.isArray(entry.item.issues)) invalid()
    const design = entry as CollectionDesign
    const image = design.item.artwork
    if (!encodedBuffer(image.data) || !hex(image.asset.sha256) || !integer(image.pixelWidth, 1, COLLECTION_LIMITS.perImageSide) || !integer(image.pixelHeight, 1, COLLECTION_LIMITS.perImageSide) || image.pixelWidth * image.pixelHeight > COLLECTION_LIMITS.perImagePixels || image.mediaType !== image.asset.mediaType || image.pixelWidth !== image.asset.pixelWidth || image.pixelHeight !== image.asset.pixelHeight || !validateManifest(manifestForDesign(design)).valid || !checkAvery94502Compatibility(design.item.label.surface).compatible) invalid()
    if (Object.keys(design.item.label.extensions ?? {}).some(key => key !== SOURCE_KEY)) invalid()
    if (!artwork.has(image.asset.sha256)) { artwork.add(image.asset.sha256); bytes += image.data.byteLength; pixels += image.pixelWidth * image.pixelHeight }
  }
  if (bytes > COLLECTION_LIMITS.artworkBytes) capacity('These labels exceed the 45 MiB artwork storage limit. Add fewer designs or remove an existing label.')
  if (pixels > COLLECTION_LIMITS.pixels) capacity('These labels exceed the image-size budget. Add fewer designs or use smaller artwork.')
  const receiptIds = new Set<string>()
  for (const receipt of value.receipts) {
    if (!record(receipt) || !string(receipt.id, 100) || receiptIds.has(receipt.id) || !string(receipt.title, 300) || !string(receipt.createdAt, 100) || !Number.isFinite(Date.parse(receipt.createdAt)) || !string(receipt.repairPrompt, 200_000, true) || !record(receipt.protocolContext) || !['known', 'unknown', 'legacy', 'invalid', 'conflict'].includes(String(receipt.protocolContext.status)) || !Array.isArray(receipt.issues) || !Array.isArray(receipt.quarantined) || !['none', 'pending', 'sent', 'failed'].includes(String(receipt.delivery)) || !(receipt.contribution === null || parseContribution(receipt.contribution))) invalid()
    if (Object.keys(receipt).some(key => !['id', 'title', 'createdAt', 'protocolContext', 'repairPrompt', 'issues', 'quarantined', 'contribution', 'delivery', 'knownGalleryHashes', 'origin'].includes(key))) invalid()
    if (receipt.origin !== undefined && !['local', 'gallery', 'example'].includes(String(receipt.origin))) invalid()
    if (receipt.knownGalleryHashes !== undefined && (!Array.isArray(receipt.knownGalleryHashes) || receipt.knownGalleryHashes.length > 100 || receipt.knownGalleryHashes.some(hash => !hex(hash)) || new Set(receipt.knownGalleryHashes).size !== receipt.knownGalleryHashes.length)) invalid()
    if (!(receipt.protocolContext.revision === undefined || string(receipt.protocolContext.revision, 100) || integer(receipt.protocolContext.revision, 1)) || Object.keys(receipt.protocolContext).some(key => !['status', 'revision'].includes(key))) invalid()
    for (const issue of receipt.issues) if (!record(issue) || !['fatal', 'error', 'warning', 'info'].includes(String(issue.severity)) || !string(issue.code, 100) || !string(issue.message, 6000) || !(issue.recovery === undefined || string(issue.recovery, 6000, true)) || !(issue.labelId === undefined || string(issue.labelId, 200, true))) invalid()
    for (const issue of receipt.quarantined) if (!record(issue) || !string(issue.id, 200) || !string(issue.reason, 20_000, true)) invalid()
    receiptIds.add(receipt.id)
  }
  for (const entry of Object.values(value.designs)) if (!receiptIds.has((entry as CollectionDesign).receiptId)) invalid()
  if (value.handoff !== null) {
    const handoff = value.handoff
    if (!record(handoff) || !string(handoff.id, 100) || !string(handoff.createdAt, 100) || !Number.isFinite(Date.parse(handoff.createdAt)) || !Array.isArray(handoff.targets) || handoff.targets.length > 100 || !string(handoff.prompt, 500_000) || !string(handoff.request, 500_000) || !(string(handoff.protocolRevision, 100) || integer(handoff.protocolRevision, 1)) || typeof handoff.copied !== 'boolean') invalid()
    for (const target of handoff.targets) if (!record(target) || !string(target.rowId, 100) || !integer(target.revision) || !(target.catalogId === null || string(target.catalogId, 200)) || !string(target.maker, 200, true) || !string(target.blend, 200) || !string(target.edition, 300, true) || !string(target.notes, 3000, true)) invalid()
  }
  // ArrayBuffers stringify as {}, excluding encoded artwork from the metadata budget.
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > COLLECTION_LIMITS.metadataBytes) capacity('The saved label details exceed the storage limit. Keep the original ZIPs and remove earlier work before adding more.')
}

export async function sha256(data: ArrayBuffer | string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : data)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyCollectionArtwork(collection: Collection): Promise<void> {
  const checked = new Map<string, ArrayBuffer>()
  for (const design of Object.values(collection.designs)) {
    const { asset, data } = design.item.artwork
    if (checked.get(asset.sha256) === data) continue
    if (await sha256(data) !== asset.sha256) throw new CollectionError('invalid', 'Saved artwork does not match its verified image. Re-import its original ZIP; existing saved work has not been replaced.')
    const metadata = parseImageMetadata(data)
    if (!metadata || metadata.width !== asset.pixelWidth || metadata.height !== asset.pixelHeight || metadata.mediaType !== asset.mediaType) throw new CollectionError('invalid', 'Saved image details do not match the artwork. Re-import the original ZIP without clearing your other labels.')
    checked.set(asset.sha256, data)
  }
}
