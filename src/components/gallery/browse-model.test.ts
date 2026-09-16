import { afterEach, expect, it, vi } from 'vitest'
import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { blendKey, browseResults, loadBrowseLabels, searchScore, shuffleIds } from './browse-model'
import { request } from './client'
vi.mock('./client', () => ({ request: vi.fn() }))
afterEach(() => vi.resetAllMocks())
const label: GalleryPublicLabel = { id: 'a', catalogId: 'peterson-nightcap', maker: 'Peterson', blend: 'Nightcap', altText: '', artworkProfileId: 'circle-2.5@1', publishedAt: '2026-09-01' }

it('searches aliases, punctuation, partial words and editions across every published blend', () => {
  const labels = Array.from({ length: 90 }, (_, i) => ({ ...label, id: String(i), catalogId: String(i), maker: 'Cornell & Diehl', blend: `Blend ${i}`, edition: 'Autumn release' }))
  expect(browseResults(labels, 'C&D', '', null, 'best', [])).toHaveLength(90)
  expect(browseResults(labels, 'cornell diehl blend 89', '', null, 'best', []).map(l => l.id)).toEqual(['89'])
  expect(browseResults(labels, 'autum', '', null, 'best', [])).toHaveLength(90)
  expect(searchScore({ ...label, maker: 'G. L. Pease' }, 'GLP Night')).toBe(1)
  expect(searchScore({ ...label, blend: 'Étoile’s' }, 'etoiles')).toBe(0)
})
it('orders by date and keeps exact blend alternatives together when chosen', () => {
  const newer = { ...label, id: 'b', publishedAt: '2026-09-02', edition: 'Winter' }
  const unrelated = { ...newer, id: 'c', catalogId: 'other', blend: 'Other' }
  expect(browseResults([label, unrelated, newer], '', '', blendKey(label), 'recent', []).map(l => l.id)).toEqual(['b', 'a'])
  expect(browseResults([label, newer], '', 'Other maker', null, 'recent', [])).toEqual([])
})
it('shuffles the whole set without duplicates and preserves its relative order when filtering', () => {
  const labels = Array.from({ length: 60 }, (_, i) => ({ ...label, id: String(i), maker: i % 2 ? 'Peterson' : 'Other' }))
  const shuffled = shuffleIds(labels, () => .2)
  expect(new Set(shuffled).size).toBe(60)
  expect(shuffled).not.toEqual(labels.map(l => l.id))
  expect(browseResults(labels, '', 'Peterson', null, 'shuffle', shuffled).map(l => l.id)).toEqual(shuffled.filter(id => Number(id) % 2))
})
it('loads every metadata page, deduplicates, and rejects a failed continuation instead of claiming partial results', async () => {
  const signal = new AbortController().signal
  vi.mocked(request).mockResolvedValueOnce({ serving: true, labels: [label], nextCursor: 'a' }).mockResolvedValueOnce({ serving: true, labels: [label, { ...label, id: 'b' }], nextCursor: null })
  expect(await loadBrowseLabels(signal)).toHaveLength(2)
  expect(request).toHaveBeenLastCalledWith('/browse?cursor=a', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  vi.mocked(request).mockResolvedValueOnce({ serving: true, labels: [label], nextCursor: 'a' }).mockRejectedValueOnce(new Error('offline'))
  await expect(loadBrowseLabels(signal)).rejects.toThrow('offline')
})
it('rejects serving-off and stuck cursors, and stops before requests when cancelled', async () => {
  const signal = new AbortController().signal
  vi.mocked(request).mockResolvedValueOnce({ serving: false, labels: [], nextCursor: null })
  await expect(loadBrowseLabels(signal)).rejects.toThrow('unavailable')
  vi.mocked(request).mockResolvedValue({ serving: true, labels: [label], nextCursor: 'a' })
  await expect(loadBrowseLabels(signal)).rejects.toThrow('completely')
  vi.mocked(request).mockClear()
  await expect(loadBrowseLabels(AbortSignal.abort())).rejects.toThrow()
  expect(request).not.toHaveBeenCalled()
})
