import { describe, expect, it } from 'vitest'
import { parseDiagnosticReport, reportRevisionLabel, PROMPT_VERSION, type LegacyDiagnosticReport, type ProtocolDiagnosticReport } from './index'

export const example: LegacyDiagnosticReport = {
  format: 'tin-to-cellar/feedback', schemaVersion: '1.0.0', promptVersion: PROMPT_VERSION,
  request: { labelCount: 2, shape: 'circle' }, outcome: 'partial',
  steps: [{ stage: 'research', status: 'passed', attempts: 2 }, { stage: 'generation', status: 'failed', attempts: 3 }],
  issues: [{ code: 'generation-failed', stage: 'generation', resolved: false }],
}
export const protocolExample: ProtocolDiagnosticReport = {
  format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '0.0.14',
  request: example.request, outcome: 'failed',
  steps: [{ stage: 'protocol-retrieval', status: 'unavailable', attempts: 1 }],
  issues: [{ stage: 'protocol-retrieval', code: 'protocol-incomplete', resolved: false }],
}
describe('private feedback boundary', () => {
  it('accepts a report without any pack or user identity', () => {
    expect(parseDiagnosticReport(example)).toEqual(example)
    expect(parseDiagnosticReport(example)).not.toBe(example)
  })
  it('rejects extra fields at every nesting level instead of exporting private data', () => {
    for (const value of [
      { ...example, email: 'person@example.com' },
      { ...example, request: { ...example.request, name: 'Person Name' } },
      { ...example, steps: [{ ...example.steps[0], log: '/Users/person/private.txt' }] },
      { ...example, issues: [{ ...example.issues[0], message: 'Bearer secret' }] },
      { ...example, outcome: 'person@example.com' },
      { ...example, promptVersion: 'private-session-id' },
      { ...example, request: { ...example.request, labelCount: 1234567890 } },
      { ...example, steps: [{ ...example.steps[0], attempts: -1 }] },
      { ...example, issues: Array(51).fill(example.issues[0]) },
      null, {}, '<script>alert(1)</script>',
    ]) expect(parseDiagnosticReport(value)).toBeNull()
  })
  it('reads the new report and marks unknown revisions without authenticating attribution', () => {
    expect(parseDiagnosticReport(protocolExample)).toEqual(protocolExample)
    expect(reportRevisionLabel(protocolExample)).toBe('Protocol 0.0.14')
    const unknown = { ...protocolExample, protocolRevision: '99.0.0' }
    expect(parseDiagnosticReport(unknown)).toEqual(unknown)
    expect(reportRevisionLabel(unknown)).toBe('Protocol 99.0.0 (unrecognized)')
  })
  it('keeps the historical contract closed and rejects private or invalid new fields', () => {
    for (const value of [
      { ...example, protocolRevision: '0.0.14' },
      { ...example, steps: protocolExample.steps },
      { ...protocolExample, promptVersion: PROMPT_VERSION },
      { ...protocolExample, email: 'private@example.com' },
      { ...protocolExample, request: { ...protocolExample.request, sourceUrl: 'https://private.example' } },
      { ...protocolExample, steps: [{ ...protocolExample.steps[0], log: 'private error' }] },
      { ...protocolExample, issues: [{ ...protocolExample.issues[0], url: 'https://private.example' }] },
      ...[0, -1, 1.5, 1000001, '1', null].map((protocolRevision) => ({ ...protocolExample, protocolRevision })),
    ]) expect(parseDiagnosticReport(value)).toBeNull()
  })
})
