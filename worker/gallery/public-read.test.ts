// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { galleryResponse } from './routes'
import { streamAsset, type GalleryPublicCache } from './public-read'
import type { GalleryBucket, GalleryDatabase, GalleryEnv } from './storage'

class DB implements GalleryDatabase {
  raw = new DatabaseSync(':memory:')
  queries: string[] = []
  failed = false
  prepare(sql: string) {
    this.queries.push(sql)
    if (this.failed) throw new Error('D1 unavailable')
    let args: unknown[] = []
    const statement = {
      bind: (...values: unknown[]) => { args = values; return statement },
      first: async <T>() => (this.raw.prepare(sql).get(...args as never[]) ?? null) as T | null,
      all: async <T>() => ({ results: this.raw.prepare(sql).all(...args as never[]) as T[] }),
      run: async () => ({ meta: { changes: Number(this.raw.prepare(sql).run(...args as never[]).changes) } }),
    }
    return statement
  }
  async batch(statements: ReturnType<DB['prepare']>[]) { return Promise.all(statements.map(s => s.run())) }
}
class TestCache implements GalleryPublicCache {
  entries = new Map<string, { headers: Headers; body: ArrayBuffer }>()
  async put(key: Request, response: Response) { this.entries.set(key.url, { headers: new Headers(response.headers), body: await response.arrayBuffer() }) }
  async match(key: Request) { const value = this.entries.get(key.url); return value ? new Response(value.body.slice(0), { headers: value.headers }) : undefined }
}
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const assetPath = `/labels/${id}/thumbnail`
const png = new Uint8Array([1, 2, 3, 4])
const hash = 'a'.repeat(64)
let db: DB, cache: TestCache, env: GalleryEnv, time: number
let reads: ReturnType<typeof vi.fn<GalleryBucket['get']>>, buffered: ReturnType<typeof vi.fn<() => Promise<ArrayBuffer>>>
const jobs: Promise<unknown>[] = []
const deps = { now: () => new Date(time), waitUntil: (job: Promise<unknown>) => { jobs.push(job) } }
const request = (path = assetPath, headers: HeadersInit = {}, host = 'tintocellar.com') => new Request(`https://${host}/api/gallery/v1${path}`, { headers })
const call = (path = assetPath, headers: HeadersInit = {}, host?: string) => galleryResponse(request(path, headers, host), env, { ...deps, publicCache: cache })
const drain = async () => { await Promise.all(jobs.splice(0)) }
beforeEach(() => {
  time = Date.parse('2026-09-12T12:00:00Z')
  db = new DB()
  for (const name of readdirSync(new URL('../../migrations/gallery/', import.meta.url)).filter(n => n.endsWith('.sql')).sort()) db.raw.exec(readFileSync(new URL(`../../migrations/gallery/${name}`, import.meta.url), 'utf8'))
  db.raw.exec("UPDATE gallery_settings SET intake=1,publication=1,serving=1; INSERT INTO gallery_tobaccos VALUES('test-blend','Test','Blend','[]',1,'fixture')")
  const metadata = { version: 2, submissionId: id, tobacco: { catalogId: 'test-blend' }, artworkProfileId: 'circle-2.5@1', altText: 'Synthetic label', writingArea: { shape: 'rectangle', x: .35, y: .6, width: .3, height: .1 }, image: { sha256: hash, bytes: 4, width: 825, height: 825 }, acknowledgement: { version: '2026-09-06-v2', accepted: true } }
  db.raw.prepare("INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,metadata_json,catalog_id,input_bytes,quota_key,published_maker,published_blend,published_at) VALUES(?,'cap','hash','published','2026-09-12','2027-01-01',?,'test-blend',4,'fixture','Test','Blend','2026-09-12')").run(id, JSON.stringify(metadata))
  for (const kind of ['thumbnail', 'artwork', 'pack']) db.raw.prepare('INSERT INTO gallery_assets VALUES(?,?,?,?,?,?)').run(kind, id, kind, `key/${kind}`, hash, png.length)
  cache = new TestCache()
  buffered = vi.fn(async () => { throw new Error('Downloads must stream') })
  reads = vi.fn(async () => ({ body: new Response(png).body!, arrayBuffer: buffered }))
  const limiter = () => ({ limit: vi.fn(async () => ({ success: true })) })
  env = { GALLERY: db, GALLERY_ART: { get: reads, put: vi.fn(), head: vi.fn(), delete: vi.fn(), list: vi.fn() }, GALLERY_SERVING: 'true', GALLERY_INTAKE: 'true', GALLERY_PUBLICATION: 'true', GALLERY_IP_SALT: 'salt', GALLERY_READ_RATE_LIMITER: limiter(), GALLERY_IMAGE_RATE_LIMITER: limiter(), GALLERY_PACK_RATE_LIMITER: limiter(), GALLERY_ADMIN_HOST: 'admin.tintocellar.com' }
})
afterEach(async () => { await drain(); db.raw.close() })

it('serves a warm image with no D1 or R2 work and browser revalidation', async () => {
  const first = await call(); expect(new Uint8Array(await first.arrayBuffer())).toEqual(png); await drain()
  expect(db.queries).toHaveLength(3) // readiness + switches + published asset JOIN
  db.queries = []
  const second = await call()
  expect(second.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate')
  expect(second.headers.get('X-Gallery-Cache')).toBe('HIT')
  expect(second.headers.has('X-Gallery-Fresh-Until')).toBe(false)
  expect(await second.arrayBuffer()).toEqual(png.buffer)
  expect(db.queries).toEqual([]); expect(reads).toHaveBeenCalledOnce(); expect(buffered).not.toHaveBeenCalled()
})

it('isolates full host keys and bypasses all authenticated/cookie/admin variants', async () => {
  await (await call()).arrayBuffer(); await drain()
  await (await call(assetPath, {}, 'staging.tintocellar.com')).arrayBuffer(); await drain()
  expect(reads).toHaveBeenCalledTimes(2); expect(cache.entries.size).toBe(2)
  for (const headers of [{ Authorization: 'Bearer private' }, { Cookie: 'session=private' }, { 'Cf-Access-Jwt-Assertion': 'assertion' }] as HeadersInit[]) {
    const response = await call(assetPath, headers)
    expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(response.headers.has('X-Gallery-Cache')).toBe(false)
    await response.arrayBuffer()
  }
  const admin = await call(assetPath, {}, 'admin.tintocellar.com')
  expect(admin.headers.get('Cache-Control')).toBe('no-store'); await admin.arrayBuffer()
  expect(cache.entries.size).toBe(2); expect(reads).toHaveBeenCalledTimes(6)
})

it('refreshes settings by five seconds and rejects serving-off before cached or conditional bytes', async () => {
  await (await call()).arrayBuffer(); await drain()
  db.raw.exec('UPDATE gallery_settings SET serving=0')
  time += 5000
  expect((await call(assetPath, { 'If-None-Match': `"${hash}"` })).status).toBe(404)
  expect(await (await call('/labels')).json()).toEqual({ labels: [], nextCursor: null, serving: false })
  expect(reads).toHaveBeenCalledOnce()
})

it('does not reuse controls when their expired refresh fails', async () => {
  await (await call()).arrayBuffer(); await drain()
  time += 5000; db.failed = true
  const response = await call()
  expect(response.status).toBe(503); expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(reads).toHaveBeenCalledOnce()
})

it('keeps readiness failure recoverable and rejects legacy metadata after five seconds', async () => {
  await (await call()).arrayBuffer(); await drain()
  db.raw.exec("UPDATE gallery_submissions SET metadata_json=json_set(metadata_json,'$.version',1)")
  time += 5000
  expect((await call()).status).toBe(503)
  db.raw.exec("UPDATE gallery_submissions SET metadata_json=json_set(metadata_json,'$.version',2)")
  expect((await call()).status).toBe(200)
})

it('expires unpublished images within sixty seconds even if the cache backend returns expired entries', async () => {
  await (await call()).arrayBuffer(); await drain()
  db.raw.exec("UPDATE gallery_submissions SET state='unpublished'")
  time += 60000
  expect((await call(assetPath, { 'If-None-Match': `"${hash}"` })).status).toBe(404)
  expect(reads).toHaveBeenCalledOnce()
})

it('bounds delayed cache fills to the original request start', async () => {
  const write = cache.put.bind(cache)
  cache.put = async (key, response) => { time += 90000; await write(key, response) }
  await (await call()).arrayBuffer(); await drain()
  db.raw.exec("UPDATE gallery_submissions SET state='unpublished'")
  expect((await call()).status).toBe(404)
  expect(reads).toHaveBeenCalledOnce()
})

it('honors weak/list/wildcard ETags without object reads on cold and warm requests', async () => {
  const cold = await call(assetPath, { 'If-None-Match': `"other", W/"${hash}"` })
  expect(cold.status).toBe(304); expect(reads).not.toHaveBeenCalled(); expect(cache.entries.size).toBe(0)
  await (await call()).arrayBuffer(); await drain()
  const warm = await call(assetPath, { 'If-None-Match': '*' })
  expect(warm.status).toBe(304); expect(warm.headers.get('X-Gallery-Cache')).toBe('HIT'); expect(reads).toHaveBeenCalledOnce()
})

it('uses separate metadata/image/pack admission and fails closed before storage', async () => {
  env.GALLERY_READ_RATE_LIMITER = { limit: vi.fn(async () => ({ success: false })) }
  expect((await call('/labels')).status).toBe(429); expect(db.queries).toEqual([])
  expect((await call()).status).toBe(200)
  expect((await call(`/labels/${id}/pack`)).status).toBe(200)
  db.queries = []; reads.mockClear()
  env.GALLERY_IMAGE_RATE_LIMITER = undefined
  expect((await call()).status).toBe(503); expect(db.queries).toEqual([]); expect(reads).not.toHaveBeenCalled()
  env.GALLERY_PACK_RATE_LIMITER = { limit: vi.fn(async () => ({ success: false })) }
  const denied = await call(`/labels/${id}/pack`)
  expect(denied.status).toBe(429); expect(denied.headers.get('Retry-After')).toBe('60'); expect(db.queries).toEqual([])
})

it('normalizes list query order and rejects duplicates/unknown fields before D1', async () => {
  expect((await call('/labels?catalogId=test-blend&catalogId=other')).status).toBe(400)
  expect((await call('/labels?tracking=secret')).status).toBe(400); expect(db.queries).toEqual([])
  const first = await call('/labels?geometry=circle-2.5&catalogId=test-blend'); const page = await first.json(); await drain()
  expect(page.labels).toHaveLength(1)
  const second = await call('/labels?catalogId=test-blend&geometry=circle-2.5')
  expect(second.headers.get('X-Gallery-Cache')).toBe('HIT')
  expect(db.queries.find(sql => sql.includes('ORDER BY id'))).toContain('AND catalog_id=?')
  expect(db.queries.find(sql => sql.includes('ORDER BY id'))).not.toContain('SELECT *')
})

it('never caches packs or private previews, preserving streaming download headers', async () => {
  for (let i = 0; i < 2; i++) {
    const pack = await call(`/labels/${id}/pack`)
    expect(pack.headers.get('Content-Disposition')).toBe(`attachment; filename="label-${id}.cellarpack.zip"`)
    expect(pack.headers.get('Content-Length')).toBe('4'); expect(await pack.arrayBuffer()).toEqual(png.buffer)
  }
  const preview = await streamAsset(env, id, { kind: 'artwork', bytes: 4, sha256: hash, r2_key: 'key/artwork' })
  expect(preview.headers.get('Cache-Control')).toBe('no-store'); expect(await preview.arrayBuffer()).toEqual(png.buffer)
  expect(cache.entries.size).toBe(0); expect(buffered).not.toHaveBeenCalled(); expect(reads).toHaveBeenCalledTimes(3)
})

it('allows incremental concurrent downloads and propagates cancellation to their R2 bodies', async () => {
  const cancelled = vi.fn()
  reads.mockImplementation(async () => ({ body: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(png) }, cancel: cancelled }), arrayBuffer: buffered }))
  const responses = await Promise.all(Array.from({ length: 5 }, () => call(`/labels/${id}/pack`)))
  for (const response of responses) { const reader = response.body!.getReader(); expect((await reader.read()).value).toEqual(png); await reader.cancel() }
  expect(cancelled).toHaveBeenCalledTimes(5); expect(buffered).not.toHaveBeenCalled(); expect(cache.entries.size).toBe(0)
})

it('uses 15/30/60 second cache deadlines and keeps config serving changes authoritative', async () => {
  await (await call('/config')).json(); await (await call('/labels')).json(); await (await call()).arrayBuffer(); await drain()
  const deadlines = [...cache.entries.values()].map(v => Number(v.headers.get('X-Gallery-Fresh-Until')) - time).sort((a, b) => a - b)
  expect(deadlines).toEqual([15000, 30000, 60000])
  expect((await call('/config')).headers.get('X-Gallery-Cache')).toBe('HIT')
  env.GALLERY_SERVING = 'false'
  expect((await (await call('/config')).json()).serving).toBe(false)
  expect((await call()).status).toBe(404)
})

it('keeps authenticated admin previews private before and after warming the public asset', async () => {
  const preview = () => galleryResponse(request(`/admin/publications/${id}/artwork`, {}, 'admin.tintocellar.com'), env, { ...deps, publicCache: cache, verifyAdmin: async () => 'reviewer' })
  const first = await preview(); expect(first.headers.get('Cache-Control')).toBe('no-store'); await first.arrayBuffer()
  expect(cache.entries.size).toBe(0)
  await (await call(`/labels/${id}/artwork`)).arrayBuffer(); await drain()
  const second = await preview(); expect(second.headers.get('Cache-Control')).toBe('no-store'); await second.arrayBuffer()
  expect(cache.entries.size).toBe(1); expect(reads).toHaveBeenCalledTimes(3)
})

it('expires removed list entries within thirty seconds and never caches errors', async () => {
  expect((await (await call('/labels')).json()).labels).toHaveLength(1); await drain()
  db.raw.exec("UPDATE gallery_submissions SET state='unpublished'")
  time += 30000
  expect((await (await call('/labels')).json()).labels).toEqual([])
  const size = cache.entries.size
  expect((await call()).status).toBe(404); await drain(); expect(cache.entries.size).toBe(size)
})

it('does not admit slow fills or large image streams into the cache', async () => {
  reads.mockImplementationOnce(async () => { time += 60001; return { body: new Response(png).body!, arrayBuffer: buffered } })
  await (await call()).arrayBuffer(); await drain(); expect(cache.entries.size).toBe(0)
  const big = new Uint8Array(2 * 1024 * 1024 + 1)
  db.raw.prepare("UPDATE gallery_assets SET bytes=? WHERE kind='artwork'").run(big.length)
  reads.mockImplementationOnce(async () => ({ body: new Response(big).body!, arrayBuffer: buffered }))
  expect((await (await call(`/labels/${id}/artwork`)).arrayBuffer()).byteLength).toBe(big.length)
  await drain(); expect(cache.entries.size).toBe(0); expect(buffered).not.toHaveBeenCalled()
})

it('continues serving when cache lookup/write fails without reviving stale control state', async () => {
  cache.match = async () => { throw new Error('cache failure') }
  cache.put = async () => { throw new Error('cache failure') }
  expect((await call()).status).toBe(200); await drain()
  db.raw.exec('UPDATE gallery_settings SET serving=0'); time += 5000
  expect((await call()).status).toBe(404)
})

it('bounds unfiltered and filtered cursor query plans without a temporary sort', () => {
  const query = "SELECT id,catalog_id,metadata_json,published_maker,published_blend,published_at FROM gallery_submissions WHERE state='published' AND id>?"
  const plan = (sql: string, ...args: string[]) => db.raw.prepare('EXPLAIN QUERY PLAN ' + sql).all(...args).map(row => String(row.detail)).join('\n')
  expect(plan(query + ' ORDER BY id LIMIT 25', '')).toContain('gallery_public_browse (state=? AND id>?)')
  expect(plan(query + ' AND catalog_id=? ORDER BY id LIMIT 25', '', 'test-blend')).toContain('gallery_public_filter (state=? AND catalog_id=? AND id>?)')
  expect(plan(query + ' ORDER BY id LIMIT 25', '')).not.toContain('TEMP B-TREE')
  db.raw.exec('DROP INDEX gallery_public_browse')
  expect(plan(query + ' ORDER BY id LIMIT 25', '')).toContain('TEMP B-TREE')
})

it('limits cache stream tees during a concurrent cold-image burst', async () => {
  const write = cache.put.bind(cache)
  let release!: () => void
  const paused = new Promise<void>(resolve => { release = resolve })
  const pending = vi.fn(async (key: Request, value: Response) => { await paused; await write(key, value) })
  cache.put = pending
  const responses = await Promise.all(Array.from({ length: 20 }, () => call()))
  expect(pending).toHaveBeenCalledOnce()
  await Promise.all(responses.map(response => response.arrayBuffer()))
  release(); await drain()
  expect((await call()).headers.get('X-Gallery-Cache')).toBe('HIT')
})
