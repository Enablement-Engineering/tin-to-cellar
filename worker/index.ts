import { contributionsResponse, type ContributionBinding } from './contributions'
import { cleanDiagnostics, diagnosticsExport, shareNotes, type DiagnosticsDatabase } from './diagnostics'
export { CatalogContributions } from './contributions'
interface Env {
  DIAGNOSTICS?: DiagnosticsDatabase
  DIAGNOSTICS_READ_TOKEN?: string
  CATALOG_CONTRIBUTIONS?: ContributionBinding
  CONTRIBUTION_ADMIN_TOKEN?: string
  CONTRIBUTION_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
  ASSETS: { fetch(request: Request): Promise<Response> }
}
export default {
  async scheduled(_event: unknown, env: Env) {
    if (env.DIAGNOSTICS) {
      if (env.CATALOG_CONTRIBUTIONS) {
        const result = await env.CATALOG_CONTRIBUTIONS.getByName('catalog-contributions-v1').fetch(new Request('https://catalog/migrate', { method: 'POST' }))
        if (!result.ok) throw new Error('Diagnostics migration is incomplete')
      }
      await cleanDiagnostics(env.DIAGNOSTICS)
    }
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path === '/api/labels/diagnostics' && request.method === 'GET') {
      if (!env.DIAGNOSTICS) return Response.json({ error: 'Diagnostics storage is unavailable' }, { status: 503 })
      if (env.DIAGNOSTICS_READ_TOKEN && request.headers.get('Authorization') === `Bearer ${env.DIAGNOSTICS_READ_TOKEN}` && env.CATALOG_CONTRIBUTIONS) {
        const result = await env.CATALOG_CONTRIBUTIONS.getByName('catalog-contributions-v1').fetch(new Request('https://catalog/migrate', { method: 'POST' }))
        if (!result.ok) return Response.json({ error: 'Diagnostics migration is incomplete' }, { status: 503 })
      }
      return diagnosticsExport(request, env.DIAGNOSTICS, env.DIAGNOSTICS_READ_TOKEN)
    }
    if (path === '/api/labels/process-notes') return shareNotes(request, env.DIAGNOSTICS, env.CONTRIBUTION_RATE_LIMITER)
    if (path === '/api/labels/contributions' || path === '/api/labels/sources') return contributionsResponse(request, env.CATALOG_CONTRIBUTIONS, env.CONTRIBUTION_RATE_LIMITER, env.CONTRIBUTION_ADMIN_TOKEN, env.DIAGNOSTICS)
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    if (path === '/api/health' && request.method === 'GET') return Response.json({ status: 'ok', cloudOcrEnabled: false }, { headers })
    if (path === '/api/labels/ocr') return Response.json({ error: 'Cloud OCR is not enabled. Use a text PDF or paste your order.' }, { status: 503, headers })
    if (path.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404, headers })
    return env.ASSETS.fetch(request)
  },
}
