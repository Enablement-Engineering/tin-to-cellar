import { afterEach, expect, it, vi } from 'vitest'
import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { searchLabels } from './search-labels'
import { request } from './client'

vi.mock('./client', () => ({ request: vi.fn() }))
afterEach(() => vi.resetAllMocks())

it('merges matching blends across pages without dropping or repeating designs', async () => {
  const all = Array.from({ length: 75 }, (_, index) => ({ id: String(index).padStart(3, '0'), catalogId: index % 2 ? 'a' : 'b' }) as GalleryPublicLabel)
  vi.mocked(request).mockImplementation(async path => {
    const params = new URL(`https://local${path}`).searchParams
    const remaining = all.filter(label => label.catalogId === params.get('catalogId') && label.id > (params.get('cursor') ?? ''))
    return { labels: remaining.slice(0, 24), nextCursor: remaining.length > 24 ? remaining[23].id : null }
  })
  const seen: string[] = []
  let cursor: string | undefined
  do {
    const page = await searchLabels(['a', 'b'], cursor)
    seen.push(...page.labels.map(label => label.id))
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  expect(seen).toEqual(all.map(label => label.id))
})

it('makes no request for no matches, and one unfiltered request when cleared', async () => {
  expect(await searchLabels([])).toEqual({ labels: [], nextCursor: null })
  expect(request).not.toHaveBeenCalled()
  vi.mocked(request).mockResolvedValue({ labels: [], nextCursor: null })
  await searchLabels(null)
  expect(request).toHaveBeenCalledWith('/labels?geometry=circle-2.5', { signal: undefined })
})

it('bounds and deduplicates requests and forwards cancellation to every search', async () => {
  vi.mocked(request).mockResolvedValue({ labels: [], nextCursor: null })
  const controller = new AbortController()
  await searchLabels(['a', 'a', ...Array.from({ length: 12 }, (_, i) => String(i))], undefined, controller.signal)
  expect(request).toHaveBeenCalledTimes(8)
  for (const [, init] of vi.mocked(request).mock.calls) expect(init?.signal).toBe(controller.signal)
})
