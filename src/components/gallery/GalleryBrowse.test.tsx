// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { GalleryBrowse } from './GalleryBrowse'
import { loadBrowseLabels } from './browse-model'
import type { GalleryPublicLabel } from '../../lib/gallery/types'

vi.mock('./client', () => ({ API: '/api/gallery/v1', errorText: (error: Error) => error.message, useConfig: () => ({ config: { serving: true } }) }))
vi.mock('./browse-model', async importOriginal => ({ ...await importOriginal<typeof import('./browse-model')>(), loadBrowseLabels: vi.fn() }))
vi.mock('./GalleryThumbnail', () => ({ GalleryThumbnail: () => null }))

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetAllMocks() })

const label = { id: 'design-one', catalogId: 'peterson-nightcap', maker: 'Peterson', blend: 'Nightcap', edition: '', altText: 'A dark blue evening design.', artworkProfileId: 'circle-2.5@1', publishedAt: '2026-09-01' } as GalleryPublicLabel
function mockDialog() {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function () { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function () { this.removeAttribute('open') } })
}

it('keeps unfinished saved requests visible and uses print navigation without a copy count', async () => {
  vi.mocked(loadBrowseLabels).mockResolvedValue([])
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
  vi.mocked(loadBrowseLabels).mockResolvedValue([label])
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
  vi.mocked(loadBrowseLabels).mockResolvedValue([label])
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
  vi.mocked(loadBrowseLabels).mockResolvedValue([])
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
  vi.mocked(loadBrowseLabels).mockResolvedValue([])
  const onCreate = vi.fn()
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={onCreate} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Maker or blend' }), { target: { value: 'Custom blend' } })
  const trigger = screen.getByRole('button', { name: 'Choose artwork to create' })
  trigger.focus(); fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCreate).not.toHaveBeenCalled()
  expect(screen.getByRole('combobox', { name: 'Maker or blend' })).toHaveValue('Custom blend')
  expect(trigger).toHaveFocus()
})

it('offers retry after a first-page lookup failure without calling it no results', async () => {
  vi.mocked(loadBrowseLabels).mockRejectedValueOnce(new Error('Library unavailable')).mockResolvedValueOnce([label])
  render(<GalleryBrowse onAdd={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Retry loading designs' }))
  expect(screen.queryByText(/^No labels match/)).toBeNull()
  await screen.findByRole('button', { name: 'Add to your labels' })
})

it('presents each blend as a heading and gives card actions accessible identity context', async () => {
  vi.mocked(loadBrowseLabels).mockResolvedValue([{ ...label, edition: '2026-09-06' }])
  render(<GalleryBrowse onAdd={vi.fn()} />)
  expect(await screen.findByRole('heading', { level: 2, name: 'Nightcap' })).toBeVisible()
  expect(screen.getByRole('article', { name: 'Nightcap Peterson' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Add to your labels' })).toHaveAccessibleDescription('Nightcap Peterson')
  expect(screen.getByRole('link', { name: /Nightcap by Peterson artwork.*opens in a new tab/ })).toHaveAttribute('target', '_blank')
  expect(screen.queryByText('About this design')).not.toBeInTheDocument()
  expect(screen.queryByText('2026-09-06')).not.toBeInTheDocument()
})


it('searches the complete library and paginates cards without repeating metadata requests', async () => {
  const labels = Array.from({ length: 60 }, (_, i) => ({ ...label, id: `design-${i}`, catalogId: `blend-${i}`, maker: 'Cornell & Diehl', blend: `Blend ${String(i).padStart(2, '0')}` }))
  vi.mocked(loadBrowseLabels).mockResolvedValue(labels)
  render(<GalleryBrowse onAdd={vi.fn()} />)
  await screen.findByText('60 designs · Showing 24')
  expect(screen.getAllByRole('article')).toHaveLength(24)
  fireEvent.change(screen.getByRole('combobox', { name: 'Maker or blend' }), { target: { value: 'C&D' } })
  expect(screen.getByText('60 designs matching “C&D” · Showing 24')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Show more labels' }))
  expect(screen.getAllByRole('article')).toHaveLength(48)
  expect(vi.mocked(loadBrowseLabels)).toHaveBeenCalledOnce()
  fireEvent.change(screen.getByRole('combobox', { name: 'Maker or blend' }), { target: { value: 'Blend 59' } })
  expect(screen.getByRole('heading', { name: 'Blend 59' })).toBeVisible()
  expect(screen.getAllByRole('article')).toHaveLength(1)
})

it('retains a shuffled order and filters while selecting designs and returning to the mounted gallery', async () => {
  const labels = Array.from({ length: 8 }, (_, i) => ({ ...label, id: `design-${i}`, blend: `Blend ${i}`, maker: i % 2 ? 'Peterson' : 'Other' }))
  vi.mocked(loadBrowseLabels).mockResolvedValue(labels)
  const onAdd = vi.fn().mockResolvedValue(undefined)
  const view = render(<GalleryBrowse onAdd={onAdd} />)
  await screen.findByText('8 designs · Showing 8')
  fireEvent.click(screen.getByRole('button', { name: 'Shuffle designs' }))
  const order = screen.getAllByRole('article').map(article => article.textContent)
  fireEvent.change(screen.getByRole('combobox', { name: 'Maker' }), { target: { value: 'Peterson' } })
  expect(screen.getAllByRole('article')).toHaveLength(4)
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.getAllByRole('article').map(article => article.textContent)).toEqual(order)
  fireEvent.click(screen.getAllByRole('button', { name: 'Add to your labels' })[0])
  await waitFor(() => expect(onAdd).toHaveBeenCalledOnce())
  await waitFor(() => expect(screen.queryByText('Adding design…')).toBeNull())
  view.rerender(<GalleryBrowse onAdd={onAdd} selectedIds={[onAdd.mock.calls[0][0].id]} />)
  expect(screen.getByRole('combobox', { name: 'Order' })).toHaveValue('shuffle')
  expect(screen.getAllByRole('heading', { level: 2 }).filter(el => el.id.startsWith('gallery-blend')).map(el => el.textContent)).toEqual(order.map(text => text?.match(/Blend \d/)?.[0]))
})

it('distinguishes a chosen catalog blend with no artwork and offers alternatives for published blends', async () => {
  vi.mocked(loadBrowseLabels).mockResolvedValue([label, { ...label, id: 'alternative', edition: 'Winter edition' }])
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={vi.fn()} />)
  await screen.findByText('Winter edition')
  fireEvent.click(screen.getAllByRole('button', { name: 'View all 2 designs for Nightcap by Peterson' })[0])
  expect(screen.getAllByRole('article')).toHaveLength(2)
  const input = screen.getByRole('combobox', { name: 'Maker or blend' })
  fireEvent.change(input, { target: { value: 'Peterson Early Morning Pipe' } })
  expect(screen.getByRole('option', { name: /Early Morning Pipe.*Peterson/ })).toHaveTextContent('No artwork yet')
  fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.getByRole('heading', { name: 'No community artwork for this blend yet' })).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Create artwork for Early Morning Pipe' })).toBeVisible()
})

it('sorts makers by available artwork count with alphabetical ties', async () => {
  vi.mocked(loadBrowseLabels).mockResolvedValue([
    { ...label, id: 'a', maker: 'Zeta' }, { ...label, id: 'b', maker: 'Zeta' },
    { ...label, id: 'c', maker: 'Beta' }, { ...label, id: 'd', maker: 'Alpha' },
  ])
  render(<GalleryBrowse onAdd={vi.fn()} />)
  await screen.findByText('4 designs · Showing 4')
  const maker = screen.getByRole('combobox', { name: 'Maker' }) as HTMLSelectElement
  expect(Array.from(maker.options, option => option.textContent)).toEqual(['All makers', 'Zeta (2)', 'Alpha (1)', 'Beta (1)'])
})
