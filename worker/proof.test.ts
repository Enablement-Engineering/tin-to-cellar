import { expect, it, vi } from 'vitest'
import { encode } from 'fast-png'
import { proofResponse } from './proof'
const url = 'https://example.com/api/proof'
function nativeRenderer() {
  const handle = {
    transform: vi.fn().mockReturnThis(), draw: vi.fn().mockReturnThis(),
    output: vi.fn().mockResolvedValue({ response: ({ headers }: { headers: Record<string, string> }) => new Response('native-proof-bytes', { headers }) }),
  }
  return { input: vi.fn().mockReturnValue(handle), handle }
}
function request(query = '') {
  const input = encode({ width: 128, height: 128, channels: 3, data: new Uint8Array(128 * 128 * 3) })
  return new Request(url + query, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: input.slice().buffer as ArrayBuffer })
}
it('describes the contract and composites a scaled guide with the native renderer', async () => {
  const help = await proofResponse(new Request(url))
  expect((await help.json()).storesUploads).toBe(false)
  const images = nativeRenderer()
  const response = await proofResponse(request(), images, async () => null)
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('X-Proof-Only')).toBe('true')
  expect(Number(response.headers.get('X-Proof-Trim-Radius'))).toBeCloseTo(128 * 2.5 / 2.75 / 2)
  expect(images.handle.transform).toHaveBeenCalledWith({ width: 128, height: 128 })
  expect(images.handle.draw).toHaveBeenCalledWith(images.handle, { top: 0, left: 0 })
  expect(images.handle.output).toHaveBeenCalledWith({ format: 'image/png' })
})
it('rejects unsupported inputs before native processing and fails closed without a renderer', async () => {
  const images = nativeRenderer()
  expect((await proofResponse(new Request(url, { method: 'DELETE' }), images)).status).toBe(405)
  expect((await proofResponse(new Request(url, { method: 'POST', body: '{}' }), images)).status).toBe(415)
  expect((await proofResponse(new Request(url, { method: 'POST', headers: { 'Content-Type': 'image/png', 'Content-Length': '9000000' }, body: 'x' }), images)).status).toBe(413)
  expect((await proofResponse(request('?url=http://localhost'), images)).status).toBe(400)
  expect((await proofResponse(request('?diameter=3'), images)).status).toBe(400)
  expect((await proofResponse(request())).status).toBe(503)
  expect(images.input).not.toHaveBeenCalled()
})

it('does not render when the shared allowance rejects a valid PNG', async () => {
  const images = nativeRenderer(), admit = vi.fn(async () => new Response(null, { status: 429 }))
  expect((await proofResponse(request(), images, admit)).status).toBe(429)
  expect(admit).toHaveBeenCalledOnce()
  expect(images.input).not.toHaveBeenCalled()
})

it('does not spend allowance on malformed or compressed uploads', async () => {
  const images = nativeRenderer(), admit = vi.fn(async () => null)
  const bad = new Request(url, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: 'malformed' })
  expect((await proofResponse(bad, images, admit)).status).toBe(400)
  const compressed = request(); compressed.headers.set('Content-Encoding', 'gzip')
  expect((await proofResponse(compressed, images, admit)).status).toBe(415)
  expect(admit).not.toHaveBeenCalled()
  expect(images.input).not.toHaveBeenCalled()
})

it('times out a stalled upload without rendering or spending allowance', async () => {
  vi.useFakeTimers()
  try {
    const images = nativeRenderer(), admit = vi.fn(async () => null)
    const stream = new ReadableStream<Uint8Array>({ start() {} })
    const pending = proofResponse(new Request(url, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: stream, duplex: 'half' } as RequestInit), images, admit)
    await vi.advanceTimersByTimeAsync(10001)
    expect((await pending).status).toBe(408)
    expect(admit).not.toHaveBeenCalled()
    expect(images.input).not.toHaveBeenCalled()
  } finally { vi.useRealTimers() }
})
