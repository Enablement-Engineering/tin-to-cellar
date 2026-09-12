// @vitest-environment node
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { galleryResponse } from './gallery/routes'
import type { GalleryDatabase, GalleryRateLimiter } from './gallery/storage'
import type { GalleryPublicCache } from './gallery/public-read'
import * as auth from './gallery/auth'
import worker, { type Env } from './index'

// D1's SQL runs in real SQLite. Result rows are measured, not Cloudflare billed row scans.
class DB implements GalleryDatabase {
  raw = new DatabaseSync(':memory:')
  statements = 0
  resultRows = 0
  prepare(sql: string) {
    let args: unknown[] = []
    const statement = {
      bind: (...values: unknown[]) => { args = values; return statement },
      first: async <T>() => { this.statements++; const row = this.raw.prepare(sql).get(...args as never[]); this.resultRows += Number(!!row); return (row ?? null) as T | null },
      all: async <T>() => { this.statements++; const rows = this.raw.prepare(sql).all(...args as never[]); this.resultRows += rows.length; return { results: rows as T[] } },
      run: async () => { this.statements++; return { meta: { changes: Number(this.raw.prepare(sql).run(...args as never[]).changes) } } },
    }
    return statement
  }
  async batch(statements: ReturnType<DB['prepare']>[]) { return Promise.all(statements.map(statement => statement.run())) }
}
class Cache implements GalleryPublicCache {
  entries = new Map<string, { headers: Headers; bytes: ArrayBuffer }>()
  // Deliberately return expired records: the application's absolute deadline must reject them.
  async match(key: Request) { const entry = this.entries.get(key.url); return entry ? new Response(entry.bytes.slice(0), { headers: entry.headers }) : undefined }
  async put(key: Request, response: Response) { this.entries.set(key.url, { headers: new Headers(response.headers), bytes: await response.arrayBuffer() }) }
}
type Snapshot = { requests: number; d1Statements: number; sqlResultRows: number; r2Reads: number; cacheHits: number; limited: number; serverErrors: number }
const reports: Record<string, unknown>[] = []
const configuredLimit = (binding: string) => {
  const source = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  const value = source.match(new RegExp(`"name"\\s*:\\s*"${binding}"[^}]*"limit"\\s*:\\s*(\\d+)`))?.[1]
  if (!value) throw new Error(`Missing configured limiter ${binding}`)
  return Number(value)
}
const configuredLimits = { metadata: configuredLimit('GALLERY_READ_RATE_LIMITER'), image: configuredLimit('GALLERY_IMAGE_RATE_LIMITER'), pack: configuredLimit('GALLERY_PACK_RATE_LIMITER') }
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const hash = 'a'.repeat(64)
const bytes = new Uint8Array([1, 2, 3, 4])
let db: DB, cache: Cache, env: Env, time: number, r2Reads: number, requests: number, hits: number, limited: number, errors: number, cancelled: number
let jobs: Promise<unknown>[], latencies: number[]
const snapshot = (): Snapshot => ({ requests, d1Statements: db.statements, sqlResultRows: db.resultRows, r2Reads, cacheHits: hits, limited, serverErrors: errors })
async function measure(name: string, operation: () => Promise<void>) {
  const before = snapshot(), index = latencies.length, start = performance.now()
  await operation()
  await drain()
  const after = snapshot(), durations = latencies.slice(index).sort((a, b) => a - b)
  const counts = Object.fromEntries(Object.keys(before).map(key => [key, after[key as keyof Snapshot] - before[key as keyof Snapshot]])) as Snapshot
  const result = { scenario: name, ...counts, elapsedMs: +(performance.now() - start).toFixed(3), p95RequestMs: +(durations[Math.max(0, Math.ceil(durations.length * .95) - 1)] ?? 0).toFixed(3) }
  reports.push(result)
  return result
}
const drain = async () => { await Promise.all(jobs.splice(0)) }
function limiter(cap: number): GalleryRateLimiter {
  const windows = new Map<string, { start: number; count: number }>()
  return { limit: async ({ key }) => {
    let window = windows.get(key)
    if (!window || time >= window.start + 60000) { window = { start: time, count: 0 }; windows.set(key, window) }
    return { success: ++window.count <= cap }
  } }
}
async function call(path: string, options: { host?: string; headers?: HeadersInit; root?: boolean } = {}) {
  requests++
  const start = performance.now()
  const input = new Request(`https://${options.host ?? 'tintocellar.com'}/api/gallery/v1${path}`, { headers: { 'CF-Connecting-IP': '203.0.113.10', ...options.headers } })
  const response = options.root ? await worker.fetch(input, env, { waitUntil: promise => jobs.push(promise) }) : await galleryResponse(input, env, { now: () => new Date(time), publicCache: cache, waitUntil: promise => jobs.push(promise) })
  latencies.push(performance.now() - start)
  hits += Number(response.headers.get('X-Gallery-Cache') === 'HIT')
  limited += Number(response.status === 429)
  errors += Number(response.status >= 500)
  return response
}
async function landing() {
  expect((await call('/config')).status).toBe(200)
  const response = await call('/labels'), page = await response.json() as { labels: { id: string }[] }
  expect(response.status).toBe(200); expect(page.labels).toHaveLength(24)
  await Promise.all(page.labels.map(async label => { const image = await call(`/labels/${label.id}/thumbnail`); expect(image.status).toBe(200); await image.arrayBuffer() }))
  await drain()
}
beforeEach(() => {
  db = new DB(); cache = new Cache(); time = Date.now(); r2Reads = requests = hits = limited = errors = cancelled = 0; jobs = []; latencies = []
  for (const file of readdirSync(new URL('../migrations/gallery/', import.meta.url)).filter(file => file.endsWith('.sql')).sort()) db.raw.exec(readFileSync(new URL(`../migrations/gallery/${file}`, import.meta.url), 'utf8'))
  db.raw.exec("UPDATE gallery_settings SET intake=1,publication=1,serving=1; INSERT INTO gallery_tobaccos VALUES('test-blend','Test','Blend','[]',1,'fixture')")
  for (let n = 0; n < 240; n++) {
    const metadata = { version: 2, submissionId: id(n), tobacco: { catalogId: 'test-blend' }, artworkProfileId: 'circle-2.5@1', altText: 'Synthetic label', writingArea: { shape: 'rectangle', x: .35, y: .6, width: .3, height: .1 }, image: { sha256: hash, bytes: 4, width: 825, height: 825 }, acknowledgement: { version: '2026-09-06-v2', accepted: true } }
    db.raw.prepare("INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,metadata_json,catalog_id,input_bytes,reserved_bytes,quota_key,published_maker,published_blend,published_at) VALUES(?,'cap','hash','published',?,'2027-01-01',?,'test-blend',4,4,?,'Test','Blend','2026-09-12')").run(id(n), `2026-09-0${1 + Math.floor(n / 50)}`, JSON.stringify(metadata), `fixture-${n}`)
    for (const kind of ['thumbnail', 'artwork', 'pack']) db.raw.prepare('INSERT INTO gallery_assets VALUES(?,?,?,?,?,?)').run(`${n}-${kind}`, id(n), kind, `${n}/${kind}`, hash, bytes.length)
  }
  env = { GALLERY: db, GALLERY_ART: { get: async () => { r2Reads++; return { body: new Response(bytes).body!, arrayBuffer: async () => { throw Error('Unexpected R2 buffering') } } }, put: vi.fn(), head: vi.fn(), delete: vi.fn(), list: vi.fn() }, GALLERY_SERVING: 'true', GALLERY_INTAKE: 'true', GALLERY_PUBLICATION: 'true', GALLERY_IP_SALT: 'fixture', GALLERY_READ_RATE_LIMITER: limiter(configuredLimits.metadata), GALLERY_IMAGE_RATE_LIMITER: limiter(configuredLimits.image), GALLERY_PACK_RATE_LIMITER: limiter(configuredLimits.pack), GALLERY_ADMIN_HOST: 'admin.tintocellar.com', GALLERY_TURNSTILE_SITE_KEY: 'site', GALLERY_TURNSTILE_SECRET: 'secret', GALLERY_RATE_LIMITER: limiter(5), GALLERY_UPLOAD_RATE_LIMITER: limiter(5), GALLERY_MUTATION_RATE_LIMITER: limiter(20), ASSETS: { fetch: async () => new Response('local app') } }
})
afterEach(async () => { await drain(); db.raw.close(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
afterAll(() => {
  const report = { environment: 'Synthetic local SQLite, memory R2 and classic Cache API fixture; not hosted throughput or Cloudflare billed row measurements.', limiterModel: 'Deterministic 60-second per-key window using values read from current wrangler.jsonc; Cloudflare limits are approximate.', configuredLimits, requestLatency: 'Handler time excludes response body consumption; elapsedMs includes scenario completion.', recordedAt: new Date().toISOString(), scenarios: reports }
  mkdirSync('output/beta-readiness', { recursive: true }); writeFileSync('output/beta-readiness/local-load.json', JSON.stringify(report, null, 2) + '\n')
  console.info(JSON.stringify(report))
})

it('measures cold and warm 26-request gallery landings', async () => {
  const cold = await measure('cold-gallery-landing', landing)
  expect(cold).toMatchObject({ requests: 26, r2Reads: 24, limited: 0, serverErrors: 0 })
  const warm = await measure('warm-gallery-landing', landing)
  expect(warm).toMatchObject({ requests: 26, d1Statements: 0, r2Reads: 0, cacheHits: 26, limited: 0, serverErrors: 0 })
})
it('serves 20 browser-equivalent landings behind one NAT over 57 simulated seconds', async () => {
  const result = await measure('shared-NAT-20-sessions', async () => { for (let n = 0; n < 20; n++) { if (n) time += 3000; await landing() } })
  expect(result).toMatchObject({ requests: 520, r2Reads: 24, limited: 0, serverErrors: 0 })
})
it('measures 410-KB thumbnails with overlapping two-ms R2 reads and twenty-ms cache writes', async () => {
  const put = cache.put.bind(cache), thumbnailBytes = new Uint8Array(410000)
  db.raw.exec('UPDATE gallery_assets SET bytes=410000')
  env.GALLERY_ART!.get = async () => { r2Reads++; await new Promise(resolve => setTimeout(resolve, 2)); return { body: new Response(thumbnailBytes).body!, arrayBuffer: async () => { throw Error('Unexpected R2 buffering') } } }
  cache.put = async (key, response) => { await new Promise(resolve => setTimeout(resolve, 20)); await put(key, response) }
  const cold = await measure('delayed-IO-cold-gallery-landing', landing)
  const reload = await measure('delayed-IO-first-reload', landing)
  expect(cold).toMatchObject({ requests: 26, r2Reads: 24, limited: 0, serverErrors: 0 })
  expect(reload).toMatchObject({ requests: 26, d1Statements: 0, r2Reads: 0, cacheHits: 26, limited: 0, serverErrors: 0 })
})
it('measures cold stampede and warm reuse for 100 concurrent image requests', async () => {
  const burst = async () => { await Promise.all(Array.from({ length: 100 }, async () => { const response = await call(`/labels/${id(0)}/thumbnail`); expect(response.status).toBe(200); await response.arrayBuffer() })) }
  const cold = await measure('cold-popular-image-100-concurrent', burst)
  expect(cold).toMatchObject({ requests: 100, limited: 0, serverErrors: 0 })
  const warm = await measure('warm-popular-image-100-concurrent', burst)
  expect(warm).toMatchObject({ requests: 100, d1Statements: 0, r2Reads: 0, cacheHits: 100 })
})
it('loads ten intentional pages with unique cursor progression and 240 thumbnails', async () => {
  const seen = new Set<string>()
  const result = await measure('manual-ten-pages', async () => {
    let cursor: string | null = null
    for (let n = 0; n < 10; n++) {
      const page = await (await call(`/labels${cursor ? `?cursor=${cursor}` : ''}`)).json() as { labels: { id: string }[]; nextCursor: string | null }
      expect(page.labels).toHaveLength(24)
      await Promise.all(page.labels.map(async label => { expect(seen.has(label.id)).toBe(false); seen.add(label.id); await (await call(`/labels/${label.id}/thumbnail`)).arrayBuffer() }))
      cursor = page.nextCursor
    }
    expect(cursor).toBeNull()
  })
  expect(seen.size).toBe(240); expect(result).toMatchObject({ requests: 250, r2Reads: 240, limited: 0, serverErrors: 0 })
})
it('sheds metadata overload without charging image or pack buckets', async () => {
  const result = await measure('metadata-overload-130-requests', async () => { for (let n = 0; n < 130; n++) await call('/labels') })
  expect(result).toMatchObject({ requests: 130, limited: 10, serverErrors: 0 })
  expect((await call(`/labels/${id(0)}/thumbnail`)).status).toBe(200)
  expect((await call(`/labels/${id(0)}/pack`)).status).toBe(200)
})
it('streams twenty concurrent pack downloads and cancels each R2 stream', async () => {
  env.GALLERY_ART!.get = async () => { r2Reads++; return { body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes) }, cancel() { cancelled++ } }), arrayBuffer: async () => { throw Error('Unexpected R2 buffering') } } }
  const result = await measure('twenty-disconnected-pack-downloads', async () => {
    await Promise.all(Array.from({ length: 20 }, async () => { const response = await call(`/labels/${id(0)}/pack`); expect(response.status).toBe(200); const reader = response.body!.getReader(); expect((await reader.read()).value).toEqual(bytes); await reader.cancel() }))
  })
  expect(result).toMatchObject({ requests: 20, r2Reads: 20, limited: 0, serverErrors: 0 }); expect(cancelled).toBe(20); expect(cache.entries.size).toBe(0)
})
it('rejects a delayed cache fill after unpublish and keeps local app available with serving off', async () => {
  const original = cache.put.bind(cache)
  cache.put = async (key, response) => { time += 90000; await original(key, response) }
  await (await call(`/labels/${id(0)}/thumbnail`)).arrayBuffer(); await drain()
  db.raw.prepare("UPDATE gallery_submissions SET state='unpublished' WHERE id=?").run(id(0))
  expect((await call(`/labels/${id(0)}/thumbnail`)).status).toBe(404)
  db.raw.exec('UPDATE gallery_settings SET serving=0'); time += 5000
  expect((await (await call('/labels')).json()).serving).toBe(false)
  expect((await call(`/labels/${id(1)}/thumbnail`)).status).toBe(404)
  expect(await (await worker.fetch(new Request('https://tintocellar.com/labels/print'), env)).text()).toBe('local app')
})
it('keeps real Worker dispatch and shared cache isolated across public and admin auth states', async () => {
  vi.stubGlobal('caches', { default: cache })
  const verify = vi.spyOn(auth, 'verifyGalleryAdmin').mockResolvedValue(null)
  await (await call('/config', { root: true })).arrayBuffer(); await drain()
  await (await call(`/labels/${id(0)}/thumbnail`, { root: true })).arrayBuffer(); await drain()
  const before = snapshot()
  for (const path of ['/config', `/labels/${id(0)}/thumbnail`]) {
    const response = await call(path, { root: true, host: 'admin.tintocellar.com' })
    expect(response.status).toBe(403); expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(response.headers.has('X-Gallery-Cache')).toBe(false)
  }
  expect(db.statements).toBe(before.d1Statements); expect(r2Reads).toBe(before.r2Reads)
  verify.mockResolvedValue('reviewer')
  const admin = await call('/config', { root: true, host: 'admin.tintocellar.com', headers: { 'Cf-Access-Jwt-Assertion': 'test-assertion' } })
  expect(admin.status).toBe(200); expect(admin.headers.get('Cache-Control')).toBe('no-store')
  expect((await call(`/labels/${id(0)}/thumbnail`, { root: true, host: 'admin.tintocellar.com' })).status).toBe(404)
  const publicHit = await call('/config', { root: true })
  expect(publicHit.headers.get('X-Gallery-Cache')).toBe('HIT')
  expect([...cache.entries.keys()].every(key => new URL(key).host === 'tintocellar.com')).toBe(true)
  const authenticatedPublic = await call('/config', { root: true, headers: { Authorization: 'Bearer test' } })
  expect(authenticatedPublic.headers.get('Cache-Control')).toBe('no-store')
})
