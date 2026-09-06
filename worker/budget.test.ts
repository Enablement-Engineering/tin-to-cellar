import { afterEach, expect, it, vi } from 'vitest'
import { ProofBudget, reserveProof } from './budget'

function storedBudget() {
  const data = new Map<string, unknown>()
  let serial = Promise.resolve<unknown>(undefined)
  const storage = {
    async get<T>(key: string): Promise<T | undefined> { return structuredClone(data.get(key)) as T | undefined },
    async put(key: string, value: unknown) { data.set(key, structuredClone(value)) },
    transaction<T>(callback: (s: typeof storage) => Promise<T>): Promise<T> {
      const result = serial.then(() => callback(storage)); serial = result.catch(() => {}); return result
    },
  }
  return { storage, data, create: () => new ProofBudget({ storage }) }
}
const request = () => new Request('https://budget/reserve', { method: 'POST' })
afterEach(() => vi.useRealTimers())

it('serializes concurrent reservations and retains the cap after object recreation', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06T01:00:00Z'))
  const state = storedBudget(), budget = state.create()
  const responses = await Promise.all(Array.from({ length: 60 }, () => budget.fetch(request())))
  expect(responses.filter(r => r.status === 204)).toHaveLength(30)
  expect(responses.filter(r => r.status === 429)).toHaveLength(30)
  expect((await state.create().fetch(request())).status).toBe(429)
  vi.setSystemTime(new Date('2026-09-06T01:01:00Z'))
  expect((await state.create().fetch(request())).status).toBe(204)
})

it('enforces day and month limits across minute/day rollovers', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06T01:00:00Z'))
  const state = storedBudget()
  state.data.set('usage', { minute: '2026-09-06T00:59', minuteCount: 30, day: '2026-09-06', dayCount: 200, month: '2026-09', monthCount: 2000 })
  expect((await state.create().fetch(request())).status).toBe(429)
  vi.setSystemTime(new Date('2026-09-07T01:00:00Z'))
  expect((await state.create().fetch(request())).status).toBe(429)
  vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
  expect((await state.create().fetch(request())).status).toBe(204)
  expect(state.data.size).toBe(1)
})

it('fails closed when shared allowance is absent or unreachable', async () => {
  expect((await reserveProof())?.status).toBe(503)
  expect((await reserveProof({ getByName: () => ({ fetch: async () => { throw new Error('offline') } }) }))?.status).toBe(503)
  expect((await reserveProof({ getByName: () => ({ fetch: async () => new Response(null, { status: 500 }) }) }))?.status).toBe(503)
})

it('enforces the daily cap independently and resets it at UTC midnight', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06T23:59:00Z'))
  const state = storedBudget()
  state.data.set('usage', { minute: '2026-09-06T23:58', minuteCount: 0, day: '2026-09-06', dayCount: 200, month: '2026-09', monthCount: 200 })
  const denied = await state.create().fetch(request())
  expect(denied.status).toBe(429)
  expect(denied.headers.get('Retry-After')).toBe('60')
  vi.setSystemTime(new Date('2026-09-07T00:00:00Z'))
  expect((await state.create().fetch(request())).status).toBe(204)
  expect(state.data.get('usage')).toMatchObject({ dayCount: 1, monthCount: 201 })
})
