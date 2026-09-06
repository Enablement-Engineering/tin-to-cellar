import { expect, it } from 'vitest'
import { analyze, normalizeSnapshot } from './analyze.mjs'
const report = { id: 'a'.repeat(64), receivedAt: '2026-09-06T00:00:00.000Z', expiresAt: '2027-09-06T00:00:00.000Z', origin: 'pack', validation: null, retrospective: null, notesExpiresAt: null, feedback: { format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '0.0.16', request: { labelCount: 1, shape: 'circle' }, outcome: 'complete', steps: [{ stage: 'proof', status: 'passed', attempts: 3 }], issues: [{ code: 'geometry', stage: 'proof', resolved: true }] } }
const input = (reports = [report]) => ({ version: 1, until: '2026-09-07T00:00:00.000Z', reports })
const now = new Date('2026-09-07')
it('counts unique submitted reports and preserves resolved friction and attempts', () => {
  const result = analyze(input([report, report]), now)
  expect(result.weekly.submittedReports).toBe(1)
  expect(result.weekly.issues.geometry).toEqual({ affectedReports: 1, resolvedReports: 1, unresolvedReports: 0 })
  expect(result.weekly.stages.proof.attempts).toBe(3)
  expect(result.weekly.byRevision['0.0.16'].aiReports).toBe(1)
  expect(JSON.stringify(result.months)).not.toContain(report.id)
})
it('rejects invalid schemas and conflicting duplicates instead of fabricating an empty sample', () => {
  expect(() => analyze(input([{ ...report, feedback: { ...report.feedback, email: 'private' } }]), now)).toThrow()
  expect(() => analyze(input([report, { ...report, origin: 'standalone' }]), now)).toThrow()
  expect(analyze(input([]), now).weekly.submittedReports).toBe(0)
})
it('removes expired raw data and notes from private snapshots', () => {
  expect(normalizeSnapshot(input(), new Date('2028-01-01'))).toEqual([])
  expect(normalizeSnapshot(input([{ ...report, retrospective: { private: 'expired' }, notesExpiresAt: '2026-09-01' }]), now)[0].retrospective).toBeNull()
})
