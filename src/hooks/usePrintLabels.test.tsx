// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePrintLabels } from './usePrintLabels'
import { createCollection, type Collection } from '../lib/collection'

function collection(ids: string[]): Collection {
  return { ...createCollection(), rows: ids.map(id => ({ id, designId: id })), designs: Object.fromEntries(ids.map(id => [id, { item: {
    artwork: { data: new ArrayBuffer(1), mediaType: 'image/png' },
    label: { maker: 'Maker', blend: id, surface: { finishedSize: { width: 2.5, height: 2.5, unit: 'in' }, bleed: { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' } } },
  } }])) } as Collection
}
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('releases partial allocations on projection failure and permits a later projection', () => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValueOnce('blob:partial').mockImplementationOnce(() => { throw new Error('Allocation failed') }).mockReturnValueOnce('blob:recovered') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  const { result, rerender, unmount } = renderHook(({ value }) => usePrintLabels(value), { initialProps: { value: collection(['a', 'b']) } })
  expect(result.current.labels).toEqual([])
  expect(result.current.error).toContain('Your saved labels are unchanged.')
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:partial')
  rerender({ value: collection(['c']) })
  expect(result.current.labels[0].imageUrl).toBe('blob:recovered')
  expect(result.current.error).toBe('')
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:recovered')
})

it('keeps URLs stable for receipt and quantity changes, releasing them on replacement and unmount', () => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:next') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  const original = collection(['a'])
  const { rerender, unmount } = renderHook(({ value }) => usePrintLabels(value), { initialProps: { value: original } })
  rerender({ value: { ...original, revision: original.revision + 1, rows: original.rows.map(row => ({ ...row, quantity: 3 })) } })
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  rerender({ value: collection(['b']) })
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:first')
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:next')
})
