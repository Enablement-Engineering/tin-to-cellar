import { describe, expect, it, vi } from 'vitest'
import worker from './index'
import { PROTOCOL_REVISION } from '../src/lib/protocol'
describe('retired protocol API', () => {
  it('returns 404 instead of serving instructions or the SPA for all former entry points', async () => {
    const env = { ASSETS: { fetch: vi.fn() } }
    for (const path of ['/api/labels/protocol', '/api/labels/protocol/v1', '/api/labels/protocol/v1/instructions.html', `/api/labels/protocol/v1/releases/${PROTOCOL_REVISION}/instructions.md`, '/api/labels/protocol/v1/releases/12/instructions.html', '/api/labels/protocol/v1/releases/12/cellarpack.schema.json']) {
      const response = await worker.fetch(new Request(`https://tintocellar.com${path}`), env)
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Not found' })
    }
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })
})
