// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GalleryBrowse } from './GalleryBrowse'
import { searchLabels } from './search-labels'

vi.mock('./client', () => ({ API: '/api/gallery/v1', errorText: (error: Error) => error.message, useConfig: () => ({ config: { serving: true } }) }))
vi.mock('./search-labels', () => ({ searchLabels: vi.fn() }))
vi.mock('./GalleryBlendSearch', () => ({ GalleryBlendSearch: () => null }))
vi.mock('./GalleryThumbnail', () => ({ GalleryThumbnail: () => null }))

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetAllMocks() })

it('loads on intersection, prevents concurrent requests, pauses after failure and allows retry', async () => {
  let intersect: IntersectionObserverCallback = () => {}
  const disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback }
    observe() {}
    disconnect = disconnect
  })
  const search = vi.mocked(searchLabels)
  search.mockResolvedValueOnce({ labels: [], nextCursor: 'page-2' })
  let rejectPage: (error: Error) => void = () => {}
  search.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPage = reject }))
  render(<GalleryBrowse onAdd={vi.fn()} />)
  await screen.findByRole('button', { name: 'Show more labels' })
  const enter = () => intersect([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver)
  enter(); enter()
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2))
  expect(search.mock.calls[1][1]).toBe('page-2')
  rejectPage(new Error('Connection lost'))
  await screen.findByRole('button', { name: 'Retry loading labels' })
  expect(disconnect).toHaveBeenCalled()
  search.mockResolvedValueOnce({ labels: [], nextCursor: null })
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading labels' }))
  await waitFor(() => expect(search).toHaveBeenCalledTimes(3))
  await waitFor(() => expect(screen.queryByRole('button', { name: /loading labels|Show more labels/ })).toBeNull())
})

it('keeps manual pagination when IntersectionObserver is unavailable', async () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const search = vi.mocked(searchLabels)
  search.mockResolvedValueOnce({ labels: [], nextCursor: 'page-2' })
  search.mockResolvedValueOnce({ labels: [], nextCursor: null })
  render(<GalleryBrowse onAdd={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Show more labels' }))
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2))
})
