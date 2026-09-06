import { proofResponse } from './proof'
import type { ProofImages } from './proof'
import { reserveProof, type BudgetBinding } from './budget'
import { bearer, issueAccess } from './access'
export { ProofBudget } from './budget'
interface Env {
  PROOF_BUDGET?: BudgetBinding
  PROOFS_ENABLED?: string
  TURNSTILE_SITE_KEY?: string
  TURNSTILE_SECRET_KEY?: string
  ACCESS_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
  IMAGES?: ProofImages
  ASSETS: { fetch(request: Request): Promise<Response> }
  PROOF_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    if (path === '/api/proof-access') {
      if (request.method === 'GET') return Response.json({ siteKey: env.PROOFS_ENABLED === 'true' && env.TURNSTILE_SECRET_KEY && env.PROOF_BUDGET && env.ACCESS_RATE_LIMITER ? env.TURNSTILE_SITE_KEY ?? null : null }, { headers })
      if (request.method !== 'POST') return new Response(null, { status: 405, headers })
      if (env.PROOFS_ENABLED !== 'true' || !env.ACCESS_RATE_LIMITER) return new Response(null, { status: 503, headers })
      try {
        const result = await env.ACCESS_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })
        if (!result.success) return Response.json({ error: 'Please wait a minute before verifying again.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } })
      } catch { return new Response(null, { status: 503, headers }) }
      return issueAccess(request, env.TURNSTILE_SECRET_KEY, env.PROOF_BUDGET)
    }
    if (path === '/api/proof') {
      if (request.method === 'POST') {
        if (env.PROOFS_ENABLED !== 'true') return Response.json({ error: 'Hosted proofs are paused. Create review guides locally.' }, { status: 503, headers })
        if (!env.PROOF_RATE_LIMITER) return Response.json({ error: 'Proof service is not configured. Create review guides locally.' }, { status: 503, headers })
        let success = false
        try { ({ success } = await env.PROOF_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })) }
        catch { return Response.json({ error: 'Proof limiter unavailable. Create review guides locally.' }, { status: 503, headers }) }
        if (!success) return Response.json({ error: 'Too many proofs. Wait one minute or create guides locally.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } })
        if (!bearer(request)) return Response.json({ error: 'Hosted proofs require verified access from the website. Use local guides otherwise.' }, { status: 401, headers })
      }
      return proofResponse(request, env.IMAGES, () => reserveProof(env.PROOF_BUDGET, bearer(request) ?? undefined))
    }
    if (path === '/api/health' && request.method === 'GET') return Response.json({ status: 'ok', cloudOcrEnabled: false }, { headers })
    if (path === '/api/ocr') return Response.json({ error: 'Cloud OCR is not enabled. Use a text PDF or paste your order.' }, { status: 503, headers })
    if (path.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404, headers })
    return env.ASSETS.fetch(request)
  },
}
