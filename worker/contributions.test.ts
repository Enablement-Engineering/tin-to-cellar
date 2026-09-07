import { afterEach, expect, it, vi } from 'vitest'
import { CatalogContributions, contributionsResponse, type Storage } from './contributions'
import { TOBACCO_CATALOG } from '../src/lib/tobacco-catalog'
import type { DiagnosticsDatabase } from './diagnostics'
const source = { catalogId: TOBACCO_CATALOG[0].id, url: TOBACCO_CATALOG[0].sourceUrl, status: 'valid', package: 'tin', variant: 'current' }
const contribution = { version: 1, submissionId: 'a'.repeat(64), feedback: null, sources: [source] }
function setup(database?: DiagnosticsDatabase, config = {}) {
  const data = new Map<string, unknown>()
  let alarm: number | null = null
  let serial = Promise.resolve<unknown>(undefined)
  const storage: Storage = {
    async get<T>(key: string): Promise<T | undefined> { return structuredClone(data.get(key)) as T | undefined },
    async put(key: string, value: unknown) { data.set(key, structuredClone(value)) },
    async delete(key: string) { return data.delete(key) },
    async list<T>({ prefix, limit }: { prefix: string; limit: number }) { return new Map([...data].filter(([key]) => key.startsWith(prefix)).slice(0, limit)) as Map<string, T> },
    async getAlarm() { return alarm },
    async setAlarm(time: number) { alarm = time },
    transaction<T>(callback: (s: typeof storage) => Promise<T>): Promise<T> { const result = serial.then(async () => { const snapshot = structuredClone(data); try { return await callback(storage) } catch (error) { data.clear(); for (const [key, value] of snapshot) data.set(key, value); throw error } }); serial = result.catch(() => {}); return result },
  }
  const object = new CatalogContributions({ storage }, { DIAGNOSTICS: database, ...config })
  return { object, data, storage, binding: { getByName: () => object } }
}
const post = (body = contribution) => new Request('https://catalog/collect', { method: 'POST', body: JSON.stringify(body) })
const get = () => new Request(`https://catalog/sources?catalogId=${source.catalogId}`)
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('persists duplicate-safe contributions and removes failed links from suggestions without fetching them', async () => {
  const state = setup()
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
  const results = await Promise.all([state.object.fetch(post()), state.object.fetch(post())])
  expect(await results[0].json()).toEqual({ status: 'collected' })
  expect(await results[1].json()).toEqual({ status: 'duplicate' })
  expect((await (await new CatalogContributions({ storage: state.storage }).fetch(get())).json()).sources).toHaveLength(1)
  await state.object.fetch(post({ ...contribution, submissionId: 'b'.repeat(64), sources: [{ ...source, status: 'unavailable' }] }))
  expect((await (await state.object.fetch(get())).json()).sources).toEqual([])
  expect(fetchMock).not.toHaveBeenCalled()
})
it('excludes expired sources and cleans records without postponing the alarm on each import', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06'))
  const state = setup()
  await state.object.fetch(post())
  const alarm = await state.storage.getAlarm()
  vi.setSystemTime(new Date('2026-09-06T12:00Z'))
  await state.object.fetch(post())
  expect(await state.storage.getAlarm()).toBe(alarm)
  vi.setSystemTime(new Date('2027-01-01'))
  expect((await (await state.object.fetch(get())).json()).sources).toEqual([])
  await state.object.alarm()
  expect(state.data).toEqual(new Map([['report-count-v1', 0]]))
})
it('guards collection size, origin, schema, rate limits, and private exports', async () => {
  const state = setup()
  const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) }
  const request = (body: unknown, origin = 'https://site.com') => new Request('https://site.com/api/labels/contributions', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  expect((await contributionsResponse(request(contribution, 'https://other.com'), state.binding, limiter)).status).toBe(403)
  expect((await contributionsResponse(request({ ...contribution, private: 'extra' }), state.binding, limiter)).status).toBe(400)
  expect((await contributionsResponse(request({ huge: 'a'.repeat(65536) }), state.binding, limiter)).status).toBe(413)
  expect((await contributionsResponse(request(contribution), state.binding, limiter)).status).toBe(200)
  expect((await contributionsResponse(new Request('https://site.com/api/labels/contributions'), state.binding, limiter)).status).toBe(403)
  const exported = await contributionsResponse(new Request('https://site.com/api/labels/contributions', { headers: { Authorization: 'Bearer secret' } }), state.binding, limiter, 'secret')
  expect((await exported.json()).reports).toHaveLength(1)
  limiter.limit.mockResolvedValue({ success: false })
  expect((await contributionsResponse(request(contribution), state.binding, limiter)).status).toBe(429)
})
it('allows a new pack to report a recovered link while reimporting an old pack cannot undo a failure', async () => {
  const state = setup()
  await state.object.fetch(post())
  await state.object.fetch(post({ ...contribution, submissionId: 'b'.repeat(64), sources: [{ ...source, status: 'unavailable' }] }))
  await state.object.fetch(post())
  expect((await (await state.object.fetch(get())).json()).sources).toEqual([])
  await state.object.fetch(post({ ...contribution, submissionId: 'c'.repeat(64) }))
  expect((await (await state.object.fetch(get())).json()).sources).toHaveLength(1)
})
it('migrates retained legacy records before new collection and only marks completion after successful writes', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06'))
  const rows = new Map<string, unknown[]>()
  let fail = true
  const db: DiagnosticsDatabase = { prepare() {
    let values: unknown[] = []
    const statement = { bind(...v: unknown[]) { values = v; return statement }, async run() {
      if (fail && rows.size === 1) throw new Error('Interrupted')
      const id = String(values[0]); const changed = !rows.has(id)
      if (changed) rows.set(id, values)
      return { meta: { changes: changed ? 1 : 0 } }
    }, async first<T>() { return null as T | null }, async all<T>() { return { results: [] as T[] } } }
    return statement
  }, async batch(statements) { return Promise.all(statements.map(statement => statement.run())) } }
  const state = setup(db)
  state.data.set('report:one', { receivedAt: '2026-08-01T00:00:00.000Z', contribution })
  state.data.set('report:two', { receivedAt: '2026-08-02T00:00:00.000Z', contribution: { ...contribution, submissionId: 'b'.repeat(64), sources: [{ ...source, catalogId: 'retired-catalog-entry' }], feedback: { format: 'tin-to-cellar/feedback', schemaVersion: '2.0.0', protocolRevision: 12, request: { labelCount: 1, shape: 'circle' }, outcome: 'complete', steps: [], issues: [] } } })
  state.data.set('report:expired', { receivedAt: '2025-01-01T00:00:00.000Z', contribution: { ...contribution, submissionId: 'c'.repeat(64) } })
  state.data.set('report-count-v1', 3)
  const migrate = () => state.object.fetch(new Request('https://catalog/migrate', { method: 'POST' }))
  await expect(migrate()).rejects.toThrow('Interrupted')
  expect(state.data.has('diagnostics-migrated-v1')).toBe(false)
  expect(state.data.get('report-count-v1')).toBe(3)
  fail = false
  expect(await (await migrate()).json()).toEqual({ status: 'migrated', copied: 2 })
  expect(rows.size).toBe(2)
  expect(JSON.parse(String(rows.get('b'.repeat(64))?.[4])).protocolRevision).toBe(12)
  expect(rows.get(contribution.submissionId)?.slice(1,4)).toEqual(['2026-08-01T00:00:00.000Z', '2026-10-30T00:00:00.000Z', 'legacy'])
  expect(await (await migrate()).json()).toEqual({ status: 'already-migrated' })
  expect(state.data.get('report-count-v1')).toBe(3)
  await state.object.alarm()
  expect(state.data.get('report-count-v1')).toBe(2)
})

it('identifies an unconfigured collection service separately from transient failure', async () => {
  const response = await contributionsResponse(new Request('https://site.com/api/labels/contributions', { method: 'POST' }))
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ error: 'Collection is unavailable', code: 'collection_unconfigured' })
})

it('admits only the daily allowance under concurrent requests and retains the exhaustion event after UTC rollover', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-07T23:59:00Z'))
  const state = setup(undefined, { DIAGNOSTIC_DAILY_ALLOWANCE: '2' })
  const admit = () => state.object.fetch(new Request('https://catalog/budget', { method: 'POST' }))
  const results = await Promise.all(Array.from({ length: 10 }, admit))
  expect(results.filter(result => result.ok)).toHaveLength(2)
  const denied = results.find(result => !result.ok)!
  expect(denied.status).toBe(429)
  expect(denied.headers.get('Retry-After')).toBe('60')
  expect(await denied.json()).toEqual({ code: 'collection_paused', error: 'Diagnostic sharing is paused for today.', resetAt: '2026-09-08T00:00:00.000Z' })
  vi.setSystemTime(new Date('2026-09-08T00:01:00Z'))
  expect((await admit()).status).toBe(200)
  const status = await (await state.object.fetch(new Request('https://catalog/budget'))).json()
  expect(status).toEqual({ version: 1, day: '2026-09-08', used: 1, limit: 2, paused: false, resetAt: '2026-09-09T00:00:00.000Z', lastPausedAt: '2026-09-07T23:59:00.000Z' })
  expect(state.data.size).toBe(1)
})
it('fails closed for disabled and invalid diagnostic allowances without reservations', async () => {
  for (const config of [{ DIAGNOSTIC_COLLECTION_ENABLED: 'false' }, { DIAGNOSTIC_DAILY_ALLOWANCE: '0' }, { DIAGNOSTIC_DAILY_ALLOWANCE: 'garbage' }, { DIAGNOSTIC_COLLECTION_ENABLED: 'yes' }]) {
    const state = setup(undefined, config)
    const response = await state.object.fetch(new Request('https://catalog/budget', { method: 'POST' }))
    expect(response.status).toBe(503)
    expect(state.data.size).toBe(0)
  }
})
it('validates contributions before reserving allowance and blocks persistence after exhaustion', async () => {
  const state = setup(undefined, { DIAGNOSTIC_DAILY_ALLOWANCE: '1' })
  const limiter = { limit: async () => ({ success: true }) }
  const request = (body: unknown, origin = 'https://site.com') => new Request('https://site.com/api/labels/contributions', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  expect((await contributionsResponse(request(contribution, 'https://other.com'), state.binding, limiter)).status).toBe(403)
  expect((await contributionsResponse(request({ invalid: true }), state.binding, limiter)).status).toBe(400)
  expect(state.data.size).toBe(0)
  expect((await contributionsResponse(request(contribution), state.binding, limiter)).status).toBe(200)
  expect((await contributionsResponse(request({ ...contribution, submissionId: 'b'.repeat(64) }), state.binding, limiter)).status).toBe(429)
  expect(state.data.has('report:' + 'b'.repeat(64))).toBe(false)
})
it('prevalidates and separately rate-limits public source reads before storage', async () => {
  const fetch = vi.fn(async () => Response.json({ sources: [] }))
  const binding = { getByName: () => ({ fetch }) }
  const denied = { limit: vi.fn(async () => ({ success: false })) }
  expect((await contributionsResponse(new Request('https://site.com/api/labels/sources?catalogId=invalid'), binding, undefined, undefined, undefined, denied)).status).toBe(404)
  expect(denied.limit).not.toHaveBeenCalled()
  expect((await contributionsResponse(new Request(`https://site.com/api/labels/sources?catalogId=${source.catalogId}`), binding, undefined, undefined, undefined, denied)).status).toBe(429)
  expect(fetch).not.toHaveBeenCalled()
})
it('rejects unfamiliar shared URLs before allowance and suppresses previously stored private paths', async () => {
  const state = setup()
  const body = { ...contribution, sources: [{ ...source, url: 'https://retailer.com/customer/alice/tin.png' }] }
  const response = await contributionsResponse(new Request('https://site.com/api/labels/contributions', { method: 'POST', headers: { Origin: 'https://site.com', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), state.binding, { limit: async () => ({ success: true }) })
  expect(response.status).toBe(400)
  expect(state.data.size).toBe(0)
  state.data.set(`sources:${source.catalogId}`, [{ ...body.sources[0], checkedAt: new Date().toISOString() }, { ...source, checkedAt: new Date().toISOString() }])
  expect((await (await state.object.fetch(get())).json()).sources).toEqual([{ ...source, checkedAt: expect.any(String) }])
})
it('shares the same daily pool between reports and optional notes', async () => {
  const { shareNotes } = await import('./diagnostics')
  const state = setup(undefined, { DIAGNOSTIC_DAILY_ALLOWANCE: '1' })
  const limiter = { limit: async () => ({ success: true }) }
  expect((await contributionsResponse(new Request('https://site.com/api/labels/contributions', { method: 'POST', headers: { Origin: 'https://site.com', 'Content-Type': 'application/json' }, body: JSON.stringify(contribution) }), state.binding, limiter)).status).toBe(200)
  const write = vi.fn(async () => ({ meta: { changes: 1 } }))
  const statement = { bind: () => statement, run: write, async first<T>() { return { feedback: JSON.stringify({ protocolRevision: '0.0.16' }) } as T }, async all<T>() { return { results: [] as T[] } } }
  const db = { prepare: () => statement, batch: async () => [] }
  const notes = { format: 'tin-to-cellar/retrospective', schemaVersion: '0.1.0', protocolRevision: '0.0.16', capabilities: { browsing: 'available' }, tools: [], observations: [{ stage: 'packaging', kind: 'helped', explanation: 'The builder produced the archive successfully.' }] }
  const request = new Request('https://site.com/api/labels/process-notes', { method: 'POST', headers: { Origin: 'https://site.com', 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: contribution.submissionId, retrospective: notes }) })
  expect((await shareNotes(request, db, limiter, state.binding)).status).toBe(429)
  expect(write).not.toHaveBeenCalled()
})
it('fails closed rather than resetting corrupt allowance state or exposing stored metadata', async () => {
  const { admitDiagnostics, budgetStatus } = await import('./diagnostic-budget')
  for (const saved of [null, false, { day: 'invalid', used: 1 }, { day: '2026-02-30', used: 1 }, { day: '2999-01-01', used: 1 }, { day: '2026-01-01', used: -1 }, { day: '2026-01-01', used: 1, lastPausedAt: 'private data' }]) {
    const state = setup()
    state.data.set('diagnostic-budget-v1', saved)
    expect((await admitDiagnostics(state.binding))?.status).toBe(503)
    const status = await budgetStatus(new Request('https://site.com/api/labels/diagnostics/budget', { headers: { Authorization: 'Bearer read-token' } }), state.binding, 'read-token')
    expect(status.status).toBe(503)
    expect(await status.text()).not.toContain('private data')
    expect(state.data.get('diagnostic-budget-v1')).toEqual(saved)
  }
  const broken = { getByName: () => ({ fetch: async (): Promise<Response> => { throw new Error('Offline') } }) }
  expect((await admitDiagnostics(broken))?.status).toBe(503)
  expect((await admitDiagnostics())?.status).toBe(503)
})

it('initializes the retained count from legacy storage once and performs no warm admission scans', async () => {
  const state = setup()
  state.data.set('report:' + 'b'.repeat(64), { receivedAt: new Date().toISOString(), contribution: { ...contribution, submissionId: 'b'.repeat(64) } })
  const list = vi.spyOn(state.storage, 'list')
  expect((await state.object.fetch(post())).status).toBe(200)
  expect(state.data.get('report-count-v1')).toBe(2)
  expect(list).toHaveBeenCalledExactlyOnceWith({ prefix: 'report:', limit: 1001 })
  list.mockClear()
  await state.object.fetch(post())
  await new CatalogContributions({ storage: state.storage }).fetch(post({ ...contribution, submissionId: 'c'.repeat(64) }))
  expect(state.data.get('report-count-v1')).toBe(3)
  expect(list).not.toHaveBeenCalled()
})
it('enforces retained capacity under concurrent insertion without counting duplicates', async () => {
  const state = setup()
  for (let n = 0; n < 999; n++) state.data.set(`report:${n.toString(16).padStart(64, '0')}`, { receivedAt: new Date().toISOString(), contribution })
  const responses = await Promise.all(['a', 'b', 'c'].map(letter => state.object.fetch(post({ ...contribution, submissionId: letter.repeat(64) }))))
  expect(responses.filter(response => response.ok)).toHaveLength(1)
  expect(responses.filter(response => response.status === 503)).toHaveLength(2)
  expect(state.data.get('report-count-v1')).toBe(1000)
  expect([...state.data.keys()].filter(key => key.startsWith('report:'))).toHaveLength(1000)
  expect(await (await state.object.fetch(post())).json()).toEqual({ status: 'duplicate' })
  expect(state.data.get('report-count-v1')).toBe(1000)
})
it('keeps expiry and inserts atomic and repeated alarms do not decrement twice', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06'))
  const state = setup()
  await state.object.fetch(post())
  vi.setSystemTime(new Date('2027-01-01'))
  await Promise.all([state.object.alarm(), state.object.fetch(post({ ...contribution, submissionId: 'b'.repeat(64) }))])
  expect(state.data.get('report-count-v1')).toBe(1)
  expect(state.data.has('report:' + contribution.submissionId)).toBe(false)
  expect(state.data.has('report:' + 'b'.repeat(64))).toBe(true)
  expect((await (await state.object.fetch(get())).json()).sources).toHaveLength(1)
  await state.object.alarm()
  expect(state.data.get('report-count-v1')).toBe(1)
})
it('rolls back report and count together when persistence is interrupted', async () => {
  const state = setup()
  await state.object.fetch(post())
  const originalPut = state.storage.put.bind(state.storage)
  vi.spyOn(state.storage, 'put').mockImplementation(async (key, value) => {
    if (key.startsWith('sources:')) throw new Error('Interrupted source write')
    await originalPut(key, value)
  })
  await expect(state.object.fetch(post({ ...contribution, submissionId: 'b'.repeat(64) }))).rejects.toThrow('Interrupted source write')
  expect(state.data.get('report-count-v1')).toBe(1)
  expect(state.data.has('report:' + 'b'.repeat(64))).toBe(false)
})
it('fails closed for invalid retained counters and unexpected oversized legacy storage', async () => {
  for (const count of [null, '1', -1, 1.5, 1001]) {
    const state = setup()
    state.data.set('report-count-v1', count)
    await expect(state.object.fetch(post())).rejects.toThrow('Invalid retained report count')
    expect(state.data.has('report:' + contribution.submissionId)).toBe(false)
  }
  const state = setup()
  for (let n = 0; n < 1001; n++) state.data.set(`report:${n}`, { receivedAt: new Date().toISOString(), contribution })
  await expect(state.object.fetch(post())).rejects.toThrow('Retained report capacity exceeded')
  expect(state.data.has('report-count-v1')).toBe(false)
})
it('detects counter drift during retention without deleting reports', async () => {
  const state = setup()
  state.data.set('report-count-v1', 0)
  state.data.set('report:legacy', { receivedAt: '2020-01-01T00:00:00.000Z', contribution })
  await expect(state.object.alarm()).rejects.toThrow('Invalid retained report count')
  expect(state.data.has('report:legacy')).toBe(true)
})
it('preserves a source refreshed after the alarm snapshot', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06'))
  const state = setup()
  await state.object.fetch(post())
  vi.setSystemTime(new Date('2027-01-01'))
  const originalList = state.storage.list.bind(state.storage)
  vi.spyOn(state.storage, 'list').mockImplementation(async options => {
    const snapshot = await originalList(options)
    if (options.prefix === 'sources:') await state.object.fetch(post({ ...contribution, submissionId: 'b'.repeat(64) }))
    return snapshot
  })
  await state.object.alarm()
  expect(state.data.get('report-count-v1')).toBe(1)
  expect((await (await state.object.fetch(get())).json()).sources).toEqual([{ ...source, checkedAt: '2027-01-01T00:00:00.000Z' }])
})
it('rolls back expired deletions if updating their count fails', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06'))
  const state = setup()
  await state.object.fetch(post())
  vi.setSystemTime(new Date('2027-01-01'))
  const originalPut = state.storage.put.bind(state.storage)
  vi.spyOn(state.storage, 'put').mockImplementation(async (key, value) => {
    if (key === 'report-count-v1') throw new Error('Interrupted count write')
    await originalPut(key, value)
  })
  await expect(state.object.alarm()).rejects.toThrow('Interrupted count write')
  expect(state.data.get('report-count-v1')).toBe(1)
  expect(state.data.has('report:' + contribution.submissionId)).toBe(true)
})
