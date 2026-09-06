/** Process notes are optional, untrusted narrative. They are never automatically submitted. */
export const RETROSPECTIVE_KEY = 'tin-to-cellar:retrospective'
export const stages = ['research', 'generation', 'visual-review', 'proof', 'packaging', 'validation', 'protocol-retrieval'] as const
export const capabilityNames = ['browsing', 'image-generation', 'file-creation', 'local-execution'] as const
export type Retrospective = {
  format: 'tin-to-cellar/retrospective'
  schemaVersion: '0.1.0'
  protocolRevision: string
  capabilities: Partial<Record<typeof capabilityNames[number], 'available' | 'unavailable' | 'unknown'>>
  tools: Array<{ id: 'local-proof' | 'pack-builder'; version: string }>
  observations: Array<{ stage: typeof stages[number]; kind: 'helped' | 'friction' | 'recovery' | 'suggestion'; explanation: string; result?: 'worked' | 'partly-worked' | 'failed' | 'not-tested' }>
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const only = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).every(k => keys.includes(k))
const member = (values: readonly string[], v: unknown) => typeof v === 'string' && values.includes(v)
const version = (v: unknown) => typeof v === 'string' && /^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$/.test(v)
export function parseRetrospective(v: unknown): Retrospective | null {
  if (!record(v) || !only(v, ['format', 'schemaVersion', 'protocolRevision', 'capabilities', 'tools', 'observations']) || v.format !== 'tin-to-cellar/retrospective' || v.schemaVersion !== '0.1.0' || !version(v.protocolRevision)) return null
  if (!record(v.capabilities) || !only(v.capabilities, [...capabilityNames]) || Object.values(v.capabilities).some(s => !member(['available', 'unavailable', 'unknown'], s))) return null
  if (!Array.isArray(v.tools) || v.tools.length > 2 || v.tools.some(t => !record(t) || !only(t, ['id', 'version']) || !member(['local-proof', 'pack-builder'], t.id) || !(t.version === 'unknown' || version(t.version)))) return null
  if (new Set(v.tools.map(t => t.id)).size !== v.tools.length) return null
  if (!Array.isArray(v.observations) || !v.observations.length || v.observations.length > 5) return null
  for (const item of v.observations) {
    if (!record(item) || !only(item, ['stage', 'kind', 'explanation', 'result']) || !member(stages, item.stage) || !member(['helped', 'friction', 'recovery', 'suggestion'], item.kind)) return null
    if (typeof item.explanation !== 'string' || !item.explanation.trim() || item.explanation.length > 600 || [...item.explanation].some(c => c.charCodeAt(0) < 32 && !['\t', '\n', '\r'].includes(c))) return null
    if (item.kind === 'recovery' ? !member(['worked', 'partly-worked', 'failed', 'not-tested'], item.result) : item.result !== undefined) return null
  }
  return JSON.parse(JSON.stringify(v)) as Retrospective
}
