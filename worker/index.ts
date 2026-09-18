import { legacyMigrationResponse, requestLegacyMigration } from './legacy-diagnostics'
import { budgetStatus, type DiagnosticBudgetConfig } from './diagnostic-budget'
import { contributionsResponse, type ContributionBinding } from './contributions'
import { cleanDiagnostics, diagnosticsExport, shareNotes, type DiagnosticsDatabase } from './diagnostics'
import { galleryResponse, cleanGallery } from './gallery/routes'
import { verifyGalleryAdmin } from './gallery/auth'
import type { GalleryEnv } from './gallery/storage'
import { analyticsResponse } from './analytics'
import { cleanUsage, usageCapabilities, usageResponse, type UsageEnv } from './analytics/usage'
import { usageAdminResponse } from './analytics/admin'
import { operationalIncident, operationalRecord } from './operations'
import { applySecurityHeaders } from './security-headers'
export { CatalogContributions } from './contributions'
export interface Env extends GalleryEnv, DiagnosticBudgetConfig, UsageEnv {
  OPERATIONAL_METRICS_ENABLED?: string
  ANALYTICS_PUBLIC_HOST?: string
  GALLERY_ADMIN_HOST?: string
  DIAGNOSTICS?: DiagnosticsDatabase
  DIAGNOSTICS_READ_TOKEN?: string
  CATALOG_CONTRIBUTIONS?: ContributionBinding
  CONTRIBUTION_ADMIN_TOKEN?: string
  CONTRIBUTION_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
  SOURCES_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
  ASSETS: { fetch(request: Request): Promise<Response> }
}
interface WorkerContext { waitUntil(promise: Promise<unknown>): void }
const worker = {
  async scheduled(_event: unknown, env: Env) {
    const migrate = async () => {
      if (!env.DIAGNOSTICS || !env.CATALOG_CONTRIBUTIONS) return
      const result = await requestLegacyMigration(env.CATALOG_CONTRIBUTIONS)
      if (!result.ok) throw new Error('Diagnostics migration is incomplete')
    }
    const galleryCleanup = async () => {
      const result = await cleanGallery(env)
      if (result.failures) throw new Error(`Gallery cleanup has ${result.failures} failed operations`)
    }
    // Independent cleanup still runs if legacy copying needs an operator retry.
    const results = await Promise.allSettled([
      migrate(),
      env.DIAGNOSTICS ? cleanDiagnostics(env.DIAGNOSTICS) : Promise.resolve(),
      galleryCleanup(),
      cleanUsage(env),
    ])
    const failures = results.filter(result => result.status === 'rejected')
    if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Scheduled cleanup incomplete')
  },
  async fetch(request: Request, env: Env, ctx?: WorkerContext): Promise<Response> {
    const url = new URL(request.url), path = url.pathname
    const adminHost = env.GALLERY_ADMIN_HOST
    const usageAdminRoute = path.startsWith('/api/analytics/v2/admin/')
    if (usageAdminRoute && (!adminHost || url.hostname !== adminHost || !['admin.tintocellar.com', 'admin-staging.tintocellar.com'].includes(adminHost))) return Response.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    const machineRoute = path === '/api/gallery/v1/agent' || path.startsWith('/api/gallery/v1/agent/')
    const humanRoute = path === '/api/gallery/v1/admin' || path.startsWith('/api/gallery/v1/admin/')
    const legacyAdminPage = path === '/admin/gallery' || path.startsWith('/admin/gallery/')
    const privateHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
    const notFound = () => Response.json({ error: 'Not found' }, { status: 404, headers: privateHeaders })
    if (adminHost && !['admin.tintocellar.com', 'admin-staging.tintocellar.com'].includes(adminHost)) {
      if (machineRoute || humanRoute || legacyAdminPage || url.hostname === adminHost) return notFound()
    } else if (adminHost) {
      if ((machineRoute || humanRoute) && url.hostname !== adminHost) return notFound()
      if (legacyAdminPage && url.hostname !== adminHost) {
        if (!['GET', 'HEAD'].includes(request.method)) return notFound()
        return new Response(null, { status: 302, headers: { ...privateHeaders, Location: 'https://' + adminHost + '/' } })
      }
      if (url.hostname === adminHost) {
        if (machineRoute) return galleryResponse(request, env)
        if (!await verifyGalleryAdmin(request, env)) return new Response('Reviewer sign-in required.', { status: 403, headers: privateHeaders })
        if (usageAdminRoute) return usageAdminResponse(request, env)
        if (humanRoute || (path === '/api/gallery/v1/config' && request.method === 'GET')) return galleryResponse(request, env)
        if (path.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method)) return notFound()
        const response = await env.ASSETS.fetch(request), headers = new Headers(response.headers)
        for (const [name, value] of Object.entries(privateHeaders)) headers.set(name, value)
        return new Response(response.body, { status: response.status, headers })
      }
    }
    if (path === '/app-version.json') {
      const response = await env.ASSETS.fetch(request)
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'no-store')
      return new Response(response.body, { status: response.status, headers })
    }
    if (path.startsWith('/api/gallery/')) return galleryResponse(request, env, { waitUntil: ctx ? promise => ctx.waitUntil(promise) : undefined })
    if (['/api/analytics/v1/config', '/api/analytics/v1/print-intent', '/api/analytics/v2/config', '/api/analytics/v2/print-intent', '/api/analytics/v2/events', '/api/analytics/v2/progress'].includes(path)) {
      // Production collection is confined to the public origins. Loopback supports isolated tests.
      if (!['tintocellar.com', 'www.tintocellar.com', 'localhost', '127.0.0.1'].includes(url.hostname) && url.hostname !== env.ANALYTICS_PUBLIC_HOST) return notFound()
      if (path.endsWith('/config')) {
        if (request.method !== 'GET') return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { ...privateHeaders, Allow: 'GET' } })
        return Response.json(path.includes('/v1/') ? { enabled: false } : usageCapabilities(env), { headers: privateHeaders })
      }
      if (path.includes('/v1/')) return new Response(null, { status: 204, headers: privateHeaders })
      return path.endsWith('/print-intent') ? analyticsResponse(request, env) : usageResponse(request, env)
    }
    if (path === '/admin/gallery' || path.startsWith('/admin/gallery/')) {
      if (!await verifyGalleryAdmin(request, env)) return new Response('Reviewer sign-in required.', { status: 403, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
      const response = await env.ASSETS.fetch(request)
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'no-store')
      headers.set('Referrer-Policy', 'no-referrer')
      return new Response(response.body, { status: response.status, headers })
    }
    if (path === '/gallery/status') {
      const response = await env.ASSETS.fetch(request)
      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'no-store')
      headers.set('Referrer-Policy', 'no-referrer')
      return new Response(response.body, { status: response.status, headers })
    }
    if (path === '/api/labels/diagnostics/migrate') return legacyMigrationResponse(request, env.CATALOG_CONTRIBUTIONS, env.CONTRIBUTION_ADMIN_TOKEN)
    if (path === '/api/labels/diagnostics/budget') return budgetStatus(request, env.CATALOG_CONTRIBUTIONS, env.DIAGNOSTICS_READ_TOKEN)
    if (path === '/api/labels/diagnostics' && request.method === 'GET') {
      if (!env.DIAGNOSTICS) return Response.json({ error: 'Diagnostics storage is unavailable' }, { status: 503 })
      return diagnosticsExport(request, env.DIAGNOSTICS, env.DIAGNOSTICS_READ_TOKEN)
    }
    if (path === '/api/labels/process-notes') return shareNotes(request, env.DIAGNOSTICS, env.CONTRIBUTION_RATE_LIMITER, env.CATALOG_CONTRIBUTIONS)
    if (path === '/api/labels/contributions' || path === '/api/labels/sources') return contributionsResponse(request, env.CATALOG_CONTRIBUTIONS, env.CONTRIBUTION_RATE_LIMITER, env.CONTRIBUTION_ADMIN_TOKEN, env.DIAGNOSTICS, env.SOURCES_RATE_LIMITER)
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    if (path === '/api/health' && request.method === 'GET') return Response.json({ status: 'ok', cloudOcrEnabled: false, capabilities: ['diagnostic-budget-v1', 'curated-intake-v1', 'curated-reconcile-v1'] }, { headers })
    if (path === '/api/labels/ocr') return Response.json({ error: 'Cloud OCR is not enabled. Use a text PDF or paste your order.' }, { status: 503, headers })
    if (path.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404, headers })
    return env.ASSETS.fetch(request)
  },
}

export default {
  ...worker,
  async fetch(request: Request, env: Env, ctx?: WorkerContext): Promise<Response> {
    const start = performance.now()
    let response: Response
    let incident: ReturnType<typeof operationalIncident> | undefined
    try {
      response = await worker.fetch(request, env, ctx)
    } catch (error) {
      // Do not persist exception messages that may contain D1 values or private input.
      if (env.OPERATIONAL_METRICS_ENABLED === 'true') incident = operationalIncident(error)
      response = Response.json({ error: 'temporarily_unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
    if (env.OPERATIONAL_METRICS_ENABLED === 'true') console.log({ ...operationalRecord(request, response, performance.now() - start, env.GALLERY_ADMIN_HOST), ...incident })
    const headers = new Headers(response.headers)
    if (incident) headers.set('X-Incident-ID', incident.incidentId)
    return applySecurityHeaders(new Response(response.body, { status: response.status, statusText: response.statusText, headers }))
  },
}
