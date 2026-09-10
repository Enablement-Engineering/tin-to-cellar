// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { GalleryBrowse } from './GalleryBrowse'
import { searchLabels } from './search-labels'
import type { GalleryPublicLabel } from '../../lib/gallery/types'

vi.mock('./client', () => ({ API: '/api/gallery/v1', errorText: (error: Error) => error.message, useConfig: () => ({ config: { serving: true } }) }))
vi.mock('./search-labels', () => ({ searchLabels: vi.fn() }))
vi.mock('./GalleryThumbnail', () => ({ GalleryThumbnail: () => null }))

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetAllMocks() })

it('loads on intersection, prevents concurrent requests, pauses after failure and allows retry', async () => {
  let intersect: IntersectionObserverCallback = () => {}
  const disconnect = vi.fn()
  const observe = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback }
    observe = observe
    disconnect = disconnect
  })
  const search = vi.mocked(searchLabels)
  search.mockResolvedValueOnce({ labels: [], nextCursor: 'page-2' })
  let rejectPage: (error: Error) => void = () => {}
  search.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPage = reject }))
  render(<GalleryBrowse onAdd={vi.fn()} />)
  await screen.findByRole('button', { name: 'Show more labels' })
  await waitFor(() => expect(observe).toHaveBeenCalled())
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

const label = { id: 'design-one', catalogId: 'peterson-nightcap', maker: 'Peterson', blend: 'Nightcap', edition: '', altText: 'A dark blue evening design.', artworkProfileId: 'circle-2.5@1', publishedAt: '2026-09-01' } as GalleryPublicLabel
function mockDialog() {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function () { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function () { this.removeAttribute('open') } })
}

it('keeps unfinished saved requests visible and uses print navigation without a copy count', async () => {
  vi.mocked(searchLabels).mockResolvedValue({ labels: [], nextCursor: null })
  const onView = vi.fn(), onPrint = vi.fn()
  const { rerender } = render(<GalleryBrowse onAdd={vi.fn()} selectedCount={4} readyCount={0} onView={onView} onPrint={onPrint} />)
  fireEvent.click(screen.getByRole('button', { name: 'View your labels' }))
  expect(onView).toHaveBeenCalledOnce()
  expect(screen.getByLabelText('Selection summary')).toHaveTextContent('4 need artwork')
  expect(screen.queryByRole('button', { name: 'Review & print' })).toBeNull()
  rerender(<GalleryBrowse onAdd={vi.fn()} selectedCount={4} readyCount={3} onView={onView} onPrint={onPrint} />)
  fireEvent.click(screen.getByRole('button', { name: 'Review & print' }))
  expect(onPrint).toHaveBeenCalledOnce()
})

it('shows matching action text but waits for saved selection before marking artwork added', async () => {
  vi.mocked(searchLabels).mockResolvedValue({ labels: [label], nextCursor: null })
  const onAdd = vi.fn().mockResolvedValue(undefined)
  const props = { onAdd, getActionLabel: () => 'Use for your Nightcap label' }
  const { rerender } = render(<GalleryBrowse {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Use for your Nightcap label' }))
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith(label))
  await screen.findByRole('button', { name: 'Use for your Nightcap label' })
  expect(screen.queryByRole('button', { name: 'Added to your labels' })).toBeNull()
  rerender(<GalleryBrowse {...props} selectedIds={[label.id]} />)
  expect(screen.getByRole('button', { name: 'Added to your labels' })).toBeDisabled()
})

it('allows creating different artwork from a confirmed catalog blend even when designs exist', async () => {
  mockDialog()
  vi.mocked(searchLabels).mockResolvedValue({ labels: [label], nextCursor: null })
  const onCreate = vi.fn()
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={onCreate} />)
  const input = screen.getByRole('combobox', { name: 'Maker or blend' })
  fireEvent.change(input, { target: { value: 'Peterson Nightcap' } })
  fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' })
  await screen.findByRole('button', { name: 'Add to your labels' })
  fireEvent.click(screen.getByRole('button', { name: 'Choose artwork to create' }))
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Choose a blend for new artwork')
  expect(onCreate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Add to creation request' }))
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ catalogId: expect.any(String), maker: 'Peterson', blend: 'Nightcap' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

it('invalidates catalog identity when search changes and keeps custom review after a save failure', async () => {
  mockDialog()
  vi.mocked(searchLabels).mockResolvedValue({ labels: [], nextCursor: null })
  const onCreate = vi.fn().mockRejectedValueOnce(new Error('Storage is full')).mockResolvedValueOnce(undefined)
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={onCreate} />)
  const input = screen.getByRole('combobox', { name: 'Maker or blend' })
  fireEvent.change(input, { target: { value: 'Peterson Nightcap' } })
  fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.change(input, { target: { value: 'A custom blend' } })
  fireEvent.click(screen.getByRole('button', { name: 'Choose artwork to create' }))
  expect(screen.getByLabelText('Blend name')).toHaveValue('A custom blend')
  fireEvent.change(screen.getByLabelText('Maker optional'), { target: { value: 'My maker' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add to creation request' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full')
  expect(screen.getByLabelText('Blend name')).toHaveValue('A custom blend')
  fireEvent.click(screen.getByRole('button', { name: 'Add to creation request' }))
  await waitFor(() => expect(onCreate).toHaveBeenLastCalledWith({ catalogId: null, maker: 'My maker', blend: 'A custom blend' }))
})

it('canceling creation preserves the search and does not add a request', async () => {
  mockDialog()
  vi.mocked(searchLabels).mockResolvedValue({ labels: [], nextCursor: null })
  const onCreate = vi.fn()
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={onCreate} />)
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Custom blend' } })
  const trigger = screen.getByRole('button', { name: 'Choose artwork to create' })
  trigger.focus(); fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCreate).not.toHaveBeenCalled()
  expect(screen.getByRole('combobox')).toHaveValue('Custom blend')
  expect(trigger).toHaveFocus()
})

it('offers retry after a first-page lookup failure without calling it no results', async () => {
  vi.mocked(searchLabels).mockRejectedValueOnce(new Error('Library unavailable')).mockResolvedValueOnce({ labels: [label], nextCursor: null })
  render(<GalleryBrowse onAdd={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Retry loading designs' }))
  expect(screen.queryByText(/^No labels match/)).toBeNull()
  await screen.findByRole('button', { name: 'Add to your labels' })
})

it('presents each blend as a heading and gives card actions accessible identity context', async () => {
  vi.mocked(searchLabels).mockResolvedValue({ labels: [{ ...label, edition: '2026-09-06' }], nextCursor: null })
  render(<GalleryBrowse onAdd={vi.fn()} />)
  expect(await screen.findByRole('heading', { level: 2, name: 'Nightcap' })).toBeVisible()
  expect(screen.getByRole('article', { name: 'Nightcap Peterson' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Add to your labels' })).toHaveAccessibleDescription('Nightcap Peterson')
  expect(screen.getByRole('link', { name: /Nightcap by Peterson artwork.*opens in a new tab/ })).toHaveAttribute('target', '_blank')
  expect(screen.queryByText('About this design')).not.toBeInTheDocument()
  expect(screen.queryByText('2026-09-06')).not.toBeInTheDocument()
})
