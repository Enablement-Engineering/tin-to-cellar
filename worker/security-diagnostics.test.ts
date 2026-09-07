import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { diagnosticCapabilityHash, diagnosticsExport, shareNotes, storeDiagnostics, type DiagnosticsDatabase } from './diagnostics'
import type { Contribution } from '../src/lib/contributions'
import { contributionsResponse, type Storage } from './contributions'
import { budgetResponse } from './diagnostic-budget'
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

it('duplicate reports preserve the shared allowance for different reports', async () => {
  const db = database()
  const values = new Map<string, unknown>()
  const storage: Storage = {
    async get<T>(key: string) { return values.get(key) as T | undefined },
    async put(key, value) { values.set(key, value) },
    async delete(key) { return values.delete(key) },
    async list<T>() { return new Map(values) as Map<string, T> },
    async getAlarm() { return null },
    async setAlarm() {},
    async transaction<T>(callback: (s: Storage) => Promise<T>) { return callback(storage) },
  }
  const config = { DIAGNOSTIC_COLLECTION_ENABLED: 'true', DIAGNOSTIC_DAILY_ALLOWANCE: '3' }
  const binding = { getByName: () => ({ fetch: async (request: Request) => budgetResponse(storage, config, true, (await request.json() as { resource: string }).resource) }) }
  const send = (report: Contribution) => contributionsResponse(new Request('https://site.com/api/labels/contributions', {
    method: 'POST', headers: { Origin: 'https://site.com', 'Content-Type': 'application/json' }, body: JSON.stringify(report),
  }), binding, limiter, undefined, db)
  for (let i = 0; i < 3; i++) {
    const response = await send(contribution)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: i ? 'duplicate' : 'collected' })
  }
  expect((await send({ ...contribution, submissionId: 'b'.repeat(64) })).status).toBe(200)
  expect((await db.prepare('SELECT * FROM diagnostic_reports').all()).results).toHaveLength(2)
  expect(await (await budgetResponse(storage, config, false)).json()).toMatchObject({ used: 2, limit: 3, paused: false })
})

it('knowing a submission ID cannot poison notes without the original capability', async () => {
  const db = database()
  await storeDiagnostics(db, contribution, new Date(), false, await diagnosticCapabilityHash(notesRequest()))
  const injected = { ...notes, observations: [{ stage: 'packaging', kind: 'suggestion', explanation: 'Synthetic attacker-controlled diagnostic note.' }] }
  const attacker = notesRequest(injected)
  attacker.headers.delete('X-Diagnostic-Capability') // Origin is a normal HTTP header, not a credential.
  expect(attacker.headers.has('Authorization')).toBe(false)
  expect((await shareNotes(attacker, db, limiter, budget)).status).toBe(403)
  expect((await shareNotes(notesRequest(), db, limiter, budget)).status).toBe(200)
  const exported = await (await diagnosticsExport(exportRequest(), db, 'read-token')).json()
  expect(exported.reports[0].retrospective.observations[0].explanation).toBe(notes.observations[0].explanation)
})

it('duplicate notes consume only one shared allowance slot', async () => {
  const db = database()
  await storeDiagnostics(db, contribution, new Date(), false, await diagnosticCapabilityHash(notesRequest()))
  let used = 0
  const capped = { getByName: () => ({ fetch: async () => ++used <= 3 ? Response.json({}) : Response.json({ code: 'collection_paused' }, { status: 429 }) }) }
  for (let i = 0; i < 3; i++) expect((await shareNotes(notesRequest(), db, limiter, capped)).status).toBe(200)
  expect((await shareNotes(notesRequest(), db, limiter, capped)).status).toBe(200)
  expect(used).toBe(1)
  expect((await db.prepare('SELECT * FROM diagnostic_notes').all()).results).toHaveLength(1)
})

it('preserves the first report capability across response loss, duplicate imports, and competing first writers', async () => {
  const db = database()
  const send = (token: string) => contributionsResponse(new Request('https://site.com/api/labels/contributions', {
    method: 'POST', headers: { Origin: 'https://site.com', 'Content-Type': 'application/json', 'X-Diagnostic-Capability': token }, body: JSON.stringify(contribution),
  }), budget, limiter, undefined, db)
  const tokens = ['c'.repeat(64), 'd'.repeat(64)]
  const results = await Promise.all(tokens.map(async token => (await send(token)).json()))
  expect(results.filter(result => result.notesAllowed)).toHaveLength(1)
  const owner = tokens[results.findIndex(result => result.notesAllowed)]
  const stranger = tokens.find(token => token !== owner)!
  expect(await (await send(owner)).json()).toEqual({ status: 'duplicate', notesAllowed: true })
  expect(await (await send(stranger)).json()).toEqual({ status: 'duplicate', notesAllowed: false })
  const unauthorized = notesRequest()
  unauthorized.headers.set('X-Diagnostic-Capability', stranger)
  expect((await shareNotes(unauthorized, db, limiter, budget)).status).toBe(403)
  const authorized = notesRequest()
  authorized.headers.set('X-Diagnostic-Capability', owner)
  expect((await shareNotes(authorized, db, limiter, budget)).status).toBe(200)
  const exported = await (await diagnosticsExport(exportRequest(), db, 'read-token')).text()
  expect(exported).not.toContain('capability')
  expect(exported).not.toContain(owner)
})

it('does not let a new capability claim existing reports without ownership or accept changed reports', async () => {
  const db = database()
  await storeDiagnostics(db, contribution)
  const send = (value: Contribution) => contributionsResponse(new Request('https://site.com/api/labels/contributions', {
    method: 'POST', headers: { Origin: 'https://site.com', 'Content-Type': 'application/json', 'X-Diagnostic-Capability': 'c'.repeat(64) }, body: JSON.stringify(value),
  }), budget, limiter, undefined, db)
  expect(await (await send(contribution)).json()).toEqual({ status: 'duplicate', notesAllowed: false })
  expect((await shareNotes(notesRequest(), db, limiter, budget)).status).toBe(403)
  expect((await send({ ...contribution, origin: 'standalone' })).status).toBe(409)
  expect((await diagnosticCapabilityHash(new Request('https://site.com', { headers: { 'X-Diagnostic-Capability': 'short' } })))).toBeNull()
})

it('still rate-limits duplicate reports and notes before database work', async () => {
  const db = database()
  await storeDiagnostics(db, contribution, new Date(), false, await diagnosticCapabilityHash(notesRequest()))
  const denied = { limit: async () => ({ success: false }) }
  const request = new Request('https://site.com/api/labels/contributions', { method: 'POST', headers: { Origin: 'https://site.com', 'Content-Type': 'application/json' }, body: JSON.stringify(contribution) })
  expect((await contributionsResponse(request, budget, denied, undefined, db)).status).toBe(429)
  expect((await shareNotes(notesRequest(), db, denied, budget)).status).toBe(429)
})

it('rechecks ownership atomically when cleanup and reimport replace a report during budget admission', async () => {
  const db = database()
  await storeDiagnostics(db, contribution, new Date(), false, await diagnosticCapabilityHash(notesRequest()))
  const newOwner = notesRequest()
  newOwner.headers.set('X-Diagnostic-Capability', 'd'.repeat(64))
  const replacementHash = await diagnosticCapabilityHash(newOwner)
  const replacingBudget = { getByName: () => ({ fetch: async () => {
    await db.prepare('DELETE FROM diagnostic_reports WHERE id = ?').bind(contribution.submissionId).run()
    await storeDiagnostics(db, contribution, new Date(), false, replacementHash)
    return Response.json({})
  } }) }
  expect((await shareNotes(notesRequest(), db, limiter, replacingBudget)).status).toBe(403)
  expect((await db.prepare('SELECT * FROM diagnostic_notes').all()).results).toHaveLength(0)
  expect((await shareNotes(newOwner, db, limiter, budget)).status).toBe(200)
})

it('does not insert notes if the parent expires while budget admission is pending', async () => {
  const db = database()
  await storeDiagnostics(db, contribution, new Date(), false, await diagnosticCapabilityHash(notesRequest()))
  const expiringBudget = { getByName: () => ({ fetch: async () => {
    await db.prepare('UPDATE diagnostic_reports SET expires_at = ? WHERE id = ?').bind('2000-01-01T00:00:00.000Z', contribution.submissionId).run()
    return Response.json({})
  } }) }
  expect((await shareNotes(notesRequest(), db, limiter, expiringBudget)).status).toBe(409)
  expect((await db.prepare('SELECT * FROM diagnostic_notes').all()).results).toHaveLength(0)
})
