import { boundedJson, BodyReadError } from './http'
import { migrateLegacyDiagnostics } from './legacy-diagnostics'
import { admitDiagnostics, budgetResponse, type DiagnosticBudgetConfig } from './diagnostic-budget'
import { parseContribution, parseSharedContribution, parseSharedSource, type Contribution, type SuggestedSource } from '../src/lib/contributions'
import { resolveTobaccoId } from '../src/lib/tobacco-catalog'
import { storeDiagnostics, type DiagnosticsDatabase } from './diagnostics'
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
const reportCapacity = 1000
const reportCountKey = 'report-count-v2'
// Rebuild once after the September 7 older-writer deployment. Its writes did
// not update v1; trusting that saved count could undercount retained records.
// Called only inside a transaction. Existing objects initialize once; warm
// submissions read the counter without deserializing retained reports.
async function reportCount(storage: Storage, scannedCount?: number): Promise<number> {
  const saved = await storage.get<number>(reportCountKey)
  if (saved !== undefined) {
    if (!Number.isInteger(saved) || saved < 0 || saved > reportCapacity || (scannedCount !== undefined && scannedCount !== saved)) throw new Error('Invalid retained report count')
    return saved
  }
  const count = scannedCount ?? (await storage.list<Stored>({ prefix: 'report:', limit: reportCapacity + 1 })).size
  if (count > reportCapacity) throw new Error('Retained report capacity exceeded')
  await storage.put(reportCountKey, count)
  return count
}
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
export class CatalogContributions {
  private ctx: { storage: Storage }
  private database?: DiagnosticsDatabase
  private budgetConfig: DiagnosticBudgetConfig
  constructor(ctx: { storage: Storage }, env?: { DIAGNOSTICS?: DiagnosticsDatabase } & DiagnosticBudgetConfig) { this.ctx = ctx; this.database = env?.DIAGNOSTICS; this.budgetConfig = env ?? {} }
  async alarm() {
    const storage = this.ctx.storage
    await storage.transaction(async transaction => {
      const reports = await transaction.list<Stored>({ prefix: 'report:', limit: reportCapacity + 1 })
      const count = await reportCount(transaction, reports.size)
      let removed = 0
      for (const [key, item] of reports) if (Date.parse(item.receivedAt) <= Date.now() - retention && await transaction.delete(key)) removed++
      if (removed) await transaction.put(reportCountKey, count - removed)
    })
    for (const key of (await storage.list<SuggestedSource[]>({ prefix: 'sources:', limit: 10000 })).keys()) {
      // Re-read under the same transaction as the write: an import may have
      // refreshed this source since the alarm's list operation.
      await storage.transaction(async transaction => {
        const items = await transaction.get<SuggestedSource[]>(key)
        if (!items) return
        const fresh = items.filter(item => Date.parse(item.checkedAt) > Date.now() - retention)
        if (fresh.length === items.length) return
        if (fresh.length) await transaction.put(key, fresh); else await transaction.delete(key)
      })
    }
    await storage.setAlarm(Date.now() + 86400000)
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/budget' && ['GET', 'POST'].includes(request.method)) return budgetResponse(this.ctx.storage, this.budgetConfig, request.method === 'POST')
    if (url.pathname === '/migrate' && request.method === 'POST') {
      return migrateLegacyDiagnostics(this.ctx.storage, this.database)
    }
    if (request.method === 'GET' && url.pathname === '/export') {
      const reports = [...(await this.ctx.storage.list<Stored>({ prefix: 'report:', limit: 1000 })).values()].filter(item => Date.parse(item.receivedAt) > Date.now() - retention)
      return Response.json({ reports }, { headers })
    }
    if (request.method === 'GET') {
      const entry = resolveTobaccoId(url.searchParams.get('catalogId') ?? '')
      if (!entry) return Response.json({ error: 'Unknown catalog entry' }, { status: 404, headers })
      const catalogId = entry.id
      const sources = await this.ctx.storage.get<SuggestedSource[]>(`sources:${catalogId}`) ?? []
      return Response.json({ catalogId, sources: sources.filter(item => {
        const { checkedAt, ...source } = item
        const shared = parseSharedSource(source)
        return shared?.catalogId === catalogId && ['valid', 'unverified'].includes(shared.status) && Date.parse(checkedAt) > Date.now() - retention
      }).slice(0, 5) }, { headers })
    }
    const contribution = parseContribution(await request.json())
    if (!contribution) return Response.json({ error: 'Invalid contribution' }, { status: 400, headers })
    const digest = contribution.submissionId
    const now = new Date().toISOString()
    const result = await this.ctx.storage.transaction(async storage => {
      if (await storage.get(`report:${digest}`)) return 'duplicate'
      const count = await reportCount(storage)
      if (count >= reportCapacity) return 'capacity'
      await storage.put(`report:${digest}`, { receivedAt: now, contribution })
      await storage.put(reportCountKey, count + 1)
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
export async function contributionsResponse(request: Request, binding?: ContributionBinding, limiter?: { limit(options: { key: string }): Promise<{ success: boolean }> }, adminToken?: string, db?: DiagnosticsDatabase, sourceLimiter?: { limit(options: { key: string }): Promise<{ success: boolean }> }): Promise<Response> {
  if (!binding) return Response.json({ error: 'Collection is unavailable', code: 'collection_unconfigured' }, { status: 503, headers })
  const url = new URL(request.url)
  const target = binding.getByName('catalog-contributions-v1')
  try {
    if (request.method === 'GET' && url.pathname === '/api/labels/sources') {
      const entry = resolveTobaccoId(url.searchParams.get('catalogId') ?? '')
      if (!entry) return Response.json({ error: 'Unknown catalog entry' }, { status: 404, headers })
      if (!sourceLimiter || !(await sourceLimiter.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })).success) return new Response(null, { status: 429, headers })
      return target.fetch(new Request(`https://catalog/sources?catalogId=${encodeURIComponent(entry.id)}`))
    }
    if (request.method === 'GET' && url.pathname === '/api/labels/contributions') {
      if (!adminToken || request.headers.get('Authorization') !== `Bearer ${adminToken}`) return new Response(null, { status: 403, headers })
      return target.fetch(new Request('https://catalog/export'))
    }
    if (request.method !== 'POST' || url.pathname !== '/api/labels/contributions') return new Response(null, { status: 405, headers })
    if (request.headers.get('Origin') !== url.origin) return new Response(null, { status: 403, headers })
    if (request.headers.get('Content-Type') !== 'application/json') return new Response(null, { status: 415, headers })
    if (!limiter || !(await limiter.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })).success) return new Response(null, { status: 429, headers })
    const contribution = parseSharedContribution(await boundedJson(request, { maxBytes: 65536 }))
    if (!contribution) return Response.json({ error: 'Invalid contribution' }, { status: 400, headers })
    const paused = await admitDiagnostics(binding)
    if (paused) return paused
    if (db) {
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
  } catch (error) {
    if (error instanceof BodyReadError) return Response.json({ error: error.message }, { status: error.status, headers })
    return Response.json({ error: 'Collection could not complete' }, { status: 503, headers })
  }
}
