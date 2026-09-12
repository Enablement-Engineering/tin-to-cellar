import { GALLERY_NOTICE_VERSION } from '../../src/lib/gallery/types'
import { galleryAltText, parseGalleryDraft, uuid } from '../../src/lib/gallery/schema'
import { database, labelMetadataReady, responseHeaders, sha256, type GalleryDatabase, type GalleryEnv } from './storage'

export interface GalleryPublicCache {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}
export interface PublicReadDependencies {
  now?: () => Date
  publicCache?: GalleryPublicCache | null
  waitUntil?: (promise: Promise<unknown>) => void
  verifyTurnstile?: unknown
}
type Switches = { intake: boolean; serving: boolean; publication: boolean }
type Controls = { ready: boolean; switches: Switches }
export interface PublicAsset { r2_key: string; sha256: string; bytes: number; kind: string }
interface PublicRow { id: string; catalog_id: string; metadata_json: string; published_maker: string; published_blend: string; published_at: string }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: responseHeaders })
const controls = new WeakMap<GalleryDatabase, { expires: number; signature: string; value: Controls }>()
const pendingControls = new WeakMap<GalleryDatabase, { signature: string; expires: number; value: Promise<Controls> }>()
const FRESH_UNTIL = 'X-Gallery-Fresh-Until'
// Tee buffering is bounded by a small public image; packs and large images only stream.
const MAX_CACHED_IMAGE_BYTES = 2 * 1024 * 1024
const pendingWrites = new WeakMap<GalleryPublicCache, Set<string>>()
let activeWrites = 0
let reservedWriteBytes = 0

export async function gallerySwitches(db: GalleryDatabase, env: GalleryEnv): Promise<Switches> {
  const row = await db.prepare('SELECT intake,serving,publication FROM gallery_settings WHERE id=1').first<{ intake: number; serving: number; publication: number }>()
  return { intake: !!row?.intake && env.GALLERY_INTAKE === 'true', serving: !!row?.serving && env.GALLERY_SERVING === 'true', publication: !!row?.publication && env.GALLERY_PUBLICATION === 'true' }
}

async function publicControls(env: GalleryEnv, clock: () => number, cacheable: boolean): Promise<Controls> {
  const binding = env.GALLERY!
  const signature = [env.GALLERY_INTAKE, env.GALLERY_SERVING, env.GALLERY_PUBLICATION].join(':')
  const current = controls.get(binding)
  if (cacheable && current?.signature === signature && current.expires > clock()) return current.value
  const pending = pendingControls.get(binding)
  if (cacheable && pending?.signature === signature && pending.expires > clock()) return pending.value
  const started = clock()
  const value = (async () => {
    const ready = await labelMetadataReady(env)
    const switches = ready ? await gallerySwitches(database(env), env) : { intake: false, publication: false, serving: false }
    if (started + 5000 <= clock()) throw new Error('storage_unavailable')
    const result = { ready, switches }
    // No success is reused past five seconds from the start of its validation.
    // Failures and migration-in-progress results are never cached.
    if (cacheable && ready && started + 5000 > clock()) controls.set(binding, { signature, expires: started + 5000, value: result })
    return result
  })()
  if (cacheable) pendingControls.set(binding, { signature, expires: started + 5000, value })
  try { return await value } finally { if (pendingControls.get(binding)?.value === value) pendingControls.delete(binding) }
}

function matches(request: Request, etag: string) {
  return (request.headers.get('If-None-Match') ?? '').split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag)
}

/** Also used by authenticated previews; private no-store remains the default. */
export async function streamAsset(env: GalleryEnv, id: string, asset: PublicAsset, request?: Request): Promise<Response> {
  const etag = `"${asset.sha256}"`
  const headers = { ...responseHeaders, ETag: etag, 'Content-Type': asset.kind === 'pack' ? 'application/zip' : 'image/png', 'Content-Length': String(asset.bytes), ...(asset.kind === 'pack' ? { 'Content-Disposition': `attachment; filename="label-${id}.cellarpack.zip"` } : {}) }
  if (request && matches(request, etag)) return new Response(null, { status: 304, headers })
  const object = await env.GALLERY_ART!.get(asset.r2_key)
  if (!object) return json({ error: 'storage_unavailable' }, 503)
  return new Response(object.body, { headers })
}

function projection(row: PublicRow) {
  const metadata = parseGalleryDraft(JSON.parse(row.metadata_json))
  return { id: row.id, catalogId: row.catalog_id, maker: row.published_maker, blend: row.published_blend, ...(metadata.edition ? { edition: metadata.edition } : {}), altText: galleryAltText(metadata, row.published_maker, row.published_blend), artworkProfileId: metadata.artworkProfileId, publishedAt: row.published_at }
}
const columns = 'id,catalog_id,metadata_json,published_maker,published_blend,published_at'

/** Explicit public GET routes only. Authentication and all private routes stay outside this cache. */
export async function publicGalleryRead(request: Request, env: GalleryEnv, deps: PublicReadDependencies): Promise<Response> {
  const clock = () => (deps.now?.() ?? new Date()).getTime()
  const started = clock()
  const url = new URL(request.url)
  const path = url.pathname.slice('/api/gallery/v1'.length)
  const label = path.match(/^\/labels\/([a-f0-9-]+)(?:\/(artwork|thumbnail|pack))?$/)
  const kind = label?.[2]
  const allowed = path === '/labels' ? ['cursor', 'catalogId', 'edition', 'geometry'] : []
  if ([...url.searchParams.keys()].some(key => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return json({ error: 'invalid_filter' }, 400)
  const cursor = url.searchParams.get('cursor') ?? '', catalog = url.searchParams.get('catalogId') ?? '', edition = url.searchParams.get('edition') ?? '', geometry = url.searchParams.get('geometry')
  if ((cursor && !uuid(cursor)) || catalog.length > 200 || edition.length > 120) return json({ error: 'invalid_filter' }, 400)
  // Normalize parameter order, preserve full origin and route identity. Never use an admin-host cache.
  url.searchParams.sort()
  const key = new Request(url.toString())
  const anonymous = !request.headers.has('Authorization') && !request.headers.has('Cookie') && !request.headers.has('Cf-Access-Jwt-Assertion') && url.hostname !== env.GALLERY_ADMIN_HOST && !['admin.tintocellar.com', 'admin-staging.tintocellar.com'].includes(url.hostname)
  const cache = anonymous ? (deps.publicCache === undefined ? (globalThis as typeof globalThis & { caches?: { default?: GalleryPublicCache } }).caches?.default : deps.publicCache) : undefined
  const limiter = kind === 'pack' ? env.GALLERY_PACK_RATE_LIMITER : kind ? env.GALLERY_IMAGE_RATE_LIMITER : env.GALLERY_READ_RATE_LIMITER
  // Even cache hits use their own class; no caller can force an unlimited control refresh.
  if (!limiter || !env.GALLERY_IP_SALT) return json({ error: 'rate_limit_unavailable' }, 503)
  const quotaKey = await sha256(`${env.GALLERY_IP_SALT}:${new Date(started).toISOString().slice(0, 10)}:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`)
  if (!(await limiter.limit({ key: quotaKey })).success) return Response.json({ error: 'rate_limited' }, { status: 429, headers: { ...responseHeaders, 'Retry-After': '60' } })
  const control = await publicControls(env, clock, anonymous)
  if (!control.ready) return json({ error: 'maintenance', message: 'Gallery maintenance is in progress. Please try again shortly.' }, 503)
  const switches = control.switches
  const config = { ...switches, intake: switches.intake && !!env.GALLERY_TURNSTILE_SITE_KEY && !!env.GALLERY_IP_SALT && !!env.GALLERY_RATE_LIMITER && !!env.GALLERY_UPLOAD_RATE_LIMITER && !!env.GALLERY_MUTATION_RATE_LIMITER && (!!env.GALLERY_TURNSTILE_SECRET || !!deps.verifyTurnstile), noticeVersion: GALLERY_NOTICE_VERSION, turnstileSiteKey: env.GALLERY_TURNSTILE_SITE_KEY ?? '' }
  if (!switches.serving && path !== '/config') return path === '/labels' ? json({ labels: [], nextCursor: null, serving: false }) : json({ error: 'not_found' }, 404)
  const ttl = path === '/config' ? 15 : kind === 'pack' ? 0 : kind ? 60 : 30
  if (cache && ttl) {
    let hit: Response | undefined
    try { hit = await cache.match(key) } catch { /* Cache availability never becomes gallery availability. */ }
    if (hit && Number(hit.headers.get(FRESH_UNTIL)) > clock()) {
      // Config switches are refreshed before the hit; do not revive stale serving/intake flags.
      if (path !== '/config') return clientResponse(hit, request, 'HIT')
      const body = await hit.clone().json() as Switches
      if (body.serving === config.serving && body.intake === config.intake && body.publication === config.publication) return clientResponse(hit, request, 'HIT')
    }
    if (hit) void hit.body?.cancel().catch(() => {})
  }
  const db = database(env)
  let response: Response
  if (path === '/config') {
    response = json(config)
  } else if (path === '/labels') {
    if (geometry && geometry !== 'circle-2.5') response = json({ labels: [], nextCursor: null, serving: true })
    else {
      const conditions = ["state='published'", 'id>?'], bindings = [cursor]
      if (catalog) { conditions.push('catalog_id=?'); bindings.push(catalog) }
      if (edition) { conditions.push("json_extract(metadata_json,'$.edition')=?"); bindings.push(edition) }
      const rows = (await db.prepare(`SELECT ${columns} FROM gallery_submissions WHERE ${conditions.join(' AND ')} ORDER BY id LIMIT 25`).bind(...bindings).all<PublicRow>()).results
      response = json({ labels: rows.slice(0, 24).map(projection), nextCursor: rows.length > 24 ? rows[23].id : null, serving: true })
    }
  } else if (label && kind) {
    const asset = await db.prepare("SELECT a.r2_key,a.sha256,a.bytes,a.kind FROM gallery_assets a JOIN gallery_submissions s ON s.id=a.submission_id WHERE s.id=? AND s.state='published' AND a.kind=?").bind(label[1], kind).first<PublicAsset>()
    response = asset ? await streamAsset(env, label[1], asset, request) : json({ error: 'not_found' }, 404)
  } else if (label) {
    const row = await db.prepare(`SELECT ${columns} FROM gallery_submissions WHERE id=? AND state='published'`).bind(label[1]).first<PublicRow>()
    response = row ? json(projection(row)) : json({ error: 'not_found' }, 404)
  } else return json({ error: 'not_found' }, 404)

  if (response.status !== 200 && response.status !== 304) return response
  // Private variants never enter a cache or acquire public cache headers.
  if (!anonymous) return response
  const expires = started + ttl * 1000
  const writes = cache ? pendingWrites.get(cache) ?? new Set<string>() : undefined
  const writeBytes = kind ? Number(response.headers.get('Content-Length')) : 1024 * 1024
  if (cache && writes && !writes.has(key.url) && activeWrites < 64 && reservedWriteBytes + writeBytes <= 16 * 1024 * 1024 && ttl && response.status === 200 && expires > clock() && (!kind || writeBytes <= MAX_CACHED_IMAGE_BYTES)) {
    // Bound simultaneous stream tees across this isolate, including a cold popular image burst.
    pendingWrites.set(cache, writes)
    writes.add(key.url)
    activeWrites++
    reservedWriteBytes += writeBytes
    const stored = response.clone()
    stored.headers.set(FRESH_UNTIL, String(expires))
    stored.headers.set('Cache-Control', `public, max-age=${Math.max(0, Math.floor((expires - clock()) / 1000))}`)
    stored.headers.set('Expires', new Date(expires).toUTCString())
    const writing = Promise.resolve().then(() => cache.put(key, stored)).catch(() => { void stored.body?.cancel().catch(() => {}) }).finally(() => { writes.delete(key.url); activeWrites--; reservedWriteBytes -= writeBytes })
    if (deps.waitUntil) deps.waitUntil(writing)
    else await writing
  }
  return clientResponse(response, request, 'MISS')
}

function clientResponse(response: Response, request: Request, status: 'HIT' | 'MISS') {
  const headers = new Headers(response.headers)
  headers.delete(FRESH_UNTIL)
  headers.delete('Expires')
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  headers.set('X-Gallery-Cache', status)
  const etag = headers.get('ETag')
  if (etag && matches(request, etag)) {
    void response.body?.cancel().catch(() => {})
    return new Response(null, { status: 304, headers })
  }
  return new Response(response.body, { status: response.status, headers })
}
