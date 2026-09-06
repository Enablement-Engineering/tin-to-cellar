import { afterEach, expect, it, vi } from 'vitest'
import { loadSavedSources } from './saved-sources'
import { buildTinToCellarPrompt } from './prompt'
import { TOBACCO_CATALOG, formatTobacco } from '../tobacco-catalog'
const entry = TOBACCO_CATALOG[0]
const other = TOBACCO_CATALOG[1]
const source = { catalogId: entry.id, url: 'https://retailer.com/package.jpg', status: 'valid' as const, package: 'tin' as const, variant: 'current' as const }
afterEach(() => vi.unstubAllGlobals())
it('resolves only catalog IDs, strips response metadata and embeds direct links only for selected blends', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ catalogId: entry.id, sources: [{ ...source, checkedAt: '2026-09-06' }, { ...source, status: 'wrong-package' }, { ...source, url: 'https://user:secret@retailer.com/private' }, { ...source, catalogId: other.id }] }) })
  vi.stubGlobal('fetch', fetcher)
  const tobaccos = formatTobacco(entry) + '\nprivate custom request'
  const sources = await loadSavedSources(tobaccos, new AbortController().signal)
  expect(sources).toEqual([source])
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0]).toBe(`/api/labels/sources?catalogId=${entry.id}`)
  const prompt = buildTinToCellarPrompt({ tobaccos, savedSources: sources })
  expect(prompt).toContain(source.url)
  expect(prompt).not.toContain('/api/labels/sources?')
  expect(buildTinToCellarPrompt({ tobaccos: formatTobacco(other), savedSources: sources })).not.toContain(source.url)
})
it('omits shortcuts on network failure or malformed responses', async () => {
  for (const response of [{ ok: false }, { ok: true, json: async () => ({ catalogId: other.id, sources: [source] }) }, { ok: true, json: async () => ({ catalogId: entry.id, sources: [null, 'bad'] }) }]) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    expect(await loadSavedSources(formatTobacco(entry), new AbortController().signal)).toEqual([])
  }
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  expect(await loadSavedSources(formatTobacco(entry), new AbortController().signal)).toEqual([])
  expect(buildTinToCellarPrompt({ tobaccos: formatTobacco(entry) })).not.toContain('Saved package source links.')
})
