import { storedFeedback, parseContribution, type Contribution, type SuggestedSource } from '../src/lib/contributions'
import { TOBACCO_CATALOG } from '../src/lib/tobacco-catalog'
import { diagnosticInsert, storeDiagnostics, type DiagnosticsDatabase, type Statement } from './diagnostics'
export interface Storage {
  get<T>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<boolean>
  list<T>(options: { prefix: string; limit: number }): Promise<Map<string, T>>
  getAlarm(): Promise<number | null>
  setAlarm(time: number): Promise<void>
  transaction<T>(callback: (storage: Storage) => Promise<T>): Promise<T>
}
export interface ContributionBinding { getByName(name: string): { fetch(request: Request): Promise<Response> } }
type Stored = { receivedAt: string; contribution: Contribution }
const retention = 90 * 86400000
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
export class CatalogContributions {
  private ctx: { storage: Storage }
  private database?: DiagnosticsDatabase
  constructor(ctx: { storage: Storage }, env?: { DIAGNOSTICS?: DiagnosticsDatabase }) { this.ctx = ctx; this.database = env?.DIAGNOSTICS }
  async alarm() {
    const storage = this.ctx.storage
    for (const [key, item] of await storage.list<Stored>({ prefix: 'report:', limit: 1000 })) if (Date.parse(item.receivedAt) <= Date.now() - retention) await storage.delete(key)
    for (const [key, items] of await storage.list<SuggestedSource[]>({ prefix: 'sources:', limit: 10000 })) {
      const fresh = items.filter(item => Date.parse(item.checkedAt) > Date.now() - retention)
      if (fresh.length) await storage.put(key, fresh); else await storage.delete(key)
    }
    await storage.setAlarm(Date.now() + 86400000)
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/migrate' && request.method === 'POST') {
      if (!this.database) return Response.json({ error: 'Diagnostics storage unavailable' }, { status: 503, headers })
      if (await this.ctx.storage.get('diagnostics-migrated-v1')) return Response.json({ status: 'already-migrated' }, { headers })
      const records = await this.ctx.storage.list<Stored>({ prefix: 'report:', limit: 1000 })
      let copied = 0
      let batch: Statement[] = []
      for (const item of records.values()) {
        const date = new Date(item.receivedAt)
        if (date.getTime() <= Date.now() - retention) continue
        // Legacy source metadata is not copied to D1. Its catalog membership may
        // have changed since collection and must not block diagnostic migration.
        const stored = item.contribution
        if (!stored || typeof stored.submissionId !== 'string' || !/^[a-f0-9]{64}$/.test(stored.submissionId) || !Number.isFinite(date.getTime())) throw new Error('Invalid stored diagnostic identity')
        const feedback = stored.feedback === null ? null : storedFeedback(stored.feedback)
        if (stored.feedback !== null && !feedback) throw new Error('Invalid stored diagnostic feedback')
        const contribution = { submissionId: stored.submissionId, feedback }
        batch.push(diagnosticInsert(this.database, contribution, date, true))
        if (batch.length === 50) { await this.database.batch(batch); batch = [] }
        copied++
      }
      if (batch.length) await this.database.batch(batch)
      // Set the marker only after all writes succeed. INSERT OR IGNORE makes interruption retry safe.
      await this.ctx.storage.put('diagnostics-migrated-v1', true)
      return Response.json({ status: 'migrated', copied }, { headers })
    }
    if (request.method === 'GET' && url.pathname === '/export') {
      const reports = [...(await this.ctx.storage.list<Stored>({ prefix: 'report:', limit: 1000 })).values()].filter(item => Date.parse(item.receivedAt) > Date.now() - retention)
      return Response.json({ reports }, { headers })
    }
    if (request.method === 'GET') {
      const catalogId = url.searchParams.get('catalogId') ?? ''
      if (!TOBACCO_CATALOG.some(item => item.id === catalogId)) return Response.json({ error: 'Unknown catalog entry' }, { status: 404, headers })
      const sources = await this.ctx.storage.get<SuggestedSource[]>(`sources:${catalogId}`) ?? []
      return Response.json({ catalogId, sources: sources.filter(item => ['valid', 'unverified'].includes(item.status) && Date.parse(item.checkedAt) > Date.now() - retention).slice(0, 5) }, { headers })
    }
    const contribution = parseContribution(await request.json())
    if (!contribution) return Response.json({ error: 'Invalid contribution' }, { status: 400, headers })
    const digest = contribution.submissionId
    const now = new Date().toISOString()
    const result = await this.ctx.storage.transaction(async storage => {
      if (await storage.get(`report:${digest}`)) return 'duplicate'
      const reports = await storage.list<Stored>({ prefix: 'report:', limit: 1000 })
      if (reports.size >= 1000) return 'capacity'
      await storage.put(`report:${digest}`, { receivedAt: now, contribution })
      for (const source of contribution.sources) {
        const key = `sources:${source.catalogId}`
        const prior = await storage.get<SuggestedSource[]>(key) ?? []
        // Latest report determines whether a URL is suggested. No claim of independent verification.
        await storage.put(key, [{ ...source, checkedAt: now }, ...prior.filter(item => item.url !== source.url)].slice(0, 10))
      }
      return 'collected'
    })
    if (await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now() + 86400000)
    return Response.json({ status: result }, { status: result === 'capacity' ? 503 : 200, headers })
  }
}
export async function contributionsResponse(request: Request, binding?: ContributionBinding, limiter?: { limit(options: { key: string }): Promise<{ success: boolean }> }, adminToken?: string, db?: DiagnosticsDatabase): Promise<Response> {
  if (!binding) return Response.json({ error: 'Collection is unavailable' }, { status: 503, headers })
  const url = new URL(request.url)
  const target = binding.getByName('catalog-contributions-v1')
  try {
    if (request.method === 'GET' && url.pathname === '/api/labels/sources') return target.fetch(new Request(`https://catalog/sources?${url.searchParams}`))
    if (request.method === 'GET' && url.pathname === '/api/labels/contributions') {
      if (!adminToken || request.headers.get('Authorization') !== `Bearer ${adminToken}`) return new Response(null, { status: 403, headers })
      return target.fetch(new Request('https://catalog/export'))
    }
    if (request.method !== 'POST' || url.pathname !== '/api/labels/contributions') return new Response(null, { status: 405, headers })
    if (request.headers.get('Origin') !== url.origin) return new Response(null, { status: 403, headers })
    if (request.headers.get('Content-Type') !== 'application/json') return new Response(null, { status: 415, headers })
    if (!limiter || !(await limiter.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })).success) return new Response(null, { status: 429, headers })
    const reader = request.body?.getReader()
    if (!reader) return new Response(null, { status: 400, headers })
    let size = 0
    const chunks: Uint8Array[] = []
    const timer = setTimeout(() => { void reader.cancel() }, 5000)
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 65536) return new Response(null, { status: 413, headers })
        chunks.push(value)
      }
    } finally { clearTimeout(timer); void reader.cancel().catch(() => {}); reader.releaseLock() }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const contribution = parseContribution(JSON.parse(new TextDecoder().decode(bytes)))
    if (!contribution) return Response.json({ error: 'Invalid contribution' }, { status: 400, headers })
    if (db) {
      const migration = await target.fetch(new Request('https://catalog/migrate', { method: 'POST' }))
      if (!migration.ok) return Response.json({ error: 'Diagnostics migration is incomplete' }, { status: 503, headers })
      const status = await storeDiagnostics(db, contribution)
      if (contribution.sources.length) {
        // The legacy object continues to own source ordering and deduplication. Do not copy diagnostics there.
        const sourceResult = await target.fetch(new Request('https://catalog/collect', { method: 'POST', body: JSON.stringify({ version: 1, submissionId: contribution.submissionId, feedback: null, sources: contribution.sources }) }))
        if (!sourceResult.ok) return Response.json({ status: 'partial', diagnostics: status, sources: 'unconfirmed' }, { status: 200, headers })
      }
      return Response.json({ status }, { headers })
    }
    if (contribution.version === 2) return Response.json({ error: 'Diagnostics storage is unavailable' }, { status: 503, headers })
    return target.fetch(new Request('https://catalog/collect', { method: 'POST', body: JSON.stringify(contribution) }))
  } catch { return Response.json({ error: 'Collection could not complete' }, { status: 503, headers }) }
}
