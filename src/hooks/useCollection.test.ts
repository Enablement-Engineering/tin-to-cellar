// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createCollection } from '../lib/collection/commands'
import type { Collection } from '../lib/collection/types'
import { useCollection } from './useCollection'
const storage = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), close: vi.fn() }))
vi.mock('../lib/collection', async importOriginal => ({ ...await importOriginal<object>(), createCollectionStore: () => storage }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
it('marks saving at enqueue and keeps it set until every queued write settles, including failures', async () => {
  storage.load.mockResolvedValue(createCollection())
  const writes: { next: Collection; resolve: (value: Collection) => void; reject: (error: Error) => void }[] = []
  storage.save.mockImplementation((_revision: number, next: Collection) => new Promise((resolve, reject) => { writes.push({ next, resolve, reject }) }))
  const { result } = renderHook(useCollection)
  await waitFor(() => expect(result.current.ready).toBe(true))
  let first!: Promise<Collection>, second!: Promise<unknown>
  act(() => {
    first = result.current.commit(current => ({ ...current, printSettings: { ...current.printSettings, firstSlot: 2 } }))
    second = result.current.commit(current => ({ ...current, printSettings: { ...current.printSettings, offset: { x: .1, y: 0 } } })).catch(error => error)
  })
  expect(result.current.saving).toBe(true)
  await waitFor(() => expect(writes).toHaveLength(1))
  await act(async () => { writes[0].resolve({ ...writes[0].next, revision: 1 }); await first })
  expect(result.current.saving).toBe(true)
  await waitFor(() => expect(writes).toHaveLength(2))
  expect(writes[1].next.printSettings).toEqual({ page: 0, firstSlot: 2, offset: { x: .1, y: 0 } })
  await act(async () => { writes[1].reject(new Error('Storage full')); await second })
  expect(result.current.saving).toBe(false)
  expect(result.current.error).toBe('Storage full')
  expect(result.current.collection.printSettings.firstSlot).toBe(2)
})
it('clears the saving flag when a command is rejected before storage is ready', async () => {
  storage.load.mockReturnValue(new Promise(() => {}))
  const { result } = renderHook(useCollection)
  await act(async () => { await expect(result.current.commit(current => current)).rejects.toMatchObject({ code: 'unavailable' }) })
  expect(result.current.saving).toBe(false)
  expect(storage.save).not.toHaveBeenCalled()
})
