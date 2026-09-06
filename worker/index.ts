import { proofResponse } from './proof'
import type { ProofImages } from './proof'
import { reserveProof, type BudgetBinding } from './budget'
export { ProofBudget } from './budget'
interface Env {
  PROOF_BUDGET?: BudgetBinding
  PROOFS_ENABLED?: string
  IMAGES?: ProofImages
  ASSETS: { fetch(request: Request): Promise<Response> }
  PROOF_RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> }
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    if (path === '/api/proof') {
      if (request.method === 'POST') {
        if (env.PROOFS_ENABLED !== 'true') return Response.json({ error: 'Hosted proofs are paused. Create review guides locally.' }, { status: 503, headers })
        if (!env.PROOF_RATE_LIMITER) return Response.json({ error: 'Proof service is not configured. Create review guides locally.' }, { status: 503, headers })
        let success = false
        try { ({ success } = await env.PROOF_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })) }
        catch { return Response.json({ error: 'Proof limiter unavailable. Create review guides locally.' }, { status: 503, headers }) }
        if (!success) return Response.json({ error: 'Too many proofs. Wait one minute or create guides locally.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } })
      }
      return proofResponse(request, env.IMAGES, () => reserveProof(env.PROOF_BUDGET))
    }
    if (path === '/api/health' && request.method === 'GET') return Response.json({ status: 'ok', cloudOcrEnabled: false }, { headers })
    if (path === '/api/ocr') return Response.json({ error: 'Cloud OCR is not enabled. Use a text PDF or paste your order.' }, { status: 503, headers })
    if (path.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404, headers })
    return env.ASSETS.fetch(request)
  },
}
