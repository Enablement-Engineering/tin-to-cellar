import { afterEach, expect, it, vi } from 'vitest'
import worker from './index'

it('prevents framing of public, private, error and conditional responses without replacing route policy', async () => {
  const env = adminEnv()
  vi.spyOn(galleryAuth, 'verifyGalleryAdmin').mockResolvedValue('human')
  env.ASSETS.fetch.mockImplementation(async () => new Response('<main>app</main>', {
    headers: { 'Content-Type': 'text/html', 'Content-Security-Policy': "default-src 'self'", ETag: 'fixture' },
  }))
  for (const url of ['https://tintocellar.com/labels/create', 'https://tintocellar.com/gallery/status', 'https://admin.tintocellar.com/']) {
    const response = await worker.fetch(new Request(url), env)
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self', frame-ancestors 'none'")
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    expect(response.headers.get('ETag')).toBe('fixture')
    expect(await response.text()).toBe('<main>app</main>')
  }
  vi.spyOn(galleryAuth, 'verifyGalleryAdmin').mockResolvedValue(null)
  const denied = await worker.fetch(new Request('https://admin.tintocellar.com/'), env)
  expect(denied.status).toBe(403)
  expect(denied.headers.get('X-Frame-Options')).toBe('DENY')
  env.ASSETS.fetch.mockImplementation(async () => new Response(null, { status: 304 }))
  const conditional = await worker.fetch(new Request('https://tintocellar.com/'), env)
  expect(conditional.status).toBe(304)
  expect(conditional.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'")
})

it('retires unnamespaced label APIs without redirects or asset fallthrough', async () => {
  const env = { ASSETS: { fetch: vi.fn() } }
  for (const path of ['/api/protocol/v1', '/api/protocol/v1/instructions.html', '/api/proof', '/api/proof-access', '/api/sources', '/api/contributions', '/api/ocr']) {
    const response = await worker.fetch(new Request(`https://example.com${path}`), env)
    expect(response.status).toBe(404)
    expect(response.headers.get('Location')).toBeNull()
    expect(await response.json()).toEqual({ error: 'Not found' })
  }
  expect(env.ASSETS.fetch).not.toHaveBeenCalled()
})

it('exposes status and fails closed for OCR without reading or storing uploads', async () => {
  const env = { ASSETS: { fetch: vi.fn() } }
  const response = await worker.fetch(new Request('https://example.com/api/labels/ocr', { method: 'POST', body: 'private document' }), env)
  expect(response.status).toBe(503)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  const health = await worker.fetch(new Request('https://example.com/api/health'), env)
  expect(await health.json()).toEqual({ status: 'ok', cloudOcrEnabled: false, capabilities: ['diagnostic-budget-v1', 'curated-intake-v1', 'curated-reconcile-v1'] })
})

it('rejects retired proof operations before consuming image bytes or calling services', async () => {
  const env = { ASSETS: { fetch: vi.fn() } }
  for (const path of ['/api/labels/proof', '/api/labels/proof-access']) for (const method of ['GET', 'POST']) {
    const request = new Request(`https://example.com${path}`, { method, ...(method === 'POST' ? { body: 'private artwork bytes' } : {}) })
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
    expect(request.bodyUsed).toBe(false)
  }
  expect(env.ASSETS.fetch).not.toHaveBeenCalled()
})

import * as galleryAuth from './gallery/auth'
import * as galleryRoutes from './gallery/routes'
afterEach(() => vi.restoreAllMocks())
const adminEnv = () => ({ GALLERY_ADMIN_HOST: 'admin.tintocellar.com', ASSETS: { fetch: vi.fn(async () => new Response('private app', { headers: { 'Content-Type': 'text/html' } })) } })
it('rejects privileged APIs cross-host before auth, bytes or gallery dispatch', async () => {
  const env=adminEnv(), verify=vi.spyOn(galleryAuth, 'verifyGalleryAdmin'), gallery=vi.spyOn(galleryRoutes, 'galleryResponse')
  for(const host of ['tintocellar.com','www.tintocellar.com','other.workers.dev']) for(const path of ['/api/gallery/v1/admin/submissions','/api/gallery/v1/agent/submissions']) {
    const req=new Request('https://'+host+path,{method:'POST',body:'private'})
    expect((await worker.fetch(req,env)).status).toBe(404);expect(req.bodyUsed).toBe(false)
  }
  expect(verify).not.toHaveBeenCalled();expect(gallery).not.toHaveBeenCalled();expect(env.ASSETS.fetch).not.toHaveBeenCalled()
})
it('redirects legacy public admin page to HTTPS dedicated root without forwarding secrets', async () => {
 const r=await worker.fetch(new Request('https://tintocellar.com/admin/gallery?ignored=private'),adminEnv())
 expect(r.status).toBe(302);expect(r.headers.get('Location')).toBe('https://admin.tintocellar.com/');expect(r.headers.get('Cache-Control')).toBe('no-store')
})
it('requires human auth for admin root, assets and config; denies other APIs even to humans', async () => {
 const env=adminEnv(),verify=vi.spyOn(galleryAuth,'verifyGalleryAdmin').mockResolvedValue(null)
 for(const path of ['/','/assets/app.js','/api/gallery/v1/config'])expect((await worker.fetch(new Request('https://admin.tintocellar.com'+path),env)).status).toBe(403)
 expect(env.ASSETS.fetch).not.toHaveBeenCalled();verify.mockResolvedValue('human')
 const root=await worker.fetch(new Request('https://admin.tintocellar.com/'),env);expect(root.status).toBe(200);expect(root.headers.get('Cache-Control')).toBe('no-store')
 for(const path of ['/api/gallery/v1/submissions','/api/gallery/v1/labels','/api/labels/contributions','/api/health'])expect((await worker.fetch(new Request('https://admin.tintocellar.com'+path),env)).status).toBe(404)
 expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1)
})
it('delegates machine namespace to its own verifier without requiring human auth', async () => {
 const env=adminEnv(),verify=vi.spyOn(galleryAuth,'verifyGalleryAdmin'),gallery=vi.spyOn(galleryRoutes,'galleryResponse').mockResolvedValue(Response.json({error:'machine_guard'},{status:403}))
 const response=await worker.fetch(new Request('https://admin.tintocellar.com/api/gallery/v1/agent/submissions'),env)
 expect(response.status).toBe(403);expect(gallery).toHaveBeenCalledOnce();expect(verify).not.toHaveBeenCalled();expect(env.ASSETS.fetch).not.toHaveBeenCalled()
})
it('preserves public static behavior and local harness routing without a dedicated host', async () => {
 const env=adminEnv();expect((await worker.fetch(new Request('https://tintocellar.com/labels'),env)).status).toBe(200)
 const gallery=vi.spyOn(galleryRoutes,'galleryResponse').mockResolvedValue(Response.json({local:true}))
 const response=await worker.fetch(new Request('http://127.0.0.1:43928/api/gallery/v1/agent/submissions'),{ASSETS:env.ASSETS})
 expect(await response.json()).toEqual({local:true});expect(gallery).toHaveBeenCalledOnce()
})

it('authenticates aggregate budget reads before calling storage', async () => {
  const fetch = vi.fn(async () => Response.json({ used: 0, limit: 1000, paused: false }))
  const env = { ASSETS: { fetch: vi.fn() }, DIAGNOSTICS_READ_TOKEN: 'read-token', CATALOG_CONTRIBUTIONS: { getByName: () => ({ fetch }) } }
  expect((await worker.fetch(new Request('https://site.com/api/labels/diagnostics/budget'), env)).status).toBe(403)
  expect(fetch).not.toHaveBeenCalled()
  const response = await worker.fetch(new Request('https://site.com/api/labels/diagnostics/budget', { headers: { Authorization: 'Bearer read-token' } }), env)
  expect(response.status).toBe(200)
  expect(fetch).toHaveBeenCalledOnce()
})
it('still cleans expired diagnostics when migration fails', async () => {
  const batch = vi.fn(async () => [])
  const statement = { bind: () => statement, run: vi.fn(), first: vi.fn(), all: vi.fn() }
  vi.spyOn(galleryRoutes, 'cleanGallery').mockResolvedValue({ failures: 0 } as Awaited<ReturnType<typeof galleryRoutes.cleanGallery>>)
  const env = { ASSETS: { fetch: vi.fn() }, DIAGNOSTICS: { prepare: () => statement, batch }, CATALOG_CONTRIBUTIONS: { getByName: () => ({ fetch: async () => new Response(null, { status: 503 }) }) } }
  await expect(worker.scheduled(null, env)).rejects.toThrow('Scheduled cleanup incomplete')
  expect(batch).toHaveBeenCalledOnce()
})

it('separates migration authorization from read-only exports and avoids migration on export', async () => {
  const fetch = vi.fn(async (_request: Request) => Response.json({ status: 'migrated', copied: 2 }))
  const statement = { bind: () => statement, run: vi.fn(), first: vi.fn(), all: async () => ({ results: [] }) }
  const env = { ASSETS: { fetch: vi.fn() }, DIAGNOSTICS: { prepare: () => statement, batch: vi.fn() }, DIAGNOSTICS_READ_TOKEN: 'reader', CONTRIBUTION_ADMIN_TOKEN: 'admin', CATALOG_CONTRIBUTIONS: { getByName: () => ({ fetch }) } }
  const migrate = (token?: string, method = 'POST') => worker.fetch(new Request('https://site.com/api/labels/diagnostics/migrate', { method, headers: token ? { Authorization: `Bearer ${token}` } : {} }), env)
  expect((await migrate()).status).toBe(403)
  expect((await migrate('reader')).status).toBe(403)
  expect((await migrate('admin', 'GET')).status).toBe(405)
  const response = await worker.fetch(new Request('https://site.com/api/labels/diagnostics', { headers: { Authorization: 'Bearer reader' } }), env)
  expect(response.status).toBe(200)
  expect(fetch).not.toHaveBeenCalled()
  expect(await (await migrate('admin')).json()).toEqual({ status: 'migrated', copied: 2 })
  expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/migrate')
})

it('keeps analytics config separate from gallery availability and inaccessible on the admin host', async () => {
  const db = { prepare: vi.fn(), batch: vi.fn() }
  const env = { ...adminEnv(), ANALYTICS_ENABLED: 'true', GALLERY: db, ANALYTICS_RATE_LIMITER: { limit: vi.fn() } }
  vi.spyOn(galleryAuth, 'verifyGalleryAdmin').mockResolvedValue(null)
  for (const host of ['tintocellar.com', 'www.tintocellar.com']) {
    const response = await worker.fetch(new Request(`https://${host}/api/analytics/v1/config`), env)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ enabled: true })
  }
  expect((await worker.fetch(new Request('https://admin.tintocellar.com/api/analytics/v1/config'), env)).status).toBe(403)
  vi.spyOn(galleryAuth, 'verifyGalleryAdmin').mockResolvedValue('human')
  expect((await worker.fetch(new Request('https://admin.tintocellar.com/api/analytics/v1/config'), env)).status).toBe(404)
  expect((await worker.fetch(new Request('https://unknown.example/api/analytics/v1/config'), env)).status).toBe(404)
  expect((await worker.fetch(new Request('https://beta-check.tintocellar.com/api/analytics/v1/config'), { ...env, ANALYTICS_PUBLIC_HOST: 'beta-check.tintocellar.com' })).status).toBe(200)
  expect(await (await worker.fetch(new Request('https://tintocellar.com/api/analytics/v1/config'), { ...env, ANALYTICS_ENABLED: 'false' })).json()).toEqual({ enabled: false })
  expect(db.prepare).not.toHaveBeenCalled()
  expect(env.ANALYTICS_RATE_LIMITER.limit).not.toHaveBeenCalled()
})

it('denies admin-host requests before gallery cache dispatch after public warming and in reverse order', async () => {
  const env = adminEnv()
  const verify = vi.spyOn(galleryAuth, 'verifyGalleryAdmin').mockResolvedValue(null)
  const gallery = vi.spyOn(galleryRoutes, 'galleryResponse').mockImplementation(async () => Response.json({ serving: true }, { headers: { 'X-Gallery-Cache': 'HIT' } }))
  for (const path of ['/api/gallery/v1/config', '/api/gallery/v1/labels']) {
    for (const headers of [{}, { Authorization: 'Bearer invalid' }] as HeadersInit[]) {
      expect((await worker.fetch(new Request('https://tintocellar.com' + path, { headers }), env)).status).toBe(200)
      const calls = gallery.mock.calls.length
      expect((await worker.fetch(new Request('https://admin.tintocellar.com' + path, { headers }), env)).status).toBe(403)
      expect(gallery.mock.calls.length).toBe(calls)
    }
    verify.mockResolvedValue('human')
    const admin = await worker.fetch(new Request('https://admin.tintocellar.com' + path), env)
    expect(admin.status).toBe(path.endsWith('/config') ? 200 : 404)
    verify.mockResolvedValue(null)
    expect((await worker.fetch(new Request('https://admin.tintocellar.com' + path), env)).status).toBe(403)
    expect((await worker.fetch(new Request('https://www.tintocellar.com' + path), env)).status).toBe(200)
  }
})

it('fails closed with sanitized operational output when a dependency throws private data', async () => {
  const env = adminEnv()
  env.ASSETS.fetch.mockRejectedValue(new Error('private-token-and-input'))
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const response = await worker.fetch(new Request('https://tintocellar.com/private-path?private=query'), { ...env, OPERATIONAL_METRICS_ENABLED: 'true' })
  expect(response.status).toBe(503)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  expect(await response.json()).toEqual({ error: 'temporarily_unavailable' })
  expect(log).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ route: 'static', status: 503 }))
  expect(JSON.stringify(log.mock.calls)).not.toContain('private')
})
