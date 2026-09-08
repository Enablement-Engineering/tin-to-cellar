// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { OrderImporter } from './OrderImporter'
import { readOrderImage } from '../lib/order-import/ocr'
import * as orderImport from '../lib/order-import'
vi.mock('../lib/order-import/ocr', () => ({ readOrderImage: vi.fn() }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
it.each(['cancel', 'close', 'unmount', 'timeout'])('aborts the PDF operation on %s and ignores late results', async action => {
  vi.useFakeTimers()
  let finish!: (value: string) => void
  const read = vi.spyOn(orderImport, 'readOrderPdf').mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = render(<OrderImporter onAdd={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add several blends' }))
  fireEvent.change(screen.getByLabelText('Blend list file'), { target: { files: [new File(['pdf'], 'order.pdf', { type: 'application/pdf' })] } })
  const signal = read.mock.calls[0][1]!
  expect(signal.aborted).toBe(false)
  if (action === 'cancel') {
    const cancel = screen.getByRole('button', { name: 'Cancel reading' })
    cancel.focus(); fireEvent.click(cancel)
    expect(screen.getByRole('button', { name: 'Close blend import' })).toHaveFocus()
  } else if (action === 'close') fireEvent.click(screen.getByRole('button', { name: 'Close blend import' }))
  else if (action === 'unmount') view.unmount()
  else await act(async () => { vi.advanceTimersByTime(90000) })
  expect(signal.aborted).toBe(true)
  await act(async () => { finish('Orlik\nGolden Sliced') })
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  if (action === 'timeout') expect(screen.getByRole('status')).toHaveTextContent('Reading timed out.')
})
it('preselects a unique match but waits for Add before importing', () => {
  const onAdd = vi.fn()
  render(<OrderImporter onAdd={onAdd} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add several blends' }))
  fireEvent.change(screen.getByLabelText('Blend list'), { target: { value: 'G. L. Pease\nQuiet Nights 2oz' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find blends' }))
  expect(screen.getByRole('button', { name: 'Add selected tobaccos' })).toBeEnabled()
  expect(screen.getByRole('combobox')).toHaveValue('G. L. Pease — Quiet Nights')
  expect(onAdd).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'G. L. Pease — Quiet Nights' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add selected tobaccos' }))
  expect(onAdd).toHaveBeenCalledWith([{ catalogId: expect.any(String), maker: 'G. L. Pease', blend: 'Quiet Nights' }])
  fireEvent.click(screen.getByRole('button', { name: 'Add several blends' }))
  expect(screen.getByLabelText('Blend list')).toHaveValue('')
})

it('retains reviewed order matches until saving succeeds', async () => {
  const onAdd = vi.fn().mockRejectedValueOnce(new Error('Storage is full')).mockResolvedValue(undefined)
  render(<OrderImporter onAdd={onAdd} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add several blends' }))
  fireEvent.change(screen.getByLabelText('Blend list'), { target: { value: 'G. L. Pease\nQuiet Nights 2oz' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find blends' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add selected tobaccos' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full')
  expect(screen.getByRole('combobox')).toHaveValue('G. L. Pease — Quiet Nights')
  fireEvent.click(screen.getByRole('button', { name: 'Add selected tobaccos' }))
  await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())
  expect(onAdd.mock.calls[1]).toEqual(onAdd.mock.calls[0])
})

it('reads a screenshot and requires review before importing its names', async () => {
  vi.mocked(readOrderImage).mockResolvedValue('Cornell & Diehl\nAutumn Evening 202')
  const onAdd = vi.fn()
  render(<OrderImporter onAdd={onAdd} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add several blends' }))
  fireEvent.change(screen.getByLabelText('Blend list file'), { target: { files: [new File(['image'], 'order.png', { type: 'image/png' })] } })
    await screen.findByText('1 possible match. Choose the blend to add.')
  expect(onAdd).not.toHaveBeenCalled()
  expect(screen.getByRole('combobox')).toHaveValue('Cornell & Diehl — Autumn Evening')
  expect(screen.queryByLabelText('Blend list')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Find blends' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add selected tobaccos' }))
  expect(onAdd).toHaveBeenCalledWith([{ catalogId: expect.any(String), maker: 'Cornell & Diehl', blend: 'Autumn Evening' }])
})

it('discards late OCR results after cancellation', async () => {
  let finish!: (value: string) => void
  vi.mocked(readOrderImage).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  render(<OrderImporter onAdd={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add several blends' }))
  fireEvent.change(screen.getByLabelText('Blend list file'), { target: { files: [new File(['image'], 'order.png', { type: 'image/png' })] } })
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'Cancel reading' }))
  await act(async () => { finish('Orlik\nGolden Sliced') })
  expect(screen.getByRole('status')).toHaveTextContent('Import cancelled.')
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Blend list')).not.toBeInTheDocument()
})

 it('leaves ambiguous matches unselected and lets users skip unique matches', () => {
  render(<OrderImporter onAdd={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Add several blends' }))
  fireEvent.change(screen.getByLabelText('Blend list'), { target: { value: 'Golden Sliced\nCornell & Diehl\nAutumn Evening' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find blends' }))
  const selects = screen.getAllByRole('combobox')
  expect(selects[0]).toHaveValue('')
  expect(selects[1]).toHaveValue('Cornell & Diehl — Autumn Evening')
  fireEvent.change(selects[1], { target: { value: '' } })
  expect(screen.getByRole('button', { name: 'Add selected tobaccos' })).toBeDisabled()
})

it('opens standalone intake immediately and keeps missing custom names in review until Save', async () => {
  const onAdd = vi.fn().mockResolvedValue(undefined)
  render(<OrderImporter standalone onAdd={onAdd} />)
  expect(screen.queryByRole('button', { name: 'Add several blends' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Choose an image or PDF/ })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Enter blends manually' }))
  fireEvent.change(screen.getByLabelText('Add a missing blend'), { target: { value: 'My cellar mixture' } })
  fireEvent.click(screen.getByRole('button', { name: 'Use “My cellar mixture” as a custom name' }))
  expect(onAdd).not.toHaveBeenCalled()
  expect(screen.getByRole('combobox')).toHaveValue('My cellar mixture')
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 blend and choose designs' }))
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith([{ catalogId: null, maker: '', blend: 'My cellar mixture' }]))
  await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument())
})

it('lets a failed PDF recover with pasted text and leaves saved rows untouched on Cancel review', async () => {
  vi.spyOn(orderImport, 'readOrderPdf').mockRejectedValue(new Error('This PDF appears to be scanned.'))
  const onAdd = vi.fn()
  render(<OrderImporter standalone onAdd={onAdd} />)
  fireEvent.change(screen.getByLabelText('Blend list file'), { target: { files: [new File(['pdf'], 'order.pdf', { type: 'application/pdf' })] } })
  await screen.findByText('This PDF appears to be scanned.')
  expect(screen.getByRole('textbox', { name: 'Blend list' })).toBeVisible()
  fireEvent.change(screen.getByLabelText('Blend list'), { target: { value: 'G. L. Pease\nQuiet Nights 2oz' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find blends' }))
  expect(screen.getByRole('combobox')).toHaveValue('G. L. Pease — Quiet Nights')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel review' }))
  expect(onAdd).not.toHaveBeenCalled()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Choose an image or PDF/ })).toHaveFocus()
})

it('reviews missing catalog names alongside extracted matches and distinguishes saved entries', async () => {
  const onAdd = vi.fn().mockResolvedValue(undefined)
  const catalog = (await import('../lib/tobacco-catalog')).TOBACCO_CATALOG.find(entry => entry.blend === 'Quiet Nights')!
  render(<OrderImporter standalone onAdd={onAdd} rows={[{ id: 'existing', catalogId: catalog.id, maker: catalog.maker, blend: catalog.blend, createRequested: false }]} />)
  fireEvent.change(screen.getByLabelText('Blend list'), { target: { value: 'G. L. Pease\nQuiet Nights 2oz' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find blends' }))
  fireEvent.change(screen.getByLabelText('Add a missing blend'), { target: { value: 'Autumn Evening' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cornell & Diehl — Autumn Evening' }))
  expect(screen.getByText(/1 new blend · 1 already saved/)).toBeInTheDocument()
  expect(onAdd).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Save 2 blends and choose designs' }))
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith([
    { catalogId: catalog.id, maker: catalog.maker, blend: catalog.blend },
    { catalogId: expect.any(String), maker: 'Cornell & Diehl', blend: 'Autumn Evening' },
  ]))
})

it('keeps the original source local and revokes its temporary URL on cancellation', async () => {
  vi.mocked(readOrderImage).mockResolvedValue('Cornell & Diehl\nAutumn Evening')
  const create = vi.fn().mockReturnValue('blob:local-order'), revoke = vi.fn()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
  const onAdd = vi.fn()
  render(<OrderImporter standalone onAdd={onAdd} />)
  const file = new File(['image'], 'order.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Blend list file'), { target: { files: [file] } })
  expect(await screen.findByRole('link', { name: 'Open original file to check for missing blends' })).toHaveAttribute('href', 'blob:local-order')
  expect(create).toHaveBeenCalledWith(file)
  expect(onAdd).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel review' }))
  expect(revoke).toHaveBeenCalledWith('blob:local-order')
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  vi.unstubAllGlobals()
})
