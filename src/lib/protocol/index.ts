import registry from './releases.json'

export const PROTOCOL_URL = 'https://tintocellar.com/api/protocol/v1'
export const PROTOCOL_REVISION = registry.current
export const PROTOCOL_KEY = 'tin-to-cellar:protocol'
export type ProtocolRelease = { revision: number; cellarpackVersion: string; feedbackVersion: string; files: Record<string, string>; hashes: Record<string, string> }
export const protocolReleases = registry.releases as Record<string, ProtocolRelease>
export const isKnownProtocolRevision = (revision: number): boolean => Object.hasOwn(protocolReleases, String(revision))
export function protocolRevisionUrl(revision: number): string {
  if (!Number.isInteger(revision) || revision < 1 || revision > 1_000_000) throw new Error('Invalid protocol revision')
  return `${PROTOCOL_URL}/releases/${revision}/instructions.md`
}
export function protocolInstructions(): string {
  return protocolReleases[String(PROTOCOL_REVISION)]?.files['instructions.md'] ?? ''
}
export type ProtocolContext = { status: 'known' | 'unknown' | 'legacy' | 'invalid' | 'conflict'; revision?: number }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const validRevision = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1_000_000
export function resolveProtocolContext(extensions: unknown): ProtocolContext {
  if (!record(extensions) || !Object.hasOwn(extensions, PROTOCOL_KEY)) return { status: 'legacy' }
  const value = extensions[PROTOCOL_KEY]
  if (!record(value) || Object.keys(value).length !== 3 || !validRevision(value.revision) || value.cellarpackVersion !== '1.0.0' || value.feedbackVersion !== '2.0.0') return { status: 'invalid' }
  const feedback = extensions['tin-to-cellar:feedback']
  if (record(feedback) && feedback.format === 'tin-to-cellar/feedback' && feedback.schemaVersion === '2.0.0' && validRevision(feedback.protocolRevision) && feedback.protocolRevision !== value.revision) return { status: 'conflict' }
  return { status: isKnownProtocolRevision(value.revision) ? 'known' : 'unknown', revision: value.revision }
}
