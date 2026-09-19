// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PreparationWorkspace, RowNotes, type PreparationWorkspaceProps } from './PreparationWorkspace'
import { searchExactLabels } from './gallery/search-labels'
vi.mock('./gallery/search-labels', () => ({ searchExactLabels: vi.fn() }))
const props = (): PreparationWorkspaceProps => ({ rows: [], onAdd: vi.fn(), onRemove: vi.fn(), onCreate: vi.fn(), onChooseCommunity: vi.fn().mockResolvedValue(undefined), onPrint: vi.fn(), onBrowse: vi.fn(), onImport: vi.fn(), onGenericChat: vi.fn() })
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  vi.mocked(searchExactLabels).mockReset().mockResolvedValue({ labels: [], nextCursor: null, serving: true })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('saves only after choosing an artwork path and returns focus to search', async () => {
  const callbacks = props(); render(<PreparationWorkspace {...callbacks} />)
  const input = screen.getByRole('combobox', { name: 'Add a blend' })
  fireEvent.change(input, { target: { value: 'Peterson Nightcap' } })
  expect(callbacks.onAdd).not.toHaveBeenCalled()
  fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' })
  expect(callbacks.onAdd).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: 'Choose artwork for Nightcap' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Create with AI' }))
  expect(callbacks.onAdd).toHaveBeenCalledWith({ catalogId: expect.any(String), maker: 'Peterson', blend: 'Nightcap' }, 'ai')
  await waitFor(() => expect(input).toHaveValue(''))
  expect(input).toHaveFocus()
  fireEvent.change(input, { target: { value: 'My own blend' } }); fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.click(screen.getByRole('button', { name: 'Create with AI' }))
  await waitFor(() => expect(callbacks.onAdd).toHaveBeenLastCalledWith({ catalogId: null, maker: '', blend: 'My own blend' }, 'ai'))
})

it('distinguishes unavailable lookup from no designs and lets creation continue', async () => {
  vi.mocked(searchExactLabels).mockResolvedValueOnce({ labels: [], nextCursor: null, serving: false })
  const callbacks = props(); render(<PreparationWorkspace {...callbacks} rows={[{ id: 'row', catalogId: 'peterson-nightcap', maker: 'Peterson', blend: 'Nightcap', createRequested: false }]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose design' }))
  await screen.findByText('Community designs are unavailable right now. You can still create your own.')
  expect(screen.queryByText('No community designs for this blend yet.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry community lookup' }))
  await screen.findByText('No community designs for this blend yet.')
  fireEvent.click(screen.getByRole('button', { name: 'Create my own' }))
  expect(callbacks.onCreate).toHaveBeenCalledWith('row', true)
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Close choices' })).not.toBeInTheDocument())
  expect(screen.getByText('Nightcap added to your creation list.')).toBeInTheDocument()
})

it('looks up only expanded rows and can reach rows beyond the discovery eight-ID cutoff', async () => {
  render(<PreparationWorkspace {...props()} rows={Array.from({ length: 9 }, (_, index) => ({ id: `row-${index}`, catalogId: `catalog-${index}`, maker: 'Maker', blend: `Blend ${index}`, createRequested: false }))} />)
  expect(searchExactLabels).not.toHaveBeenCalled()
  for (let index = 0; index < 9; index++) {
    fireEvent.click(within(screen.getByRole('article', { name: `Blend ${index}` })).getByRole('button', { name: 'Choose design' }))
    await waitFor(() => expect(searchExactLabels).toHaveBeenCalledWith(`catalog-${index}`, undefined, expect.any(AbortSignal)))
  }
  expect(searchExactLabels).toHaveBeenCalledWith('catalog-8', undefined, expect.any(AbortSignal))
})

it('keeps ready artwork printable while another row is requested and no generic handoff is exposed', () => {
  const callbacks = props()
  render(<PreparationWorkspace {...callbacks} rows={[
    { id: 'ready', catalogId: null, maker: 'Maker', blend: 'Ready', createRequested: false, artwork: { id: 'ready', maker: 'Maker', blend: 'Ready', imageUrl: 'blob:ready', imageFrame: { left: 0, top: 0, width: 100, height: 100 } } },
    { id: 'pending', catalogId: null, maker: '', blend: 'New', createRequested: true },
  ]} />)
  expect(screen.getByLabelText('Selection summary')).toHaveTextContent('2 selected · 1 ready to print · 1 to create with AI')
  fireEvent.click(screen.getByRole('button', { name: 'Review & print' }))
  expect(callbacks.onPrint).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: 'Choose blends in my AI chat' })).not.toBeInTheDocument()
})

it('opens creation directly from the saved selection without a duplicate list or selection dialog', () => {
  const callbacks = props(), onContinueCreation = vi.fn()
  const rows = [{ id: 'pending', catalogId: null, maker: '', blend: 'New', createRequested: true }]
  const view = render(<PreparationWorkspace {...callbacks} rows={rows} onContinueCreation={onContinueCreation} />)
  expect(screen.getAllByText('New')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Edit creation list' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Create with ChatGPT' }))
  expect(onContinueCreation).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  view.rerender(<PreparationWorkspace {...callbacks} rows={rows} onContinueCreation={onContinueCreation} busy />)
  expect(screen.getByRole('button', { name: 'Create with ChatGPT' })).toBeDisabled()
})

it('does not let a late lookup overwrite another row identity', async () => {
  let finish!: (page: Awaited<ReturnType<typeof searchExactLabels>>) => void
  vi.mocked(searchExactLabels).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const callbacks = props()
  const row = { id: 'same-row', catalogId: 'first', maker: 'Maker', blend: 'First', createRequested: false }
  const view = render(<PreparationWorkspace {...callbacks} rows={[row]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose design' }))
  view.rerender(<PreparationWorkspace {...callbacks} rows={[{ ...row, catalogId: 'second', blend: 'Second' }]} />)
  await screen.findByText('No community designs for this blend yet.')
  await act(async () => finish({ serving: false, labels: [], nextCursor: null }))
  expect(screen.queryByText('Community designs are unavailable right now. You can still create your own.')).not.toBeInTheDocument()
})

it('keeps notes editable while typing and saves only when leaving the field', async () => {
  const onNotes = vi.fn().mockResolvedValue(undefined)
  render(<RowNotes onNotes={onNotes} row={{ id: 'row', catalogId: null, maker: '', blend: 'Custom', createRequested: true }} />)
  const input = screen.getByRole('textbox', { name: 'Requests for Custom optional' })
  fireEvent.change(input, { target: { value: 'Historical edition' } })
  expect(onNotes).not.toHaveBeenCalled()
  fireEvent.blur(input)
  await waitFor(() => expect(onNotes).toHaveBeenCalledWith('row', 'Historical edition'))
})

it('lets a pasted custom name be explicitly matched without automatically selecting artwork', () => {
  const onResolve = vi.fn()
  render(<PreparationWorkspace {...props()} onResolve={onResolve} rows={[{ id: 'row', catalogId: null, maker: '', blend: 'Peterson Nightcap', createRequested: false }]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose design' }))
  expect(onResolve).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Match to Peterson — Nightcap' }))
  expect(onResolve).toHaveBeenCalledWith('row', { catalogId: expect.any(String), maker: 'Peterson', blend: 'Nightcap' })
})

it('retains entered text and catalog identity when saving fails so retry does not change the request', async () => {
  const callbacks = props(), onAdd = vi.fn().mockRejectedValueOnce(new Error('Storage is full')).mockResolvedValue(undefined)
  render(<PreparationWorkspace {...callbacks} onAdd={onAdd} />)
  const input = screen.getByRole('combobox', { name: 'Add a blend' })
  fireEvent.change(input, { target: { value: 'Peterson Nightcap' } })
  fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.click(screen.getByRole('button', { name: 'Create with AI' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full')
  expect(input).toHaveValue('Peterson Nightcap')
  fireEvent.click(screen.getByRole('button', { name: 'Create with AI' }))
  await waitFor(() => expect(input).toHaveValue(''))
  expect(onAdd.mock.calls[1]).toEqual(onAdd.mock.calls[0])
  expect(onAdd.mock.calls[1][0].catalogId).toBeTruthy()
})

it('requires an explicit choice for ambiguous search and selects a sole result with Enter', () => {
  const callbacks = props()
  render(<PreparationWorkspace {...callbacks} />)
  const input = screen.getByRole('combobox', { name: 'Add a blend' })
  fireEvent.change(input, { target: { value: 'Nightcap' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(callbacks.onAdd).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a catalog match')
  fireEvent.change(input, { target: { value: 'Escudo' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(callbacks.onAdd).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: 'Choose artwork for Escudo Navy Deluxe' })).toBeInTheDocument()
})

it('cancels without saving, preserves the search, and prevents pasted lists from bypassing the choice', () => {
  const callbacks = props(); render(<PreparationWorkspace {...callbacks} />)
  const input = screen.getByRole('combobox', { name: 'Add a blend' })
  fireEvent.change(input, { target: { value: 'Family blend' } }); fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(callbacks.onAdd).not.toHaveBeenCalled()
  expect(input).toHaveValue('Family blend'); expect(input).toHaveFocus()
  fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.paste(input, { clipboardData: { getData: () => 'One\nTwo' } })
  expect(screen.getByRole('alert')).toHaveTextContent('Add several blends')
  expect(callbacks.onAdd).not.toHaveBeenCalled()
})

it('keeps a community choice open on failure and blocks cancellation while saving', async () => {
  const design = { id: 'design', catalogId: 'peterson-nightcap', maker: 'Peterson', blend: 'Nightcap', altText: 'Nightcap artwork', artworkProfileId: 'circle-2.5@1' as const, publishedAt: '2026-09-15T00:00:00Z' }
  vi.mocked(searchExactLabels).mockResolvedValue({ labels: [design], nextCursor: null, serving: true })
  let reject!: (reason: Error) => void
  const onAdd = vi.fn().mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail })).mockResolvedValue(undefined)
  render(<PreparationWorkspace {...props()} onAdd={onAdd} />)
  const input = screen.getByRole('combobox', { name: 'Add a blend' })
  fireEvent.change(input, { target: { value: 'Peterson Nightcap' } }); fireEvent.keyDown(input, { key: 'ArrowDown' }); fireEvent.keyDown(input, { key: 'Enter' })
  fireEvent.click(await screen.findByRole('button', { name: 'Use this design' }))
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Create with AI' })).toBeDisabled()
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  await act(async () => reject(new Error('Download failed')))
  expect(screen.getByRole('alert')).toHaveTextContent('Download failed')
  fireEvent.click(screen.getByRole('button', { name: 'Use this design' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(onAdd).toHaveBeenLastCalledWith(expect.objectContaining({ blend: 'Nightcap' }), design)
  expect(input).toHaveFocus()
})

it('does not silently replace an already saved blend', () => {
  const callbacks = props()
  render(<PreparationWorkspace {...callbacks} rows={[{ id: 'saved', catalogId: null, maker: '', blend: 'Family blend', createRequested: true }]} />)
  const input = screen.getByRole('combobox', { name: 'Add a blend' })
  fireEvent.change(input, { target: { value: 'Family blend' } }); fireEvent.keyDown(input, { key: 'Enter' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByText(/Family blend is already saved/)).toBeInTheDocument()
  expect(callbacks.onAdd).not.toHaveBeenCalled()
  expect(within(screen.getByRole('region', { name: 'To create with AI' })).getByRole('article', { name: 'Family blend' })).toBeInTheDocument()
})

it('groups saved artwork correctly while its preview loads and keeps old undecided rows visible', () => {
  render(<PreparationWorkspace {...props()} rows={[
    { id: 'ready', catalogId: null, maker: '', blend: 'Downloaded design', designId: 'saved-design', createRequested: false },
    { id: 'pending', catalogId: null, maker: '', blend: 'Old request', createRequested: false },
  ]} />)
  expect(within(screen.getByRole('region', { name: 'Ready to print' })).getByRole('article', { name: 'Downloaded design' })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Choose artwork' })).getByRole('article', { name: 'Old request' })).toBeInTheDocument()
})

it('does not mark artwork saved when choosing a replacement only opens its review', async () => {
  const design = { id: 'replacement', catalogId: 'peterson-nightcap', maker: 'Peterson', blend: 'Nightcap', altText: 'Nightcap artwork', artworkProfileId: 'circle-2.5@1' as const, publishedAt: '2026-09-15T00:00:00Z' }
  vi.mocked(searchExactLabels).mockResolvedValue({ labels: [design], nextCursor: null, serving: true })
  const callbacks = props()
  render(<PreparationWorkspace {...callbacks} rows={[{ id: 'saved', catalogId: design.catalogId, maker: design.maker, blend: design.blend, designId: 'original', createRequested: false }]} />)
  const row = screen.getByRole('article', { name: 'Nightcap' })
  expect(row).not.toHaveAttribute('data-confirmed')
  fireEvent.click(within(row).getByRole('button', { name: 'Choose design' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use this design' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Close choices' })).not.toBeInTheDocument())
  expect(callbacks.onChooseCommunity).toHaveBeenCalledWith('saved', design)
  expect(row).not.toHaveAttribute('data-confirmed')
})
