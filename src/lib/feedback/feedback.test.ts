import { describe, expect, it } from 'vitest'
import { parseDiagnosticReport, summarizeReports, PROMPT_VERSION, type LegacyDiagnosticReport } from './index'

export const example: LegacyDiagnosticReport = {
  format: 'tin-to-cellar/feedback', schemaVersion: '1.0.0', promptVersion: PROMPT_VERSION,
  request: { labelCount: 2, shape: 'circle' }, outcome: 'partial',
  steps: [{ stage: 'research', status: 'passed', attempts: 2 }, { stage: 'generation', status: 'failed', attempts: 3 }],
  issues: [{ code: 'generation-failed', stage: 'generation', resolved: false }],
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
    expect(summarizeReports([example, { ...example, outcome: 'complete', issues: [...example.issues, ...example.issues] }])).toEqual(totals)
  })
})
