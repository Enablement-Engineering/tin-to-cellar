import { tokenHash } from './access'
// One named Durable Object coordinates every hostname, IP, and edge location.
type Lease = { expiresAt: number; remaining: number }
type Counts = { minute: string; minuteCount: number; day: string; dayCount: number; month: string; monthCount: number }
interface Storage {
  get<T>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  transaction<T>(callback: (storage: Storage) => Promise<T>): Promise<T>
}
export interface BudgetBinding { getByName(name: string): { fetch(request: Request): Promise<Response> } }
export class ProofBudget {
  constructor(private ctx: { storage: Storage }) {}
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname
    if (request.method !== 'POST' || !['/reserve', '/issue'].includes(path)) return new Response(null, { status: 404 })
    const now = new Date()
    const stamp = now.toISOString()
    const minute = stamp.slice(0, 16), day = stamp.slice(0, 10), month = stamp.slice(0, 7)
    if (path === '/issue') {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
      const hash = await tokenHash(token)
      return this.ctx.storage.transaction(async storage => {
        const prior = await storage.get<Counts>('issuance')
        const minuteCount = prior?.minute === minute ? prior.minuteCount : 0
        const dayCount = prior?.day === day ? prior.dayCount : 0
        const monthCount = prior?.month === month ? prior.monthCount : 0
        if (minuteCount >= 5 || dayCount >= 20 || monthCount >= 200) return Response.json({ error: 'Hosted check access is at capacity. Use local guides.' }, { status: 429, headers: { 'Retry-After': '3600' } })
        const leases = await storage.get<Record<string, Lease>>('leases') ?? {}
        for (const [key, lease] of Object.entries(leases)) if (lease.expiresAt <= now.getTime()) delete leases[key]
        const expiresAt = now.getTime() + 24 * 60 * 60 * 1000
        leases[hash] = { expiresAt, remaining: 60 }
        await storage.put('leases', leases)
        await storage.put('issuance', { minute, day, month, minuteCount: minuteCount + 1, dayCount: dayCount + 1, monthCount: monthCount + 1 })
        return Response.json({ token, expiresAt, uses: 60 })
      })
    }
    const hash = request.headers.get('X-Token-Hash') ?? ''
    if (!/^[a-f0-9]{64}$/.test(hash)) return new Response(null, { status: 401 })
    const result = await this.ctx.storage.transaction(async (storage) => {
      const leases = await storage.get<Record<string, Lease>>('leases') ?? {}
      const lease = leases[hash]
      if (!lease || lease.expiresAt <= now.getTime() || lease.remaining <= 0) return -1
      const prior = await storage.get<Counts>('usage')
      const counts: Counts = {
        minute, minuteCount: prior?.minute === minute ? prior.minuteCount : 0,
        day, dayCount: prior?.day === day ? prior.dayCount : 0,
        month, monthCount: prior?.month === month ? prior.monthCount : 0,
      }
      // Reserve before rendering; failed native operations are deliberately not refunded.
      if (counts.monthCount >= 1000) return Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - now.getTime()) / 1000)
      if (counts.dayCount >= 200) return Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000)
      if (counts.minuteCount >= 30) return 60 - now.getUTCSeconds()
      counts.minuteCount++; counts.dayCount++; counts.monthCount++
      lease.remaining--
      await storage.put('leases', leases)
      await storage.put('usage', counts)
      return 0
    })
    return result === -1 ? new Response(null, { status: 401 }) : result ? new Response(null, { status: 429, headers: { 'Retry-After': String(result) } }) : new Response(null, { status: 204 })
  }
}

export async function reserveProof(binding?: BudgetBinding, token?: string): Promise<Response | null> {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  try {
    if (!binding) throw new Error('missing budget')
    if (!token) return Response.json({ error: 'Enable hosted image checks on the website and copy a new prompt, or use local guides.' }, { status: 401, headers })
    const response = await binding.getByName('proof-budget-v1').fetch(new Request('https://budget/reserve', { method: 'POST', headers: { 'X-Token-Hash': await tokenHash(token) } }))
    if (response.status === 401) return Response.json({ error: 'Proof access expired or exhausted. Use local guides or get fresh access from the website.' }, { status: 401, headers })
    if (response.status === 204) return null
    if (response.status === 429) return Response.json({ error: 'Shared proof allowance reached. Create review guides locally.' }, { status: 429, headers: { ...headers, 'Retry-After': response.headers.get('Retry-After') ?? '60' } })
  } catch { /* Missing or unavailable budget must never allow image processing. */ }
  return Response.json({ error: 'Proof allowance unavailable. Create review guides locally.' }, { status: 503, headers })
}
