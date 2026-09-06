import { describe, expect, it } from 'vitest'
import { parseDiagnosticReport, reportRevisionLabel, summarizeReports, PROMPT_VERSION, type LegacyDiagnosticReport, type ProtocolDiagnosticReport } from './index'

export const example: LegacyDiagnosticReport = {
  format: 'tin-to-cellar/feedback', schemaVersion: '1.0.0', promptVersion: PROMPT_VERSION,
  request: { labelCount: 2, shape: 'circle' }, outcome: 'partial',
  steps: [{ stage: 'research', status: 'passed', attempts: 2 }, { stage: 'generation', status: 'failed', attempts: 3 }],
  issues: [{ code: 'generation-failed', stage: 'generation', resolved: false }],
}
export const protocolExample: ProtocolDiagnosticReport = {
  format: 'tin-to-cellar/feedback', schemaVersion: '2.0.0', protocolRevision: 1,
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
  it('counts reports affected by each issue, not repeated occurrences', () => {
    const totals = {
      reports: 2, outcomes: { complete: 1, partial: 1, failed: 0, 'research-only': 0 }, issues: { 'generation-failed': 2 },
    }
    expect(summarizeReports([example, { ...example, outcome: 'complete', issues: [...example.issues, ...example.issues] }])).toEqual({ ...totals, byRevision: [{ revisionLabel: `Legacy prompt ${PROMPT_VERSION}`, ...totals }] })
  })
  it('reads the new report and marks unknown revisions without authenticating attribution', () => {
    expect(parseDiagnosticReport(protocolExample)).toEqual(protocolExample)
    expect(reportRevisionLabel(protocolExample)).toBe('Protocol revision 1')
    const unknown = { ...protocolExample, protocolRevision: 1000000 }
    expect(parseDiagnosticReport(unknown)).toEqual(unknown)
    expect(reportRevisionLabel(unknown)).toBe('Protocol revision 1000000 (unrecognized)')
  })
  it('keeps the historical contract closed and rejects private or invalid new fields', () => {
    for (const value of [
      { ...example, protocolRevision: 1 },
      { ...example, steps: protocolExample.steps },
      { ...protocolExample, promptVersion: PROMPT_VERSION },
      { ...protocolExample, email: 'private@example.com' },
      { ...protocolExample, request: { ...protocolExample.request, sourceUrl: 'https://private.example' } },
      { ...protocolExample, steps: [{ ...protocolExample.steps[0], log: 'private error' }] },
      { ...protocolExample, issues: [{ ...protocolExample.issues[0], url: 'https://private.example' }] },
      ...[0, -1, 1.5, 1000001, '1', null].map((protocolRevision) => ({ ...protocolExample, protocolRevision })),
    ]) expect(parseDiagnosticReport(value)).toBeNull()
  })
  it('separates comparison results for every legacy or protocol revision', () => {
    const summary = summarizeReports([example, protocolExample, { ...protocolExample, protocolRevision: 999 }])
    expect(summary.reports).toBe(3)
    expect(summary.byRevision.map(({ revisionLabel, reports }) => ({ revisionLabel, reports }))).toEqual([
      { revisionLabel: `Legacy prompt ${PROMPT_VERSION}`, reports: 1 },
      { revisionLabel: 'Protocol revision 1', reports: 1 },
      { revisionLabel: 'Protocol revision 999 (unrecognized)', reports: 1 },
    ])
    expect(summary.byRevision[0].issues).toEqual({ 'generation-failed': 1 })
    expect(summary.byRevision[1].issues).toEqual({ 'protocol-incomplete': 1 })
    expect(summarizeReports([]).byRevision).toEqual([])
  })
})
