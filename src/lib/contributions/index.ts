import { TOBACCO_CATALOG, findExactTobacco, resolveTobaccoId } from '../tobacco-catalog'
import { validateHistorical } from '../feedback/validators.generated.js'
import { parseDiagnosticReport } from '../feedback/validation'
import type { DiagnosticReport } from '../feedback'
import type { CellarPackManifest } from '../cellarpack/types'
import { parseWebsiteValidation, type WebsiteValidation } from './validation'

export const SOURCE_KEY = 'tin-to-cellar:sources'
export const SOURCE_STATUSES = ['valid', 'unavailable', 'wrong-package', 'unverified'] as const
export type SourceObservation = { catalogId: string; url: string; status: typeof SOURCE_STATUSES[number]; package: 'tin' | 'pouch' | 'box' | 'other' | 'unknown'; variant: 'current' | 'historical' | 'unknown' }
export type Contribution = { version: 1 | 2; submissionId: string; feedback: DiagnosticReport | null; sources: SourceObservation[]; origin?: 'pack' | 'standalone'; validation?: WebsiteValidation | null }
export type SuggestedSource = SourceObservation & { checkedAt: string }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const normalize = (v: string) => v.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
export function catalogMatch(maker: string, blend: string) {
  return findExactTobacco(maker, blend) ?? TOBACCO_CATALOG.find(item => normalize(item.maker) === normalize(maker) && normalize(item.blend) === normalize(blend))
}
export function collectionFeedback(value: unknown): DiagnosticReport | null {
  return parseDiagnosticReport(value)
}
// Read-only migration support for the previously published numeric protocol format.
export function storedFeedback(value: unknown): unknown | null {
  return collectionFeedback(value) ?? (validateHistorical(value) ? JSON.parse(JSON.stringify(value)) : null)
}
export function publicSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1500) return false
  try {
    const url = new URL(value)
    // Collect public, durable links only. Never send signed URLs, credentials, fragments, or query data.
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search && !url.hash &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(url.hostname) &&
      !/(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(url.hostname) && !/%40|@/i.test(url.pathname)
  } catch { return false }
}
export function parseSource(value: unknown): SourceObservation | null {
  if (!record(value) || !exact(value, ['catalogId', 'url', 'status', 'package', 'variant'])) return null
  if (typeof value.catalogId !== 'string' || !resolveTobaccoId(value.catalogId) || !publicSourceUrl(value.url) ||
    !SOURCE_STATUSES.includes(value.status as SourceObservation['status']) ||
    typeof value.package !== 'string' || !['tin', 'pouch', 'box', 'other', 'unknown'].includes(value.package) ||
    typeof value.variant !== 'string' || !['current', 'historical', 'unknown'].includes(value.variant)) return null
  return { catalogId: resolveTobaccoId(value.catalogId as string)!.id, url: value.url, status: value.status, package: value.package, variant: value.variant } as SourceObservation
}
// Local source parsing also defines saved artwork fingerprints. Keep sharing
// policy separate so catalog changes cannot invalidate a saved collection.
export function knownCatalogSourceUrl(catalogId: string, value: unknown): value is string {
  return publicSourceUrl(value) && resolveTobaccoId(catalogId)?.sourceUrl === value
}
export function parseSharedSource(value: unknown): SourceObservation | null {
  const source = parseSource(value)
  return source && knownCatalogSourceUrl(source.catalogId, source.url) ? source : null
}
export function parseContribution(value: unknown): Contribution | null {
  if (!record(value) || ![1, 2].includes(Number(value.version)) || !exact(value, value.version === 1 ? ['version', 'submissionId', 'feedback', 'sources'] : ['version', 'submissionId', 'feedback', 'sources', 'origin', 'validation']) || typeof value.submissionId !== 'string' || !/^[a-f0-9]{64}$/.test(value.submissionId) || !Array.isArray(value.sources) || value.sources.length > 100) return null
  if (value.version !== 1 && value.version !== 2) return null
  const feedback = value.feedback === null ? null : collectionFeedback(value.feedback)
  if (value.feedback !== null && !feedback) return null
  const sources = value.sources.map(parseSource)
  const validation = value.version === 2 && value.validation !== null ? parseWebsiteValidation(value.validation) : null
  if (value.version === 2 && (typeof value.origin !== 'string' || !['pack', 'standalone'].includes(value.origin) || (value.validation !== null && !validation) || (value.origin === 'standalone' && (validation || sources.length)))) return null
  if (sources.some(v => !v) || (!feedback && !sources.length && !validation)) return null
  return { version: value.version, submissionId: value.submissionId, feedback, sources: sources as SourceObservation[], ...(value.version === 2 ? { origin: value.origin as 'pack' | 'standalone', validation } : {}) }
}
export function parseSharedContribution(value: unknown): Contribution | null {
  const contribution = parseContribution(value)
  return contribution && contribution.sources.every(source => parseSharedSource(source)) ? contribution : null
}
/** Recheck persisted retry payloads without altering their local receipt or ID. */
export function toSharedContribution(value: unknown): Contribution | null {
  const contribution = parseContribution(value)
  if (!contribution) return null
  return parseSharedContribution({ ...contribution, sources: contribution.sources.filter(source => parseSharedSource(source)) })
}
export async function contributionFromManifest(manifest: CellarPackManifest, validation?: WebsiteValidation): Promise<Contribution | null> {
  const feedback = collectionFeedback(manifest.extensions?.['tin-to-cellar:feedback'])
  const protocol = manifest.extensions?.['tin-to-cellar:protocol']
  const consistent = feedback?.schemaVersion !== '0.2.0' || record(protocol) && protocol.revision === feedback.protocolRevision
  const sources: SourceObservation[] = []
  for (const label of manifest.labels ?? []) {
    const entry = catalogMatch(label.maker, label.blend)
    if (!entry) continue
    const observations = label.extensions?.[SOURCE_KEY]
    if (Array.isArray(observations)) for (const item of observations.slice(0, 10)) {
      const source = record(item) ? parseSharedSource({ ...item, catalogId: entry.id }) : null
      if (source) sources.push(source)
    }
    // Older packs have no link-check report. Preserve provenance without inventing verification.
    for (const source of label.research.sources) if (source.type === 'web' && source.role === 'package-appearance' && knownCatalogSourceUrl(entry.id, source.url) && !sources.some(v => v.catalogId === entry.id && v.url === source.url)) {
      sources.push({ catalogId: entry.id, url: source.url, status: 'unverified', package: 'unknown', variant: 'unknown' })
    }
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(manifest)))
  const submissionId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const result: Contribution = { version: validation ? 2 : 1, submissionId, feedback: consistent ? feedback : null, sources: sources.slice(0, 100), ...(validation ? { origin: 'pack' as const, validation } : {}) }
  return result.feedback || result.sources.length || validation ? result : null
}
