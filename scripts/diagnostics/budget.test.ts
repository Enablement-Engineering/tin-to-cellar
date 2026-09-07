import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error JavaScript operational command, exercised directly.
import { fetchBudget } from './budget.mjs'

const summary = { version: 1, day: '2026-09-07', used: 1000, limit: 1000, paused: true, resetAt: '2026-09-08T00:00:00.000Z', lastPausedAt: '2026-09-07T12:00:00.000Z' }
describe('aggregate budget command', () => {
  it('requests only budget state and strips unexpected response fields', async () => {
    const fetcher = vi.fn(async () => Response.json({ ...summary, notes: 'not for export' }))
    expect(await fetchBudget({ token: 'test-token', fetcher })).toEqual(summary)
    const [url, options] = fetcher.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.pathname).toBe('/api/labels/diagnostics/budget')
    expect(options.redirect).toBe('error')
  })
  it('refuses remote plaintext without sending credentials', async () => {
    const fetcher = vi.fn()
    await expect(fetchBudget({ token: 'secret', base: 'http://example.com', fetcher })).rejects.toThrow('Use HTTPS')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('does not mistake an unavailable or malformed endpoint for zero usage', async () => {
    await expect(fetchBudget({ token: 'test', fetcher: async () => new Response('private', { status: 403 }) })).rejects.toThrow('403')
    await expect(fetchBudget({ token: 'test', fetcher: async () => Response.json({ ...summary, used: null }) })).rejects.toThrow('Invalid budget')
  })
})
