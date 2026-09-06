import type { BudgetBinding } from './budget'

export const ACCESS_HOSTS = ['tintocellar.com', 'www.tintocellar.com']
export const ACCESS_ACTION = 'proof-access'
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
export async function tokenHash(token: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2, '0')).join('')
}
export function bearer(request: Request): string | null {
  const match = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('Authorization') ?? '')
  return match?.[1] ?? null
}
export async function issueAccess(request: Request, secret: string | undefined, budget: BudgetBinding | undefined): Promise<Response> {
  if (!secret || !budget) return Response.json({ error: 'Hosted checks are unavailable. Use local guides.' }, { status: 503, headers })
  if (!ACCESS_HOSTS.some(host => request.headers.get('Origin') === `https://${host}`)) return new Response(null, { status: 403, headers })
  if (request.headers.get('Content-Type') !== 'text/plain' || Number(request.headers.get('Content-Length')) > 2048) return new Response(null, { status: 400, headers })
  const reader = request.body?.getReader()
  if (!reader) return new Response(null, { status: 400, headers })
  const timer = setTimeout(() => { void reader.cancel().catch(() => {}) }, 5000)
  try {
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.length
      if (size > 2048) return new Response(null, { status: 400, headers })
      chunks.push(value)
    }
    const body = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length }
    const token = new TextDecoder().decode(body)
    if (!token.trim()) return new Response(null, { status: 400, headers })
    const verified = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
      body: JSON.stringify({ secret, response: token, remoteip: request.headers.get('CF-Connecting-IP') ?? undefined }),
    })
    const result = await verified.json() as { success?: boolean; hostname?: string; action?: string }
    const expectedHost = new URL(request.headers.get('Origin')!).hostname
    if (!verified.ok || result.success !== true || result.hostname !== expectedHost || result.action !== ACCESS_ACTION) return Response.json({ error: 'Verification failed. Please try again.' }, { status: 403, headers })
    const response = await budget.getByName('proof-budget-v1').fetch(new Request('https://budget/issue', { method: 'POST' }))
    return new Response(response.body, { status: response.status, headers: { ...headers, 'Content-Type': 'application/json', ...(response.headers.has('Retry-After') ? { 'Retry-After': response.headers.get('Retry-After')! } : {}) } })
  } catch {
    return Response.json({ error: 'Verification is unavailable. Use local guides or try again.' }, { status: 503, headers })
  } finally { clearTimeout(timer); void reader.cancel().catch(() => {}); reader.releaseLock() }
}
