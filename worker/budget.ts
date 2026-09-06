// One named Durable Object coordinates every hostname, IP, and edge location.
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
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/reserve') return new Response(null, { status: 404 })
    const now = new Date()
    const stamp = now.toISOString()
    const minute = stamp.slice(0, 16), day = stamp.slice(0, 10), month = stamp.slice(0, 7)
    const result = await this.ctx.storage.transaction(async (storage) => {
      const prior = await storage.get<Counts>('usage')
      const counts: Counts = {
        minute, minuteCount: prior?.minute === minute ? prior.minuteCount : 0,
        day, dayCount: prior?.day === day ? prior.dayCount : 0,
        month, monthCount: prior?.month === month ? prior.monthCount : 0,
      }
      // Reserve before rendering; failed native operations are deliberately not refunded.
      if (counts.monthCount >= 2000) return Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - now.getTime()) / 1000)
      if (counts.dayCount >= 200) return Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime()) / 1000)
      if (counts.minuteCount >= 30) return 60 - now.getUTCSeconds()
      counts.minuteCount++; counts.dayCount++; counts.monthCount++
      await storage.put('usage', counts)
      return 0
    })
    return result ? new Response(null, { status: 429, headers: { 'Retry-After': String(result) } }) : new Response(null, { status: 204 })
  }
}

export async function reserveProof(binding?: BudgetBinding): Promise<Response | null> {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  try {
    if (!binding) throw new Error('missing budget')
    const response = await binding.getByName('proof-budget-v1').fetch(new Request('https://budget/reserve', { method: 'POST' }))
    if (response.status === 204) return null
    if (response.status === 429) return Response.json({ error: 'Shared proof allowance reached. Create review guides locally.' }, { status: 429, headers: { ...headers, 'Retry-After': response.headers.get('Retry-After') ?? '60' } })
  } catch { /* Missing or unavailable budget must never allow image processing. */ }
  return Response.json({ error: 'Proof allowance unavailable. Create review guides locally.' }, { status: 503, headers })
}
