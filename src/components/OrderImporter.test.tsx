// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { OrderImporter } from './OrderImporter'
import { readOrderImage } from '../lib/order-import/ocr'
vi.mock('../lib/order-import/ocr', () => ({ readOrderImage: vi.fn() }))
afterEach(cleanup)
it('preselects a unique match but waits for Add before importing', () => {
  const onAdd = vi.fn()
  render(<OrderImporter onAdd={onAdd} />)
  fireEvent.click(screen.getByRole('button', { name: 'Import order' }))
  fireEvent.change(screen.getByLabelText('Order text'), { target: { value: 'G. L. Pease\nQuiet Nights 2oz' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find tobaccos' }))
  expect(screen.getByRole('button', { name: 'Add selected tobaccos' })).toBeEnabled()
  expect(screen.getByRole('combobox')).toHaveValue('G. L. Pease — Quiet Nights')
  expect(onAdd).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'G. L. Pease — Quiet Nights' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add selected tobaccos' }))
  expect(onAdd).toHaveBeenCalledWith([{ catalogId: expect.any(String), maker: 'G. L. Pease', blend: 'Quiet Nights' }])
  fireEvent.click(screen.getByRole('button', { name: 'Import order' }))
  expect(screen.getByLabelText('Order text')).toHaveValue('')
})

it('retains reviewed order matches until saving succeeds', async () => {
  const onAdd = vi.fn().mockRejectedValueOnce(new Error('Storage is full')).mockResolvedValue(undefined)
  render(<OrderImporter onAdd={onAdd} />)
  fireEvent.click(screen.getByRole('button', { name: 'Import order' }))
  fireEvent.change(screen.getByLabelText('Order text'), { target: { value: 'G. L. Pease\nQuiet Nights 2oz' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find tobaccos' }))
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
  fireEvent.click(screen.getByRole('button', { name: 'Import order' }))
  fireEvent.change(screen.getByLabelText('Order file'), { target: { files: [new File(['image'], 'order.png', { type: 'image/png' })] } })
    await screen.findByText('1 possible match. Choose the tobacco to add.')
  expect(onAdd).not.toHaveBeenCalled()
  expect(screen.getByRole('combobox')).toHaveValue('Cornell & Diehl — Autumn Evening')
  expect(screen.queryByLabelText('Order text')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Find tobaccos' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Add selected tobaccos' }))
  expect(onAdd).toHaveBeenCalledWith([{ catalogId: expect.any(String), maker: 'Cornell & Diehl', blend: 'Autumn Evening' }])
})

it('discards late OCR results after cancellation', async () => {
  let finish!: (value: string) => void
  vi.mocked(readOrderImage).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  render(<OrderImporter onAdd={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Import order' }))
  fireEvent.change(screen.getByLabelText('Order file'), { target: { files: [new File(['image'], 'order.png', { type: 'image/png' })] } })
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'Cancel reading' }))
  await act(async () => { finish('Orlik\nGolden Sliced') })
  expect(screen.getByRole('status')).toHaveTextContent('Import cancelled.')
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Order text')).not.toBeInTheDocument()
})

 it('leaves ambiguous matches unselected and lets users skip unique matches', () => {
  render(<OrderImporter onAdd={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Import order' }))
  fireEvent.change(screen.getByLabelText('Order text'), { target: { value: 'Golden Sliced\nCornell & Diehl\nAutumn Evening' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find tobaccos' }))
  const selects = screen.getAllByRole('combobox')
  expect(selects[0]).toHaveValue('')
  expect(selects[1]).toHaveValue('Cornell & Diehl — Autumn Evening')
  fireEvent.change(selects[1], { target: { value: '' } })
  expect(screen.getByRole('button', { name: 'Add selected tobaccos' })).toBeDisabled()
})
