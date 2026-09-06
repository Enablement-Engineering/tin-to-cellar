// Only scripts/gallery/start-local.mjs --test selects this entrypoint. The production
// Worker never imports it. Real local D1/R2 are used with synthetic auth fixtures.
import app, { type Env } from '../../worker'
import { galleryResponse, cleanGallery } from '../../worker/gallery/routes'
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    const admin = request.headers.get('X-Gallery-Test-Admin') === 'reviewer-fixture'
    if (path === '/__test/cleanup' && admin) {
      return Response.json(await cleanGallery(env, new Date(new URL(request.url).searchParams.get('now') ?? new Date().toISOString())))
    }
    if (path.startsWith('/api/gallery/')) return galleryResponse(request, { ...env, GALLERY_AGENT_ENABLED: 'true' }, {
      verifyAdmin: async () => admin ? 'local-reviewer' : null,
      verifyAgent: async req => req.headers.get('X-Gallery-Test-Agent') === 'agent-fixture' ? 'local-agent.access' : null,
      verifyTurnstile: async req => req.headers.get('X-Turnstile-Token') === 'local-turnstile-token',
    })
    if (path === '/admin/gallery' && admin) return env.ASSETS.fetch(request)
    return app.fetch(request, env)
  },
}
