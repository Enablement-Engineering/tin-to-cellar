import registry from './releases.json'

export const PROTOCOL_REVISION = registry.current
export const PROTOCOL_KEY = 'tin-to-cellar:protocol'
export type ProtocolRelease = { revision: number | string; cellarpackVersion: string; feedbackVersion: string; files: Record<string, string>; hashes: Record<string, string> }
export const protocolReleases = registry.releases as Record<string, ProtocolRelease>
export const isKnownProtocolRevision = (revision: number | string): boolean => Object.hasOwn(protocolReleases, String(revision))
export function protocolInstructions(): string {
  return protocolReleases[String(PROTOCOL_REVISION)]?.files['instructions.md'] ?? ''
}
export type ProtocolContext = { status: 'known' | 'unknown' | 'legacy' | 'invalid' | 'conflict'; revision?: number | string }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const validRevision = (value: unknown): value is number | string => typeof value === 'string' ? /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/.test(value) : typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1_000_000
export function resolveProtocolContext(extensions: unknown): ProtocolContext {
  if (!record(extensions) || !Object.hasOwn(extensions, PROTOCOL_KEY)) return { status: 'legacy' }
  const value = extensions[PROTOCOL_KEY]
  if (!record(value) || Object.keys(value).length !== 3 || !validRevision(value.revision) || !((typeof value.revision === 'number' && value.cellarpackVersion === '1.0.0' && value.feedbackVersion === '2.0.0') || (typeof value.revision === 'string' && value.cellarpackVersion === '0.1.0' && value.feedbackVersion === '0.2.0'))) return { status: 'invalid' }
  const feedback = extensions['tin-to-cellar:feedback']
  if (record(feedback) && feedback.format === 'tin-to-cellar/feedback' && (feedback.schemaVersion === '2.0.0' || feedback.schemaVersion === '0.2.0') && validRevision(feedback.protocolRevision) && feedback.protocolRevision !== value.revision) return { status: 'conflict' }
  return { status: isKnownProtocolRevision(value.revision) ? 'known' : 'unknown', revision: value.revision }
}
