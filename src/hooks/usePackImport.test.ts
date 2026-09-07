// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, expect, it, vi } from 'vitest'
import { usePackImport } from './usePackImport'
import { createCollection, addRequests, updateRow, removeRow } from '../lib/collection/commands'
import { prepareImport } from '../lib/collection/import'
import { collectionFixture } from '../lib/collection/test-fixtures'
import type { Collection } from '../lib/collection/types'
const mocks = vi.hoisted(() => ({ download: vi.fn(), prepare: vi.fn() }))
vi.mock('../components/gallery/pack-builder', () => ({ downloadPublishedPack: mocks.download }))
vi.mock('../lib/import-workflow/prepare', () => ({ preparePackImport: mocks.prepare }))
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })
async function setup(replace = false) {
  vi.stubGlobal('Blob', NodeBlob)
  const pack = await collectionFixture()
  expect(pack.labels).toHaveLength(1)
  const incoming = await prepareImport(pack, { origin: 'gallery', publicationId: 'community' })
  let finishDownload!: (value: unknown) => void
  mocks.download.mockReturnValue(new Promise(resolve => { finishDownload = resolve }))
  mocks.prepare.mockResolvedValue({ incoming, retrospective: null, diagnosticWarning: false })
  let current = replace ? addRequests(createCollection(), [{ catalogId: null, maker: 'Fixture Maker', blend: 'Fixture Blend' }]) : createCollection()
  const commit = async (change: (value: Collection) => Collection) => current = { ...change(current), revision: current.revision + 1 }
  const hook = renderHook(({ collection }) => usePackImport({ collection, ready: true, commit, onStart: () => {}, onImported: () => {} }), { initialProps: { collection: current } })
  let operation!: Promise<unknown>
  await act(async () => { operation = hook.result.current.chooseCommunity({ id: 'community', maker: 'Fixture Maker', blend: 'Fixture Blend' }, replace ? current.rows[0].id : undefined).catch(error => error) })
  return {
    hook,
    change(update: (value: Collection) => Collection) { current = { ...update(current), revision: current.revision + 1 }; hook.rerender({ collection: current }) },
    async complete() { let outcome: unknown; await act(async () => { finishDownload({ file: { name: 'community.zip' }, result: pack }); outcome = await operation }); return { outcome, current } },
  }
}
it('adds a downloaded gallery label after an unrelated print setting changes', async () => {
  const run = await setup()
  run.change(current => ({ ...current, printSettings: { ...current.printSettings, firstSlot: 2 } }))
  const { outcome, current } = await run.complete()
  expect(outcome).toBeUndefined()
  expect(current.rows).toHaveLength(1)
  expect(current.printSettings.firstSlot).toBe(2)
})
it('fills the same requested row after a quantity-only update and preserves that quantity', async () => {
  const run = await setup(true)
  run.change(current => updateRow(current, current.rows[0].id, { quantity: 7 }))
  const { outcome, current } = await run.complete()
  expect(outcome).toBeUndefined()
  expect(current.rows).toHaveLength(1)
  expect(current.rows[0].quantity).toBe(7)
  expect(current.rows[0].designId).not.toBeNull()
})
it.each(['identity', 'notes', 'removed'] as const)('rejects a replacement when its requested row changed: %s', async change => {
  const run = await setup(true)
  run.change(current => change === 'removed' ? removeRow(current, current.rows[0].id) : updateRow(current, current.rows[0].id, change === 'identity' ? { blend: 'Another blend' } : { notes: 'Another edition' }))
  const { outcome, current } = await run.complete()
  expect(outcome).toMatchObject({ code: 'conflict' })
  expect(Object.keys(current.designs)).toHaveLength(0)
})
