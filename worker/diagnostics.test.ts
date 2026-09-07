import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanDiagnostics, diagnosticCapabilityHash, diagnosticsExport, shareNotes, storeDiagnostics, type DiagnosticsDatabase } from './diagnostics'
import { parseContribution, type Contribution } from '../src/lib/contributions'
const feedback = { format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '0.0.16', request: { labelCount: 1, shape: 'circle' }, outcome: 'complete', steps: [], issues: [] } as const
const contribution: Contribution = { version: 2, submissionId: 'a'.repeat(64), feedback: { ...feedback, steps: [], issues: [] }, sources: [], origin: 'pack', validation: null }
const notes = { format: 'tin-to-cellar/retrospective', schemaVersion: '0.1.0', protocolRevision: '0.0.16', capabilities: { browsing: 'available' }, tools: [], observations: [{ stage: 'packaging', kind: 'helped', explanation: 'The builder produced the archive successfully.' }] }
function database(): DiagnosticsDatabase {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../migrations/0001_diagnostics.sql', import.meta.url), 'utf8'))
  db.exec(readFileSync(new URL('../migrations/0002_diagnostic_ownership.sql', import.meta.url), 'utf8'))
  const prepare = (sql: string) => {
    let values: never[] = []
    const statement = { bind(...v: unknown[]) { values = v as never[]; return statement }, async run() { const r = db.prepare(sql).run(...values); return { meta: { changes: Number(r.changes) } } }, async first<T>() { return (db.prepare(sql).get(...values) ?? null) as T | null }, async all<T>() { return { results: db.prepare(sql).all(...values) as T[] } } }
    return statement
  }
  return { prepare, async batch(statements) { db.exec('BEGIN'); try { const values = await Promise.all(statements.map(s => s.run())); db.exec('COMMIT'); return values } catch (error) { db.exec('ROLLBACK'); throw error } } }
}
const exportRequest = (query = '') => new Request('https://site.com/api/labels/diagnostics' + query, { headers: { Authorization: 'Bearer read-token' } })
const notesRequest = (value: unknown = notes) => new Request('https://site.com/api/labels/process-notes', { method: 'POST', headers: { Origin: 'https://site.com', 'Content-Type': 'application/json', 'X-Diagnostic-Capability': 'c'.repeat(64) }, body: JSON.stringify({ submissionId: contribution.submissionId, retrospective: value }) })
const budget = { getByName: () => ({ fetch: async () => Response.json({}) }) }
const limiter = { limit: async () => ({ success: true }) }
afterEach(() => vi.useRealTimers())
it('retains new structured data for a year, keeps legacy expiry, and does not extend expiry on retry', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06'))
  const db = database()
  expect(await storeDiagnostics(db, contribution, new Date(), false, await diagnosticCapabilityHash(notesRequest()))).toBe('collected')
  expect(await storeDiagnostics(db, contribution, new Date('2026-10-01'))).toBe('duplicate')
  await storeDiagnostics(db, { ...contribution, submissionId: 'b'.repeat(64) }, new Date('2026-09-06'), true)
  vi.setSystemTime(new Date('2027-01-01'))
  const result = await (await diagnosticsExport(exportRequest(), db, 'read-token')).json()
  expect(result.reports).toHaveLength(1)
  expect(result.reports[0].expiresAt).toBe('2027-09-06T00:00:00.000Z')
  await cleanDiagnostics(db)
  expect((await db.prepare('SELECT id FROM diagnostic_reports').all()).results).toHaveLength(1)
})
it('requires explicit same-origin notes submission, matches revisions, and rejects replacement notes', async () => {
  const db = database()
  expect((await shareNotes(notesRequest(), db, limiter, budget)).status).toBe(409)
  await storeDiagnostics(db, contribution, new Date(), false, await diagnosticCapabilityHash(notesRequest()))
  expect((await shareNotes(notesRequest({ ...notes, protocolRevision: '0.0.17' }), db, limiter, budget)).status).toBe(409)
  expect(await (await shareNotes(notesRequest(), db, limiter, budget)).json()).toEqual({ status: 'collected' })
  expect(await (await shareNotes(notesRequest(), db, limiter, budget)).json()).toEqual({ status: 'duplicate' })
  expect((await shareNotes(notesRequest({ ...notes, observations: [{ ...notes.observations[0], explanation: 'Replacement' }] }), db, limiter, budget)).status).toBe(409)
  const bad = new Request(notesRequest(), { headers: { Origin: 'https://other.com', 'Content-Type': 'application/json' } })
  expect((await shareNotes(bad, db, limiter, budget)).status).toBe(403)
})
it('expires notes independently and enforces private exports', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06'))
  const db = database()
  await storeDiagnostics(db, contribution, new Date(), false, await diagnosticCapabilityHash(notesRequest()))
  await shareNotes(notesRequest(), db, limiter, budget)
  expect((await diagnosticsExport(exportRequest(), db, 'different')).status).toBe(403)
  vi.setSystemTime(new Date('2027-01-01'))
  const page = await (await diagnosticsExport(exportRequest(), db, 'read-token')).json()
  expect(page.reports[0].retrospective).toBeNull()
  await cleanDiagnostics(db)
  expect((await db.prepare('SELECT * FROM diagnostic_notes').all()).results).toHaveLength(0)
})
it('paginates beyond the previous capacity without dropping or duplicating records', async () => {
  const db = database()
  for (let n = 0; n < 1002; n++) await storeDiagnostics(db, { ...contribution, submissionId: n.toString(16).padStart(64, '0') })
  const until = new Date().toISOString()
  let cursor = ''; const ids: string[] = []
  do { const page = await (await diagnosticsExport(exportRequest(`?until=${encodeURIComponent(until)}&cursor=${cursor}`), db, 'read-token')).json(); ids.push(...page.reports.map((r: { id: string }) => r.id)); cursor = page.nextCursor } while (cursor)
  expect(new Set(ids).size).toBe(1002)
  expect(ids.length).toBe(1002)
})
it('keeps narrative out of automatic contributions and rejects arbitrary validator fields', () => {
  expect(parseContribution({ ...contribution, retrospective: notes })).toBeNull()
  expect(parseContribution({ ...contribution, validation: { version: '0.1.0', outcome: 'ready', issues: [{ code: 'PRIVATE', count: 1 }] } })).toBeNull()
  expect(parseContribution({ ...contribution, origin: 'standalone', sources: [], validation: null })).toBeTruthy()
})

it('pauses notes before persistence and never reserves allowance for invalid notes or foreign origins', async () => {
  const db = database()
  await storeDiagnostics(db, contribution, new Date(), false, await diagnosticCapabilityHash(notesRequest()))
  const reserve = vi.fn(async () => Response.json({ code: 'collection_paused', resetAt: '2026-09-08T00:00:00.000Z' }, { status: 429 }))
  const binding = { getByName: () => ({ fetch: reserve }) }
  expect((await shareNotes(notesRequest({ invalid: true }), db, limiter, binding)).status).toBe(400)
  expect(reserve).not.toHaveBeenCalled()
  expect((await shareNotes(notesRequest(), db, limiter, binding)).status).toBe(429)
  expect(reserve).toHaveBeenCalledOnce()
  expect((await db.prepare('SELECT * FROM diagnostic_notes').all()).results).toHaveLength(0)
  expect((await shareNotes(notesRequest(), db, limiter)).status).toBe(503)
})

it('rejects oversized notes before database reads or budget admission', async () => {
  const prepare = vi.fn()
  const db = { prepare, batch: vi.fn() }
  const reserve = vi.fn()
  const request = new Request(notesRequest(), { body: JSON.stringify({ padding: 'x'.repeat(16384) }) })
  expect((await shareNotes(request, db, limiter, { getByName: () => ({ fetch: reserve }) })).status).toBe(413)
  expect(prepare).not.toHaveBeenCalled()
  expect(reserve).not.toHaveBeenCalled()
})
