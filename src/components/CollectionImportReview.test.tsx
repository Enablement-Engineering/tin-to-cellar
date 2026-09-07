// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CollectionImportReview } from './CollectionImportReview'
import { createCollection, type ImportPlan } from '../lib/collection'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('releases partial preview allocations and retries without losing import choices or keyboard focus', () => {
  const collection = createCollection()
  const plan = {
    candidate: { receipt: { id: 'receipt', title: 'My labels' }, designs: ['first', 'second'].map(id => ({ id, item: { label: { maker: 'Maker', blend: id }, artwork: { data: new ArrayBuffer(1), mediaType: 'image/png' } } })) },
    entries: ['first', 'second'].map(designId => ({ designId, kind: 'add', matchRowIds: [] })),
  } as unknown as ImportPlan
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValueOnce('blob:orphan').mockImplementationOnce(() => { throw new Error('Allocation failed') }).mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  const onAccept = vi.fn()
  const { unmount } = render(<CollectionImportReview collection={collection} plan={plan} decisions={{ first: { action: 'add' }, second: { action: 'skip' } }} onChange={vi.fn()} onAccept={onAccept} onCancel={vi.fn()} busy={false} />)
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:orphan')
  expect(screen.getByRole('alert')).toHaveTextContent('Your import and choices are still available.')
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add 1 label' })).toBeEnabled()
  const retry = screen.getByRole('button', { name: 'Retry previews' })
  retry.focus(); fireEvent.click(retry)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Add your new labels' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Review 2 new designs' }))
  expect(screen.getAllByRole('img')).toHaveLength(2)
  expect(screen.getAllByRole('combobox').map(input => (input as HTMLSelectElement).value)).toEqual(['add', 'skip'])
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 label' }))
  expect(onAccept).toHaveBeenCalledTimes(1)
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:second')
})

it('offers replacement for an existing collection and requires affirmative confirmation', () => {
  const collection = createCollection()
  collection.rows = [{ id: 'old', blend: 'Old blend', maker: 'Maker' }] as typeof collection.rows
  const plan = { candidate: { receipt: { id: 'receipt', title: 'Example pack' }, designs: [{ id: 'first', item: { label: { maker: 'Maker', blend: 'New' }, artwork: { data: new ArrayBuffer(1), mediaType: 'image/png' } } }] }, entries: [{ designId: 'first', kind: 'add', matchRowIds: [] }] } as unknown as ImportPlan
  const onReplace = vi.fn(), onAccept = vi.fn()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const { rerender } = render(<CollectionImportReview collection={collection} plan={plan} decisions={{ first: { action: 'add' } }} onChange={vi.fn()} onAccept={onAccept} onCancel={vi.fn()} onReplace={onReplace} busy={false} />)
  const replace = screen.getByRole('button', { name: 'Replace saved labels with this pack' })
  fireEvent.click(replace)
  expect(onReplace).not.toHaveBeenCalled()
  expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Quantities and print settings will reset. Import reports will stay.'))
  confirm.mockReturnValue(true)
  fireEvent.click(replace)
  expect(onReplace).toHaveBeenCalledOnce()
  expect(onAccept).not.toHaveBeenCalled()
  rerender(<CollectionImportReview collection={collection} plan={plan} decisions={{}} onChange={vi.fn()} onAccept={onAccept} onCancel={vi.fn()} onReplace={onReplace} busy={false} invalidated />)
  expect(replace).toBeDisabled()
})
