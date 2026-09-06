import { contributionsResponse, type ContributionBinding } from './contributions'
export { CatalogContributions } from './contributions'
interface Env {
  CATALOG_CONTRIBUTIONS?: ContributionBinding
  CONTRIBUTION_ADMIN_TOKEN?: string
  CONTRIBUTION_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
  ASSETS: { fetch(request: Request): Promise<Response> }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    if (path === '/api/labels/contributions' || path === '/api/labels/sources') return contributionsResponse(request, env.CATALOG_CONTRIBUTIONS, env.CONTRIBUTION_RATE_LIMITER, env.CONTRIBUTION_ADMIN_TOKEN)
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    if (path === '/api/health' && request.method === 'GET') return Response.json({ status: 'ok', cloudOcrEnabled: false }, { headers })
    if (path === '/api/labels/ocr') return Response.json({ error: 'Cloud OCR is not enabled. Use a text PDF or paste your order.' }, { status: 503, headers })
    if (path.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404, headers })
    return env.ASSETS.fetch(request)
  },
}
