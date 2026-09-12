import { expect, it } from 'vitest'
import { operationalRecord, routeClass } from './operations'

it('records route classes without private paths, payloads, query strings or credentials', () => {
  const request = new Request('https://tintocellar.com/api/gallery/v1/labels/private-id/artwork?secret=sentinel', {
    method: 'POST', headers: { Authorization: 'Bearer private-token' }, body: 'private notes',
  })
  const record = operationalRecord(request, new Response(null, { status: 429, headers: { 'X-Gallery-Cache': 'untrusted-marker' } }), 12.6)
  expect(record).toEqual({ event: 'request-summary', route: 'gallery-artwork', status: 429, durationMs: 13, cache: 'none' })
  expect(JSON.stringify(record)).not.toMatch(/sentinel|private-id|private-token|private notes|https/)
  expect(routeClass(new Request('https://admin.tintocellar.com/api/gallery/v1/labels/x/artwork'), 'admin.tintocellar.com')).toBe('private')
})

it('keeps static paths bounded and distinguishes cache outcomes', () => {
  for (const path of ['/any/private/text', '/assets/app.js', '/labels', '/gallery/status']) {
    expect(routeClass(new Request('https://tintocellar.com' + path))).toBe('static')
  }
  expect(operationalRecord(new Request('https://tintocellar.com/api/gallery/v1/labels'), new Response(null, { headers: { 'X-Gallery-Cache': 'hit' } }), -1)).toMatchObject({ cache: 'hit', durationMs: 0 })
})
