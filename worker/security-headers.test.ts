// @vitest-environment jsdom
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { applySecurityHeaders, CONTENT_SECURITY_POLICY, THEME_BOOTSTRAP_HASH } from './security-headers'

it('allows exactly the theme bootstrap shipped in index.html', () => {
  const html = readFileSync('index.html', 'utf8')
  // Parse an inert document so attributes/casing cannot hide inline scripts.
  const document = new DOMParser().parseFromString(html, 'text/html')
  const scripts = document.querySelectorAll('script:not([src])')
  expect(scripts).toHaveLength(1)
  expect(`sha256-${createHash('sha256').update(scripts[0].textContent ?? '').digest('base64')}`).toBe(THEME_BOOTSTRAP_HASH)
  expect(CONTENT_SECURITY_POLICY.split('; ').find(value => value.startsWith('script-src'))).not.toContain("'unsafe-inline'")
})

it('preserves stronger existing policies, status, validators and body', async () => {
  const response = applySecurityHeaders(new Response('asset', { status: 202, headers: { 'Content-Security-Policy': "connect-src 'none'", ETag: 'version' } }))
  expect(response.headers.get('Content-Security-Policy')).toBe(`connect-src 'none', ${CONTENT_SECURITY_POLICY}`)
  expect(response.headers.get('ETag')).toBe('version')
  expect(response.status).toBe(202)
  expect(await response.text()).toBe('asset')
  expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
})

it('allows local WASM compilation without permitting JavaScript eval', () => {
  const script = CONTENT_SECURITY_POLICY.split('; ').find(value => value.startsWith('script-src'))!
  expect(script.split(' ')).toContain("'wasm-unsafe-eval'")
  expect(script.split(' ')).not.toContain("'unsafe-eval'")
})
