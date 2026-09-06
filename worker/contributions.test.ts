import { afterEach, expect, it, vi } from 'vitest'
import { CatalogContributions, contributionsResponse, type Storage } from './contributions'
import { TOBACCO_CATALOG } from '../src/lib/tobacco-catalog'
import type { DiagnosticsDatabase } from './diagnostics'
const source = { catalogId: TOBACCO_CATALOG[0].id, url: 'https://retailer.com/tin.png', status: 'valid', package: 'tin', variant: 'current' }
const contribution = { version: 1, submissionId: 'a'.repeat(64), feedback: null, sources: [source] }
function setup(database?: DiagnosticsDatabase) {
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
    transaction<T>(callback: (s: typeof storage) => Promise<T>): Promise<T> { const result = serial.then(() => callback(storage)); serial = result.catch(() => {}); return result },
  }
  const object = new CatalogContributions({ storage }, { DIAGNOSTICS: database })
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
  expect(state.data.size).toBe(0)
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
  state.data.set('report:two', { receivedAt: '2026-08-02T00:00:00.000Z', contribution: { ...contribution, submissionId: 'b'.repeat(64), sources: [{ ...source, catalogId: 'retired-catalog-entry' }] } })
  state.data.set('report:expired', { receivedAt: '2025-01-01T00:00:00.000Z', contribution: { ...contribution, submissionId: 'c'.repeat(64) } })
  const migrate = () => state.object.fetch(new Request('https://catalog/migrate', { method: 'POST' }))
  await expect(migrate()).rejects.toThrow('Interrupted')
  expect(state.data.has('diagnostics-migrated-v1')).toBe(false)
  fail = false
  expect(await (await migrate()).json()).toEqual({ status: 'migrated', copied: 2 })
  expect(rows.size).toBe(2)
  expect(rows.get(contribution.submissionId)?.slice(1,4)).toEqual(['2026-08-01T00:00:00.000Z', '2026-10-30T00:00:00.000Z', 'legacy'])
  expect(await (await migrate()).json()).toEqual({ status: 'already-migrated' })
})
