// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import type { Statement } from '../diagnostics'
import type { GalleryDatabase } from '../gallery/storage'
import { analyticsDailyAllowance, analyticsEnabled, analyticsResponse, reservePrintIntent, type AnalyticsEnv } from './index'
import { parsePrintIntent, PRINT_INTENT_LIMITS, PRINT_INTENT_PATH } from '../../src/lib/analytics/schema'

/** Real SQLite SQL and transactions; only the asynchronous D1 API is adapted. */
class DB implements GalleryDatabase {
  readonly sql = new DatabaseSync(':memory:')
  calls = 0
  constructor() {
    this.sql.exec('PRAGMA foreign_keys=ON')
    for (const file of ['0001_gallery.sql', '0006_print_intent.sql']) this.sql.exec(readFileSync(new URL(`../../migrations/gallery/${file}`, import.meta.url), 'utf8'))
    this.sql.exec("INSERT INTO gallery_tobaccos VALUES('blend-a','Maker','A','[]',1,'test'),('blend-b','Maker','B','[]',1,'test'),('inactive','Maker','Old','[]',0,'test'); INSERT INTO gallery_catalog_aliases VALUES('old-a','blend-a')")
  }
  prepare(sql: string): Statement {
    this.calls++
    let args: unknown[] = []
    const execute = () => ({ meta: { changes: Number(this.sql.prepare(sql).run(...args as never[]).changes) } })
    const statement = {
      bind: (...values: unknown[]) => { args = values; return statement },
      run: async () => execute(),
      first: async <T>() => (this.sql.prepare(sql).get(...args as never[]) ?? null) as T | null,
      all: async <T>() => ({ results: this.sql.prepare(sql).all(...args as never[]) as T[] }),
      execute,
    }
    return statement
  }
  async batch(statements: Statement[]) {
    this.sql.exec('BEGIN')
    try {
      // No yield within a transaction, matching D1's atomic batch behavior.
      const results = statements.map(statement => (statement as Statement & { execute: () => unknown }).execute())
      this.sql.exec('COMMIT')
      return results
    } catch (error) { this.sql.exec('ROLLBACK'); throw error }
  }
}

let db: DB, env: AnalyticsEnv
const now = new Date('2026-09-12T23:59:59Z')
const label = { catalogId: 'blend-a', quantity: 2 }
const payload = (event = 'print-job-requested', labels: unknown[] = [label]) => ({ event, labels })
function request(body: unknown = payload(), headers: Record<string, string> = {}, method = 'POST') {
  return new Request(`https://tintocellar.com${PRINT_INTENT_PATH}`, { method, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}), headers: { Origin: 'https://tintocellar.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.5', ...headers } })
}
beforeEach(() => { db = new DB(); env = { GALLERY: db, ANALYTICS_ENABLED: 'true', ANALYTICS_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) } } })
afterEach(() => db.sql.close())
const rows = () => db.sql.prepare('SELECT * FROM print_intent_daily ORDER BY catalog_id').all()

describe('strict anonymous contract', () => {
  it('accepts only fixed events, IDs and bounded quantities', () => {
    expect(parsePrintIntent(payload())).toEqual(payload())
    expect(parsePrintIntent({ ...payload(), event: ['selected-for-print'] })).toBeNull()
    for (const invalid of [null, {}, { ...payload(), user: 'PRIVATE-SENTINEL' }, payload('printed'), payload('selected-for-print', []), payload('selected-for-print', [{ ...label, notes: 'PRIVATE-SENTINEL' }]), payload('selected-for-print', [{ ...label, quantity: 0 }]), payload('selected-for-print', [{ ...label, quantity: 1.5 }]), payload('selected-for-print', [{ ...label, quantity: 451 }]), payload('selected-for-print', [{ ...label, catalogId: 'custom text' }]), payload('selected-for-print', [label, label]), payload('selected-for-print', [label, { catalogId: 'blend-b', quantity: 449 }])]) expect(parsePrintIntent(invalid)).toBeNull()
    expect(parsePrintIntent(payload('selected-for-print', Array.from({ length: 101 }, (_, i) => ({ catalogId: `b-${i}`, quantity: 1 }))))).toBeNull()
  })
  it('disables collection without any limiter, body or database work', async () => {
    delete env.ANALYTICS_ENABLED
    expect(analyticsEnabled(env)).toBe(false)
    const input = request()
    expect((await analyticsResponse(input, env)).status).toBe(204)
    expect(input.bodyUsed).toBe(false)
    expect(db.calls).toBe(0)
    expect(env.ANALYTICS_RATE_LIMITER!.limit).not.toHaveBeenCalled()
    env.ANALYTICS_ENABLED = 'true'; delete env.GALLERY
    expect(analyticsEnabled(env)).toBe(false)
  })
  it('rejects method, cross origin, fetch metadata, content type and declared size before DB access', async () => {
    for (const [input, status] of [[request(null, {}, 'GET'), 405], [request({}, { Origin: 'https://attacker.example' }), 403], [request({}, { 'Sec-Fetch-Site': 'cross-site' }), 403], [request({}, { 'Content-Type': 'text/plain' }), 415], [request({}, { 'Content-Length': '16385' }), 413]] as const) expect((await analyticsResponse(input, env, now)).status).toBe(status)
    expect(db.calls).toBe(0)
  })
  it('rejects unknown fields and oversized bodies before database access', async () => {
    expect((await analyticsResponse(request({ ...payload(), notes: 'PRIVATE-SENTINEL' }), env, now)).status).toBe(400)
    expect((await analyticsResponse(request({ private: 'x'.repeat(PRINT_INTENT_LIMITS.bodyBytes) }), env, now)).status).toBe(413)
    expect(db.calls).toBe(0)
    expect(rows()).toEqual([])
  })
  it('enforces its independent limiter before reading the body or database', async () => {
    env.ANALYTICS_RATE_LIMITER = { limit: vi.fn(async () => ({ success: false })) }
    const input = request()
    expect((await analyticsResponse(input, env, now)).status).toBe(429)
    expect(input.bodyUsed).toBe(false)
    expect(db.calls).toBe(0)
  })
})

describe('SQLite rollups and admission', () => {
  it('separates add, selection, quantity, per-blend jobs and whole jobs', async () => {
    for (const event of ['added-to-labels', 'selected-for-print', 'print-job-requested']) expect((await analyticsResponse(request(payload(event, [label, { catalogId: 'blend-b', quantity: 3 }])), env, now)).status).toBe(204)
    expect(rows()).toEqual([
      { catalog_id: 'blend-a', period_start: '2026-09-12', added_count: 1, selected_count: 1, quantity_count: 2, print_job_count: 1 },
      { catalog_id: 'blend-b', period_start: '2026-09-12', added_count: 1, selected_count: 1, quantity_count: 3, print_job_count: 1 },
    ])
    expect(db.sql.prepare('SELECT * FROM print_intent_job_totals').all()).toEqual([{ period_start: '2026-09-12', print_job_count: 1 }])
    expect(db.sql.prepare('SELECT * FROM print_intent_admission').all()).toEqual([{ id: 1, period_start: '2026-09-12', admissions: 3 }])
  })
  it('resolves aliases, rejects unknown/inactive IDs and duplicate canonical identities', async () => {
    expect((await analyticsResponse(request(payload('selected-for-print', [{ catalogId: 'old-a', quantity: 1 }])), env, now)).status).toBe(204)
    for (const labels of [[{ catalogId: 'unknown', quantity: 1 }], [{ catalogId: 'inactive', quantity: 1 }], [label, { catalogId: 'old-a', quantity: 1 }]]) expect((await analyticsResponse(request(payload('print-job-requested', labels)), env, now)).status).toBe(400)
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toMatchObject({ catalog_id: 'blend-a', selected_count: 1, print_job_count: 0 })
    expect(db.sql.prepare('SELECT admissions FROM print_intent_admission').get()).toEqual({ admissions: 4 })
  })
  it('accepts the maximum 100 canonical IDs and a 450-quantity job atomically', async () => {
    const labels = Array.from({ length: 100 }, (_, i) => ({ catalogId: `catalog-${i}`, quantity: i < 50 ? 5 : 4 }))
    for (const item of labels) db.sql.prepare("INSERT INTO gallery_tobaccos VALUES(?,'Maker','Blend','[]',1,'test')").run(item.catalogId)
    expect((await analyticsResponse(request(payload('print-job-requested', labels)), env, now)).status).toBe(204)
    expect(rows()).toHaveLength(100)
    expect(db.sql.prepare('SELECT SUM(quantity_count) AS quantity FROM print_intent_daily').get()).toEqual({ quantity: 450 })
    expect(db.sql.prepare('SELECT print_job_count FROM print_intent_job_totals').get()).toEqual({ print_job_count: 1 })
  })
  it('strictly limits concurrent callers using the atomic SQLite reservation', async () => {
    env.ANALYTICS_DAILY_ALLOWANCE = '7'
    const result = await Promise.all(Array.from({ length: 60 }, () => analyticsResponse(request(), env, now)))
    expect(result.filter(item => item.status === 204)).toHaveLength(7)
    expect(result.filter(item => item.status === 429)).toHaveLength(53)
    expect(rows()[0]).toMatchObject({ print_job_count: 7, quantity_count: 14 })
    expect(db.sql.prepare('SELECT admissions FROM print_intent_admission').get()).toEqual({ admissions: 7 })
  })
  it('never moves its daily counter backward when old requests finish after midnight', async () => {
    expect(await reservePrintIntent(db, '2026-09-12', 1)).toBe(true)
    expect(await reservePrintIntent(db, '2026-09-12', 1)).toBe(false)
    expect(await reservePrintIntent(db, '2026-09-13', 1)).toBe(true)
    expect(await reservePrintIntent(db, '2026-09-12', 1)).toBe(false)
    expect(await reservePrintIntent(db, '2026-09-13', 1)).toBe(false)
    expect(db.sql.prepare('SELECT * FROM print_intent_admission').all()).toEqual([{ id: 1, period_start: '2026-09-13', admissions: 1 }])
  })
  it('fails closed on invalid budget overrides and does not increase the fixed ceiling', async () => {
    expect(analyticsDailyAllowance({})).toBe(1000)
    for (const value of ['0', '1001', '-1', 'NaN', '1.2', '']) {
      env.ANALYTICS_DAILY_ALLOWANCE = value
      expect(analyticsDailyAllowance(env)).toBe(0)
      expect((await analyticsResponse(request(), env, now)).status).toBe(429)
    }
    expect(rows()).toEqual([])
  })
  it('rolls back the entire counter batch on failure without refunding admission', async () => {
    db.sql.exec("CREATE TRIGGER fail_job BEFORE INSERT ON print_intent_job_totals BEGIN SELECT RAISE(ABORT,'injected failure'); END")
    expect((await analyticsResponse(request(payload('print-job-requested', [label, { catalogId: 'blend-b', quantity: 3 }])), env, now)).status).toBe(503)
    expect(rows()).toEqual([])
    expect(db.sql.prepare('SELECT admissions FROM print_intent_admission').get()).toEqual({ admissions: 1 })
  })
  it('stores only aggregate fields and counts repeated requests as separate actions', async () => {
    for (let i = 0; i < 2; i++) expect((await analyticsResponse(request(), env, now)).status).toBe(204)
    expect(rows()[0]).toMatchObject({ print_job_count: 2 })
    const columns = db.sql.prepare('PRAGMA table_info(print_intent_daily)').all().map(row => row.name)
    expect(columns).toEqual(['catalog_id', 'period_start', 'added_count', 'selected_count', 'quantity_count', 'print_job_count'])
    expect(JSON.stringify(rows())).not.toContain('203.0.113.5')
    expect(db.sql.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'print_intent_%' AND type='table'").all()).toHaveLength(3)
  })
})
