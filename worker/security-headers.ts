// The exact pre-paint theme bootstrap in index.html. A test keeps this hash in
// sync without permitting arbitrary inline scripts.
export const THEME_BOOTSTRAP_HASH = 'sha256-6LDV+pg1G5ppC3e+sNBE9slmstnvD2akDXXqGrJwdUY='

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // Local OCR requires WebAssembly compilation, but JavaScript eval stays blocked.
  `script-src 'self' '${THEME_BOOTSTRAP_HASH}' 'wasm-unsafe-eval' https://challenges.cloudflare.com`,
  // Print geometry and React style properties require inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  // OCR reads local canvas blobs; no remote OCR or provenance fetch is allowed.
  "connect-src 'self' blob: data: https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  // Separate policies intersect: never replace a stricter route/asset policy.
  headers.append('Content-Security-Policy', CONTENT_SECURITY_POLICY)
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
