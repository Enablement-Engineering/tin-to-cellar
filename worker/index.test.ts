import { expect, it, vi } from 'vitest'
import worker from './index'

it('retires unnamespaced label APIs without redirects or asset fallthrough', async () => {
  const env = { ASSETS: { fetch: vi.fn() } }
  for (const path of ['/api/protocol/v1', '/api/protocol/v1/instructions.html', '/api/proof', '/api/proof-access', '/api/sources', '/api/contributions', '/api/ocr']) {
    const response = await worker.fetch(new Request(`https://example.com${path}`), env)
    expect(response.status).toBe(404)
    expect(response.headers.get('Location')).toBeNull()
    expect(await response.json()).toEqual({ error: 'Not found' })
  }
  expect(env.ASSETS.fetch).not.toHaveBeenCalled()
})

it('exposes status and fails closed for OCR without reading or storing uploads', async () => {
  const env = { ASSETS: { fetch: vi.fn() } }
  const response = await worker.fetch(new Request('https://example.com/api/labels/ocr', { method: 'POST', body: 'private document' }), env)
  expect(response.status).toBe(503)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  const health = await worker.fetch(new Request('https://example.com/api/health'), env)
  expect(await health.json()).toEqual({ status: 'ok', cloudOcrEnabled: false })
})

it('rejects retired proof operations before consuming image bytes or calling services', async () => {
  const env = { ASSETS: { fetch: vi.fn() } }
  for (const path of ['/api/labels/proof', '/api/labels/proof-access']) for (const method of ['GET', 'POST']) {
    const request = new Request(`https://example.com${path}`, { method, ...(method === 'POST' ? { body: 'private artwork bytes' } : {}) })
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
    expect(request.bodyUsed).toBe(false)
  }
  expect(env.ASSETS.fetch).not.toHaveBeenCalled()
})
