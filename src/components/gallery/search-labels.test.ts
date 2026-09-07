import { afterEach, expect, it, vi } from 'vitest'
import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { searchExactLabels, searchLabels } from './search-labels'
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

it('keeps exact availability, no matches and per-blend pagination distinct', async () => {
  vi.mocked(request).mockResolvedValueOnce({ serving: false, labels: [], nextCursor: null })
  expect((await searchExactLabels('blend')).serving).toBe(false)
  vi.mocked(request).mockResolvedValueOnce({ serving: true, labels: [], nextCursor: null })
  expect(await searchExactLabels('blend')).toEqual({ serving: true, labels: [], nextCursor: null })
  vi.mocked(request).mockResolvedValueOnce({ serving: true, labels: [{ id: 'label', catalogId: 'blend' }], nextCursor: 'label' })
  expect((await searchExactLabels('blend', 'previous')).nextCursor).toBe('label')
  expect(request).toHaveBeenLastCalledWith('/labels?geometry=circle-2.5&catalogId=blend&cursor=previous', { signal: expect.any(AbortSignal) })
  vi.mocked(request).mockRejectedValueOnce(new Error('offline'))
  await expect(searchExactLabels('blend')).rejects.toThrow('offline')
  vi.mocked(request).mockResolvedValueOnce({ labels: [], nextCursor: null })
  await expect(searchExactLabels('blend')).rejects.toThrow('could not be checked')
})

it('does not report an empty browse when serving closes after configuration loaded', async () => {
  vi.mocked(request).mockResolvedValueOnce({ serving: false, labels: [], nextCursor: null })
  await expect(searchLabels(null)).rejects.toThrow('unavailable')
})

it('looks up every requested blend while limiting active requests to four', async () => {
  let active = 0, peak = 0
  vi.mocked(request).mockImplementation(async () => {
    active++; peak = Math.max(peak, active)
    await new Promise(resolve => setTimeout(resolve, 1))
    active--
    return { serving: true, labels: [], nextCursor: null }
  })
  await Promise.all(Array.from({ length: 12 }, (_, index) => searchExactLabels(`blend-${index}`)))
  expect(request).toHaveBeenCalledTimes(12)
  expect(peak).toBe(4)
})

it('removes a cancelled queued lookup without starting it or blocking other rows', async () => {
  const finish: Array<() => void> = []
  vi.mocked(request).mockImplementation(() => new Promise(resolve => finish.push(() => resolve({ serving: true, labels: [], nextCursor: null }))))
  const first = Array.from({ length: 4 }, (_, index) => searchExactLabels(`blend-${index}`))
  await Promise.resolve()
  const controller = new AbortController()
  const cancelled = searchExactLabels('cancelled', undefined, controller.signal)
  const rejection = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejection
  finish.forEach(done => done())
  await Promise.all(first)
  expect(request).toHaveBeenCalledTimes(4)
  vi.mocked(request).mockResolvedValueOnce({ serving: true, labels: [], nextCursor: null })
  await searchExactLabels('next')
  expect(request).toHaveBeenCalledTimes(5)
})
