import { expect, it, vi } from 'vitest'
import worker from './index'
it('exposes status and fails closed for OCR without reading or storing uploads', async () => {
  const env = { ASSETS: { fetch: vi.fn() } }
  const response = await worker.fetch(new Request('https://example.com/api/ocr', { method: 'POST', body: 'private document' }), env)
  expect(response.status).toBe(503)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  const health = await worker.fetch(new Request('https://example.com/api/health'), env)
  expect(await health.json()).toEqual({ status: 'ok', cloudOcrEnabled: false })
})

it('has a kill switch and fails closed on limiter outages', async () => {
  const images = { input: vi.fn() }, limit = vi.fn().mockRejectedValue(new Error('offline'))
  const request = () => new Request('https://example.com/api/proof', { method: 'POST', body: 'unread' })
  const env = { ASSETS: { fetch: vi.fn() }, IMAGES: images, PROOF_RATE_LIMITER: { limit } }
  expect((await worker.fetch(request(), { ...env, PROOFS_ENABLED: 'false' })).status).toBe(503)
  expect(limit).not.toHaveBeenCalled()
  expect((await worker.fetch(request(), { ...env, PROOFS_ENABLED: 'true' })).status).toBe(503)
  expect(images.input).not.toHaveBeenCalled()
})

it('requires a configured limiter and rejects excessive proof requests before processing bytes', async () => {
  const request = () => new Request('https://example.com/api/proof', { method: 'POST', headers: { 'Content-Type': 'image/png', 'CF-Connecting-IP': '192.0.2.1' }, body: 'not decoded' })
  expect((await worker.fetch(request(), { ASSETS: { fetch: vi.fn() } })).status).toBe(503)
  const limit = vi.fn().mockResolvedValue({ success: false })
  const response = await worker.fetch(request(), { ASSETS: { fetch: vi.fn() }, PROOFS_ENABLED: 'true', PROOF_RATE_LIMITER: { limit } })
  expect(response.status).toBe(429)
  expect(response.headers.get('Retry-After')).toBe('60')
  expect(limit).toHaveBeenCalledWith({ key: '192.0.2.1' })
})
