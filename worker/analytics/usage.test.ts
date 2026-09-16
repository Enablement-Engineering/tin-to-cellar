// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DB } from './test-db'
import { usageResponse, cleanUsage, type UsageEnv } from './usage'
import { usageAdminResponse } from './admin'
import { analyticsResponse } from './index'
import { parseUsage, parseProgress, cohortWeek } from '../../src/lib/analytics/events'
let db: DB, env: UsageEnv
const now = new Date('2026-09-16T12:00:00Z')
const event = { version: 2, event: 'instructions-copy-result', outcome: 'copied' }
const input = (body: unknown = event, path = 'events') => new Request(`https://tintocellar.com/api/analytics/v2/${path}`, { method: 'POST', headers: { Origin: 'https://tintocellar.com', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
beforeEach(() => { db = new DB(); env = { GALLERY: db, ANALYTICS_ENABLED: 'true', WORKFLOW_ANALYTICS_ENABLED: 'true', PROGRESS_ANALYTICS_ENABLED: 'true', ANALYTICS_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) } } })
afterEach(() => db.sql.close())
it('only accepts bounded fixed fields and Monday cohorts, never identifiers or text', () => {
  expect(parseUsage(event)).toEqual(event)
  for (const bad of [{ ...event, requestId: 'secret' }, { ...event, outcome: 'secret' }, { ...event, event: '__proto__' }, { ...event, version: 1 }]) expect(parseUsage(bad)).toBeNull()
  const progress = { version: 2, cohort: '2026-09-14', milestone: 'started', elapsed: 'same-day' }
  expect(parseProgress(progress, now)).toEqual(progress)
  for (const bad of [{ ...progress, cohort: '2026-09-15' }, { ...progress, cohort: '2026-09-21' }, { ...progress, cohort: '2026-02-30' }, { ...progress, elapsed: '8-14-days' }, { ...progress, requestId: 'secret' }]) expect(parseProgress(bad, now)).toBeNull()
  expect(cohortWeek(new Date('2026-09-20T23:59:00Z'))).toBe('2026-09-14')
})
it('stores aggregates only and preserves independent collection flags', async () => {
  expect(await (await usageResponse(input(), env, now)).json()).toEqual({ recorded: true })
  expect(await (await usageResponse(input(), { ...env, WORKFLOW_ANALYTICS_ENABLED: 'false' }, now)).json()).toEqual({ recorded: false })
  const progress = { version: 2, cohort: '2026-09-14', milestone: 'started', elapsed: 'same-day' }
  expect(await (await usageResponse(input(progress,'progress'), env, now)).json()).toEqual({ recorded: true })
  expect(db.sql.prepare('SELECT * FROM usage_event_daily').all()).toEqual([{ period_start: '2026-09-16', event: 'instructions-copy-result', outcome: 'copied', count: 1 }])
  expect(db.sql.prepare('SELECT * FROM usage_progress').all()).toEqual([{ cohort: '2026-09-14', milestone: 'started', elapsed: 'same-day', count: 1 }])
})
it('remembers exhausted admissions when the final write fails, even after day rollover', async () => {
  env.ANALYTICS_DAILY_ALLOWANCE = '1'
  db.sql.exec("CREATE TRIGGER fail_usage BEFORE INSERT ON usage_event_daily BEGIN SELECT RAISE(ABORT,'fixture'); END")
  expect((await usageResponse(input(), env, now)).status).toBe(503)
  expect(db.sql.prepare('SELECT admitted,recorded,allowance_reached FROM usage_collection_daily').get()).toEqual({ admitted: 1, recorded: 0, allowance_reached: 1 })
  expect((await usageResponse(input(), env, now)).status).toBe(429)
  db.sql.exec('DROP TRIGGER fail_usage')
  expect((await usageResponse(input(), env, new Date('2026-09-17T12:00:00Z'))).status).toBe(200)
  expect(db.sql.prepare('SELECT period_start,admitted,recorded FROM usage_collection_daily ORDER BY period_start').all()).toEqual([{ period_start: '2026-09-16', admitted: 1, recorded: 0 }, { period_start: '2026-09-17', admitted: 1, recorded: 1 }])
})
it('shares the daily allowance across workflow, progress, and canonical demand', async () => {
  env.ANALYTICS_DAILY_ALLOWANCE = '2'
  await usageResponse(input(), env, now)
  expect((await analyticsResponse(input({ version: 2, event: 'added-to-labels', labels: [{ catalogId: 'blend-a', quantity: 1 }] },'print-intent'), env, now)).status).toBe(200)
  expect((await usageResponse(input({ version: 2, cohort: '2026-09-14', milestone: 'started', elapsed: 'same-day' },'progress'), env, now)).status).toBe(429)
})
it('reports while ingestion is off and never substitutes zeros for a missing schema', async () => {
  await usageResponse(input(), env, now)
  const response = await usageAdminResponse(new Request('https://admin.tintocellar.com/api/analytics/v2/admin/summary?days=30'), { ...env, ANALYTICS_ENABLED: 'false' }, now)
  const value = await response.json() as { events: unknown[]; capabilities: { demandEnabled: boolean } }
  expect(value.events).toHaveLength(1); expect(value.capabilities.demandEnabled).toBe(false)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  db.sql.exec('DROP TABLE usage_progress')
  expect((await usageAdminResponse(new Request('https://admin.tintocellar.com/api/analytics/v2/admin/summary'), env, now)).status).toBe(503)
})
it('validates report parameters and bounds artwork rankings', async () => {
  expect((await usageAdminResponse(new Request('https://admin.tintocellar.com/api/analytics/v2/admin/blends?metric=DROP'), env, now)).status).toBe(400)
  expect((await usageAdminResponse(new Request('https://admin.tintocellar.com/api/analytics/v2/admin/summary?days=999'), env, now)).status).toBe(400)
  await analyticsResponse(input({ version: 2, event: 'added-to-labels', labels: [{ catalogId: 'blend-a', quantity: 1 }] },'print-intent'), env, now)
  const body = await (await usageAdminResponse(new Request('https://admin.tintocellar.com/api/analytics/v2/admin/blends?availability=missing'), env, now)).json() as { blends: { artwork: number }[] }
  expect(body.blends).toHaveLength(1); expect(body.blends[0].artwork).toBe(0)
})
it('expires only out-of-window aggregates while ingestion is disabled', async () => {
  db.sql.exec("INSERT INTO usage_event_daily VALUES('2025-01-01','print-requested','requested',7),('2026-09-16','print-requested','requested',2)")
  await cleanUsage({ ...env, ANALYTICS_ENABLED: 'false' }, now)
  expect(db.sql.prepare('SELECT count FROM usage_event_daily').all()).toEqual([{ count: 2 }])
  expect(db.sql.prepare('SELECT failed FROM usage_cleanup').get()).toEqual({ failed: 0 })
  expect(db.sql.prepare('SELECT COUNT(*) n FROM gallery_tobaccos').get()).toEqual({ n: 3 })
})
it('keeps published artwork available for historical demand on an inactive catalog blend', async () => {
  await analyticsResponse(input({ version: 2, event: 'added-to-labels', labels: [{ catalogId: 'blend-a', quantity: 1 }] },'print-intent'), env, now)
  db.sql.exec("UPDATE gallery_tobaccos SET active=0 WHERE id='blend-a'; INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,catalog_id,input_bytes,quota_key) VALUES('published-fixture','','','published','2026-09-16','2027-09-16','blend-a',1,'test')")
  const get = async (query: string) => (await (await usageAdminResponse(new Request(`https://admin.tintocellar.com/api/analytics/v2/admin/blends${query}`), env, now)).json()) as { blends: { artwork: number }[] }
  expect((await get('')).blends[0].artwork).toBe(1)
  expect((await get('?availability=missing')).blends).toEqual([])
})
it('includes complete intersecting starting weeks and exposes admission blocking after allowance reductions', async () => {
  db.sql.exec("INSERT INTO usage_progress VALUES('2026-09-07','started','same-day',1)")
  await usageResponse(input(), env, now)
  for (const allowance of ['1','0']) {
    const body = await (await usageAdminResponse(new Request('https://admin.tintocellar.com/api/analytics/v2/admin/summary?days=7'), { ...env, ANALYTICS_DAILY_ALLOWANCE: allowance }, now)).json() as { cohortFrom: string; progress: unknown[]; admissionBlockedNow: boolean; collection: { allowance_reached: number }[] }
    expect(body.cohortFrom).toBe('2026-09-07')
    expect(body.progress).toHaveLength(1)
    expect(body.admissionBlockedNow).toBe(true)
    expect(body.collection[0].allowance_reached).toBe(0)
  }
})
it('excludes an expired boundary cohort from 365-day reports before cleanup runs', async () => {
  db.sql.exec("INSERT INTO usage_progress VALUES('2025-09-15','started','same-day',8),('2025-09-22','started','same-day',2)")
  const body = await (await usageAdminResponse(new Request('https://admin.tintocellar.com/api/analytics/v2/admin/summary?days=365'), env, now)).json() as { cohortFrom: string; cohortBoundaryExpired: boolean; progress: { count: number }[] }
  expect(body.cohortFrom).toBe('2025-09-22')
  expect(body.cohortBoundaryExpired).toBe(true)
  expect(body.progress.map(r => r.count)).toEqual([2])
})
