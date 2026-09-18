/** Bounded operational labels only. Never include URLs, IDs, headers or bodies. */
export function routeClass(request: Request, adminHost?: string): string {
  const url = new URL(request.url)
  if (url.hostname === adminHost || url.pathname.startsWith('/admin/')) return 'private'
  const path = url.pathname
  if (path === '/api/gallery/v1/config') return 'gallery-config'
  if (path === '/api/gallery/v1/labels') return 'gallery-list'
  if (/^\/api\/gallery\/v1\/labels\/[^/]+\/thumbnail$/.test(path)) return 'gallery-thumbnail'
  if (/^\/api\/gallery\/v1\/labels\/[^/]+\/artwork$/.test(path)) return 'gallery-artwork'
  if (/^\/api\/gallery\/v1\/labels\/[^/]+\/pack$/.test(path)) return 'gallery-pack'
  if (/^\/api\/gallery\/v1\/labels\/[^/]+$/.test(path)) return 'gallery-detail'
  if (path.startsWith('/api/analytics/')) return 'analytics'
  if (path.startsWith('/api/gallery/')) return 'gallery-other'
  if (path.startsWith('/api/')) return 'api-other'
  return 'static'
}

export function operationalRecord(request: Request, response: Response, elapsedMs: number, adminHost?: string) {
  const cache = response.headers.get('X-Gallery-Cache')?.toLowerCase()
  return {
    event: 'request-summary',
    route: routeClass(request, adminHost),
    status: response.status,
    durationMs: Math.max(0, Math.min(3_600_000, Math.round(elapsedMs))),
    cache: cache === 'hit' || cache === 'miss' || cache === 'bypass' ? cache : 'none',
  }
}

/** Inspect only built-in types: exception names, codes, causes and messages may contain private input. */
export function operationalIncident(error: unknown) {
  let exceptionClass = 'unknown'
  try {
    if (error instanceof TypeError) exceptionClass = 'type-error'
    else if (error instanceof RangeError) exceptionClass = 'range-error'
    else if (error instanceof SyntaxError) exceptionClass = 'syntax-error'
    else if (error instanceof ReferenceError) exceptionClass = 'reference-error'
    else if (error instanceof URIError) exceptionClass = 'uri-error'
    else if (error instanceof AggregateError) exceptionClass = 'aggregate-error'
    else if (error instanceof Error) exceptionClass = 'error'
  } catch {
    // Even a thrown Proxy can reject prototype inspection; never inspect it further.
  }
  // Independent of request, session and user identity; generated only for an unexpected failure.
  return { incidentId: crypto.randomUUID(), exceptionClass }
}
