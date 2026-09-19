// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { GalleryBrowse } from './GalleryBrowse'
import { loadBrowseLabels } from './browse-model'
import { useConfig } from './client'
import type { GalleryPublicLabel } from '../../lib/gallery/types'

vi.mock('./client', () => ({ API: '/api/gallery/v1', errorText: (error: Error) => error.message, useConfig: vi.fn(() => ({ config: { serving: true } })) }))
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
  fireEvent.click(screen.getAllByRole('button', { name: 'Create custom labels' })[0])
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Create artwork in your AI chat')
  expect(screen.getByRole('dialog')).toHaveTextContent('Tin to Cellar does not run the AI chat.')
  expect(onCreate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Add to my AI creation list' }))
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
  fireEvent.click(screen.getAllByRole('button', { name: 'Create custom labels' })[0])
  const custom = screen.getByRole('combobox', { name: 'Find a blend' })
  expect(custom).toHaveValue('A custom blend')
  fireEvent.keyDown(custom, { key: 'Enter' })
  fireEvent.change(screen.getByLabelText('Maker optional'), { target: { value: 'My maker' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add to my AI creation list' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full')
  expect(custom).toHaveValue('A custom blend')
  fireEvent.click(screen.getByRole('button', { name: 'Add to my AI creation list' }))
  await waitFor(() => expect(onCreate).toHaveBeenLastCalledWith({ catalogId: null, maker: 'My maker', blend: 'A custom blend' }))
})

it('canceling creation preserves the search and does not add a request', async () => {
  mockDialog()
  vi.mocked(loadBrowseLabels).mockResolvedValue([])
  const onCreate = vi.fn()
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={onCreate} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Maker or blend' }), { target: { value: 'Custom blend' } })
  const trigger = screen.getAllByRole('button', { name: 'Create custom labels' })[0]
  trigger.focus(); fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCreate).not.toHaveBeenCalled()
  expect(screen.getByRole('combobox', { name: 'Maker or blend' })).toHaveValue('Custom blend')
  expect(trigger).toHaveFocus()
})

it('finds a catalog blend from a partial name and clears the selection when the search changes', async () => {
  mockDialog()
  vi.mocked(loadBrowseLabels).mockResolvedValue([])
  const onCreate = vi.fn()
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={onCreate} />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Create custom labels' })[0])
  const modal = within(screen.getByRole('dialog'))
  const input = modal.getByRole('combobox', { name: 'Find a blend' })
  const save = modal.getByRole('button', { name: 'Add to my AI creation list' })
  expect(save).toBeDisabled()
  fireEvent.change(input, { target: { value: 'Escudo' } })
  expect(modal.getByRole('option', { name: 'Escudo Navy Deluxe by A&C Petersen' })).toBeVisible()
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onCreate).not.toHaveBeenCalled()
  expect(modal.getByRole('status')).toHaveTextContent('Escudo Navy DeluxeA&C Petersen')
  expect(save).toBeEnabled()
  expect(modal.queryByLabelText('Maker optional')).toBeNull()
  fireEvent.change(input, { target: { value: 'Nightcap' } })
  expect(save).toBeDisabled()
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(modal.getByRole('alert')).toHaveTextContent('Choose a catalog match')
  fireEvent.click(modal.getByRole('option', { name: 'Nightcap by Peterson' }))
  fireEvent.click(save)
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ catalogId: expect.any(String), maker: 'Peterson', blend: 'Nightcap' }))
})

it('lets a catalog selection be changed to an explicit custom name before saving', async () => {
  mockDialog()
  vi.mocked(loadBrowseLabels).mockResolvedValue([])
  const onCreate = vi.fn()
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={onCreate} />)
  const search = screen.getByRole('combobox', { name: 'Maker or blend' })
  fireEvent.change(search, { target: { value: 'Peterson Nightcap' } })
  fireEvent.keyDown(search, { key: 'ArrowDown' }); fireEvent.keyDown(search, { key: 'Enter' })
  fireEvent.click(screen.getAllByRole('button', { name: 'Create custom labels' })[0])
  const input = screen.getByRole('combobox', { name: 'Find a blend' })
  fireEvent.change(input, { target: { value: 'Nightcap' } })
  fireEvent.click(screen.getByRole('option', { name: 'Use “Nightcap” without a catalog match' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add to my AI creation list' }))
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ catalogId: null, maker: '', blend: 'Nightcap' }))
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
  expect(screen.getByRole('button', { name: /Nightcap by Peterson artwork/ })).toHaveAttribute('aria-haspopup', 'dialog')
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

it('shuffles by default and retains that order while filtering, selecting, and returning to the mounted gallery', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const labels = Array.from({ length: 8 }, (_, i) => ({ ...label, id: `design-${i}`, blend: `Blend ${i}`, maker: i % 2 ? 'Peterson' : 'Other' }))
  vi.mocked(loadBrowseLabels).mockResolvedValue(labels)
  const onAdd = vi.fn().mockResolvedValue(undefined)
  const view = render(<GalleryBrowse onAdd={onAdd} />)
  await screen.findByText('8 designs · Showing 8')
  expect(screen.queryByRole('button', { name: /shuffle/i })).toBeNull()
  expect(screen.getByRole('option', { name: 'Shuffled', selected: true })).toBeInTheDocument()
  expect(screen.getAllByRole('article').map(article => article.getAttribute('aria-labelledby'))).toEqual(
    [...labels.slice(1), labels[0]].map(label => `gallery-blend-${label.id} gallery-maker-${label.id}`),
  )
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
  const create = screen.getByRole('button', { name: 'Create a label for Early Morning Pipe' })
  mockDialog()
  fireEvent.click(create)
  expect(screen.getByRole('combobox', { name: 'Find a blend' })).toHaveValue('Peterson — Early Morning Pipe')
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


it.each(['loading', 'unavailable', 'failed'] as const)('keeps creation and import available when gallery config is %s', state => {
  mockDialog()
  vi.mocked(useConfig).mockReturnValue({ config: state === 'unavailable' ? { serving: false, intake: false, noticeVersion: '', turnstileSiteKey: '' } : null, error: state === 'failed' ? 'Library unavailable' : '' })
  const onImport = vi.fn(), onCreate = vi.fn()
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={onCreate} onImport={onImport} />)
  fireEvent.click(screen.getByRole('button', { name: 'Import a label ZIP' }))
  expect(onImport).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Create custom labels' }))
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(onCreate).not.toHaveBeenCalled()
})

it('does not describe a restrictive maker filter as missing blend artwork', async () => {
  vi.mocked(loadBrowseLabels).mockResolvedValue([label, { ...label, id: 'other', maker: 'Other maker', blend: 'Other blend', catalogId: 'other-blend' }])
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Nightcap' })
  const input = screen.getByRole('combobox', { name: 'Maker or blend' })
  fireEvent.change(input, { target: { value: 'Peterson Nightcap' } })
  fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.change(screen.getByRole('combobox', { name: /^Maker$/ }), { target: { value: 'Other maker' } })
  expect(screen.getByRole('heading', { name: 'No designs match these filters' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Create a label for Nightcap' })).toBeNull()
})


it('chooses the pointer-highlighted suggestion with Enter without prematurely saving', () => {
  mockDialog()
  vi.mocked(loadBrowseLabels).mockResolvedValue([])
  const onCreate = vi.fn()
  render(<GalleryBrowse onAdd={vi.fn()} onCreate={onCreate} />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Create custom labels' })[0])
  const input = screen.getByRole('combobox', { name: 'Find a blend' })
  fireEvent.change(input, { target: { value: 'cor' } })
  const option = screen.getByRole('option', { name: 'Adagio by Cornell & Diehl' })
  fireEvent.mouseMove(option)
  expect(input).toHaveAttribute('aria-activedescendant', option.id)
  expect(option).toHaveAttribute('aria-selected', 'true')
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(input).toHaveValue('Cornell & Diehl — Adagio')
  expect(input).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('button', { name: 'Add to my AI creation list' })).toBeEnabled()
  expect(onCreate).not.toHaveBeenCalled()
  // The next Enter must reach the form's native implicit submission.
  expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(true)
})
