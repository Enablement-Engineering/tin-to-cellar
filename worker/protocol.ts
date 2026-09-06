import { PROTOCOL_REVISION, protocolReleases } from '../src/lib/protocol'

export function protocolResponse(request: Request): Response {
  const path = new URL(request.url).pathname
  const current = path === '/api/protocol/v1'
  const match = /^\/api\/protocol\/v1\/releases\/([1-9][0-9]{0,6})\/(instructions\.md|cellarpack\.schema\.json|feedback\.schema\.json)$/.exec(path)
  const release = protocolReleases[current ? String(PROTOCOL_REVISION) : match?.[1] ?? '']
  const filename = current ? 'instructions.md' : match?.[2] ?? ''
  const body = release?.files[filename]
  const headers = new Headers({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' })
  if (body === undefined) return new Response(request.method === 'HEAD' ? null : 'Protocol release not found', { status: 404, headers })
  if (!['GET', 'HEAD'].includes(request.method)) {
    headers.set('Allow', 'GET, HEAD')
    return new Response(null, { status: 405, headers })
  }
  headers.set('Content-Type', filename.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8')
  headers.set('Cache-Control', current ? 'no-cache' : 'public, max-age=31536000, immutable')
  headers.set('ETag', `"${release.hashes[filename]}"`)
  if (request.headers.get('If-None-Match') === headers.get('ETag')) return new Response(null, { status: 304, headers })
  return new Response(request.method === 'HEAD' ? null : body, { headers })
}
