import { TOBACCO_CATALOG } from '../tobacco-catalog'
import feedbackSchema from '../feedback/schema.json'
import legacyFeedbackSchema from '../feedback/legacy-schema.json'
import type { DiagnosticReport } from '../feedback'
import type { CellarPackManifest } from '../cellarpack/types'

export const SOURCE_KEY = 'tin-to-cellar:sources'
export const SOURCE_STATUSES = ['valid', 'unavailable', 'wrong-package', 'unverified'] as const
export type SourceObservation = { catalogId: string; url: string; status: typeof SOURCE_STATUSES[number]; package: 'tin' | 'pouch' | 'box' | 'other' | 'unknown'; variant: 'current' | 'historical' | 'unknown' }
export type Contribution = { version: 1; submissionId: string; feedback: DiagnosticReport | null; sources: SourceObservation[] }
export type SuggestedSource = SourceObservation & { checkedAt: string }
const catalogIds = new Set(TOBACCO_CATALOG.map(item => item.id))
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
const normalize = (v: string) => v.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
export function catalogMatch(maker: string, blend: string) {
  return TOBACCO_CATALOG.find(item => normalize(item.maker) === normalize(maker) && normalize(item.blend) === normalize(blend))
}
// Pure schema interpreter for these fixed feedback schemas. No runtime code generation in Workers.
function conforms(value: unknown, schema: Record<string, unknown>, root = schema): boolean {
  if (typeof schema.$ref === 'string') return conforms(value, (root.$defs as Record<string, Record<string, unknown>>)[schema.$ref.split('/').pop()!], root)
  if ('const' in schema && value !== schema.const) return false
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false
  if (schema.type === 'object') {
    if (!record(value)) return false
    const properties = schema.properties as Record<string, Record<string, unknown>>
    if ((schema.required as string[] ?? []).some(k => !Object.hasOwn(value, k))) return false
    return Object.entries(value).every(([k, v]) => Object.hasOwn(properties, k) ? conforms(v, properties[k], root) : schema.additionalProperties !== false)
  }
  if (schema.type === 'array') return Array.isArray(value) && value.length <= Number(schema.maxItems ?? Infinity) && value.every(v => conforms(v, schema.items as Record<string, unknown>, root))
  if (schema.type === 'integer') return typeof value === 'number' && Number.isInteger(value) && value >= Number(schema.minimum ?? -Infinity) && value <= Number(schema.maximum ?? Infinity)
  if (schema.type === 'boolean') return typeof value === 'boolean'
  if (schema.type === 'string') return typeof value === 'string' && value.length <= Number(schema.maxLength ?? Infinity) && (typeof schema.pattern !== 'string' || new RegExp(schema.pattern).test(value))
  return true
}
export function collectionFeedback(value: unknown): DiagnosticReport | null {
  return conforms(value, feedbackSchema) || conforms(value, legacyFeedbackSchema) ? JSON.parse(JSON.stringify(value)) as DiagnosticReport : null
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
  if (typeof value.catalogId !== 'string' || !catalogIds.has(value.catalogId) || !publicSourceUrl(value.url) ||
    !SOURCE_STATUSES.includes(value.status as SourceObservation['status']) ||
    !['tin', 'pouch', 'box', 'other', 'unknown'].includes(String(value.package)) ||
    !['current', 'historical', 'unknown'].includes(String(value.variant))) return null
  return { catalogId: value.catalogId, url: value.url, status: value.status, package: value.package, variant: value.variant } as SourceObservation
}
export function parseContribution(value: unknown): Contribution | null {
  if (!record(value) || !exact(value, ['version', 'submissionId', 'feedback', 'sources']) || value.version !== 1 || typeof value.submissionId !== 'string' || !/^[a-f0-9]{64}$/.test(value.submissionId) || !Array.isArray(value.sources) || value.sources.length > 100) return null
  const feedback = value.feedback === null ? null : collectionFeedback(value.feedback)
  if (value.feedback !== null && !feedback) return null
  const sources = value.sources.map(parseSource)
  if (sources.some(v => !v) || (!feedback && !sources.length)) return null
  return { version: 1, submissionId: value.submissionId, feedback, sources: sources as SourceObservation[] }
}
export async function contributionFromManifest(manifest: CellarPackManifest): Promise<Contribution | null> {
  const feedback = collectionFeedback(manifest.extensions?.['tin-to-cellar:feedback'])
  const protocol = manifest.extensions?.['tin-to-cellar:protocol']
  const consistent = feedback?.schemaVersion !== '0.2.0' || record(protocol) && protocol.revision === feedback.protocolRevision
  const sources: SourceObservation[] = []
  for (const label of manifest.labels ?? []) {
    const entry = catalogMatch(label.maker, label.blend)
    if (!entry) continue
    const observations = label.extensions?.[SOURCE_KEY]
    if (Array.isArray(observations)) for (const item of observations.slice(0, 10)) {
      const source = record(item) ? parseSource({ ...item, catalogId: entry.id }) : null
      if (source) sources.push(source)
    }
    // Older packs have no link-check report. Preserve provenance without inventing verification.
    for (const source of label.research.sources) if (source.type === 'web' && source.role === 'package-appearance' && publicSourceUrl(source.url) && !sources.some(v => v.catalogId === entry.id && v.url === source.url)) {
      sources.push({ catalogId: entry.id, url: source.url, status: 'unverified', package: 'unknown', variant: 'unknown' })
    }
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(manifest)))
  const submissionId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const result = { version: 1 as const, submissionId, feedback: consistent ? feedback : null, sources: sources.slice(0, 100) }
  return result.feedback || result.sources.length ? result : null
}
