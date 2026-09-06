import { afterEach, expect, it, vi } from 'vitest'
import { ProofBudget, reserveProof } from './budget'
import { tokenHash } from './access'

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
  data.set('leases', { ['a'.repeat(64)]: { expiresAt: Date.parse('2027-01-01'), remaining: 10000 } })
  return { storage, data, create: () => new ProofBudget({ storage }) }
}
const request = () => new Request('https://budget/reserve', { method: 'POST', headers: { 'X-Token-Hash': 'a'.repeat(64) } })
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
  state.data.set('usage', { minute: '2026-09-06T00:59', minuteCount: 30, day: '2026-09-06', dayCount: 200, month: '2026-09', monthCount: 1000 })
  expect((await state.create().fetch(request())).status).toBe(429)
  vi.setSystemTime(new Date('2026-09-07T01:00:00Z'))
  expect((await state.create().fetch(request())).status).toBe(429)
  vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
  expect((await state.create().fetch(request())).status).toBe(204)
  expect(state.data.size).toBe(2)
})

it('issues bounded credentials, rejects unknown/expired access, and serializes final uses', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06T01:00:00Z'))
  const state = storedBudget(), budget = state.create()
  state.data.delete('leases')
  expect((await budget.fetch(request())).status).toBe(401)
  const issued = await budget.fetch(new Request('https://budget/issue', { method: 'POST' }))
  const lease = await issued.json()
  expect(lease.token).toMatch(/^[a-f0-9]{64}$/)
  expect(lease.uses).toBe(60)
  const hash = await tokenHash(lease.token)
  expect(JSON.stringify([...state.data])).not.toContain(lease.token)
  state.data.set('leases', { [hash]: { expiresAt: lease.expiresAt, remaining: 2 } })
  const consume = () => new Request('https://budget/reserve', { method: 'POST', headers: { 'X-Token-Hash': hash } })
  const results = await Promise.all(Array.from({ length: 10 }, () => budget.fetch(consume())))
  expect(results.filter(r => r.status === 204)).toHaveLength(2)
  expect(results.filter(r => r.status === 401)).toHaveLength(8)
  state.data.set('leases', { [hash]: { expiresAt: lease.expiresAt, remaining: 60 } })
  vi.setSystemTime(lease.expiresAt)
  expect((await budget.fetch(consume())).status).toBe(401)
})

it('bounds credential issuance and prunes expired hashes', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-06T01:00:00Z'))
  const state = storedBudget(), budget = state.create()
  state.data.set('leases', { old: { expiresAt: 0, remaining: 60 } })
  const issue = () => budget.fetch(new Request('https://budget/issue', { method: 'POST' }))
  for (let i = 0; i < 5; i++) expect((await issue()).status).toBe(200)
  expect((await issue()).status).toBe(429)
  expect(state.data.get('leases')).not.toHaveProperty('old')
  state.data.set('issuance', { minute: '', day: '2026-09-06', month: '2026-09', minuteCount: 0, dayCount: 20, monthCount: 20 })
  expect((await issue()).status).toBe(429)
  state.data.set('issuance', { minute: '', day: '', month: '2026-09', minuteCount: 0, dayCount: 0, monthCount: 200 })
  expect((await issue()).status).toBe(429)
})

it('fails closed when shared allowance is absent or unreachable', async () => {
  expect((await reserveProof())?.status).toBe(503)
  expect((await reserveProof({ getByName: () => ({ fetch: async () => { throw new Error('offline') } }) }, 'test'))?.status).toBe(503)
  expect((await reserveProof({ getByName: () => ({ fetch: async () => new Response(null, { status: 500 }) }) }, 'test'))?.status).toBe(503)
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
