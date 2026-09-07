import { afterEach, expect, it, vi } from 'vitest'
import { boundedJson } from './http'
afterEach(() => vi.useRealTimers())
const request = (body?: BodyInit) => new Request('https://site.com', { method: 'POST', body, duplex: 'half' } as RequestInit)
it('enforces byte limits across chunks and accepts exactly the limit', async () => {
  expect(await boundedJson(request('{}'), { maxBytes: 2 })).toEqual({})
  const body = new ReadableStream({ start(controller) { for (const text of ['"', 'é', '"']) controller.enqueue(new TextEncoder().encode(text)); controller.close() } })
  await expect(boundedJson(request(body), { maxBytes: 3 })).rejects.toMatchObject({ status: 413 })
})
it('classifies missing, malformed, unreadable, and invalid UTF-8 bodies as bad requests', async () => {
  for (const body of [undefined, '{', new Uint8Array([34, 255, 34]), new ReadableStream({ start(controller) { controller.error(new Error('read failed')) } })]) {
    await expect(boundedJson(request(body), { maxBytes: 100 })).rejects.toMatchObject({ status: 400 })
  }
})
it('rejects a stalled stream even after a valid JSON prefix without waiting for cancellation', async () => {
  vi.useFakeTimers()
  const cancel = vi.fn(() => new Promise<void>(() => {}))
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{}')) }, cancel })
  const result = boundedJson(request(stream), { maxBytes: 100, timeoutMs: 20 })
  const assertion = expect(result).rejects.toMatchObject({ status: 408 })
  await vi.advanceTimersByTimeAsync(20)
  await assertion
  expect(cancel).toHaveBeenCalledOnce()
})
