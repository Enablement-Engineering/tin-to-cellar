// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { Blob as NodeBlob } from 'node:buffer'
import { encode } from 'fast-png'
import { afterEach, expect, it, vi } from 'vitest'
import { usePackImport } from './usePackImport'
import { createCollection, addRequests, updateRow, removeRow } from '../lib/collection/commands'
import { applyImport, planImport, prepareImport } from '../lib/collection/import'
import { collectionFixture } from '../lib/collection/test-fixtures'
import type { Collection } from '../lib/collection/types'
import { COLLECTION_LIMITS } from '../lib/collection/types'
import { sha256 } from '../lib/collection/validation'
const mocks = vi.hoisted(() => ({ download: vi.fn(), prepare: vi.fn() }))
vi.mock('../components/gallery/pack-builder', () => ({ downloadPublishedPack: mocks.download }))
vi.mock('../lib/import-workflow/prepare', () => ({ preparePackImport: mocks.prepare }))
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })
async function setup(replace = false, fromGallery = false) {
  vi.stubGlobal('Blob', NodeBlob)
  const pack = await collectionFixture()
  expect(pack.labels).toHaveLength(1)
  const incoming = await prepareImport(pack, { origin: 'gallery', publicationId: 'community' })
  let finishDownload!: (value: unknown) => void
  mocks.download.mockReturnValue(new Promise(resolve => { finishDownload = resolve }))
  mocks.prepare.mockResolvedValue({ incoming, retrospective: null, diagnosticWarning: false })
  let current = replace ? addRequests(createCollection(), [{ catalogId: null, maker: 'Fixture Maker', blend: 'Fixture Blend' }]) : createCollection()
  const commit = async (change: (value: Collection) => Collection) => current = { ...change(current), revision: current.revision + 1 }
  const onGalleryAdded = vi.fn()
  const hook = renderHook(({ collection }) => usePackImport({ collection, ready: true, commit, onStart: () => {}, onImported: () => {}, onGalleryAdded }), { initialProps: { collection: current } })
  let operation!: Promise<unknown>
  await act(async () => { operation = hook.result.current.chooseCommunity({ id: 'community', maker: 'Fixture Maker', blend: 'Fixture Blend' }, replace && !fromGallery ? current.rows[0].id : undefined).catch(error => error) })
  return {
    hook,
    onGalleryAdded,
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
  expect(run.onGalleryAdded).toHaveBeenCalledOnce()
})
it('fills the same requested row after a quantity-only update and preserves that quantity', async () => {
  const run = await setup(true)
  run.change(current => updateRow(current, current.rows[0].id, { quantity: 7 }))
  const { outcome, current } = await run.complete()
  expect(outcome).toBeUndefined()
  expect(current.rows).toHaveLength(1)
  expect(current.rows[0].quantity).toBe(7)
  expect(current.rows[0].designId).not.toBeNull()
  expect(run.onGalleryAdded).toHaveBeenCalledOnce()
})
it.each(['identity', 'notes', 'removed'] as const)('rejects a replacement when its requested row changed: %s', async change => {
  const run = await setup(true)
  run.change(current => change === 'removed' ? removeRow(current, current.rows[0].id) : updateRow(current, current.rows[0].id, change === 'identity' ? { blend: 'Another blend' } : { notes: 'Another edition' }))
  const { outcome, current } = await run.complete()
  expect(outcome).toMatchObject({ code: 'conflict' })
  expect(Object.keys(current.designs)).toHaveLength(0)
  expect(run.onGalleryAdded).not.toHaveBeenCalled()
})

async function replacementSetup(failSave = false, origin: 'example' | 'gallery' = 'example') {
  vi.stubGlobal('Blob', NodeBlob)
  const oldPack = await collectionFixture(manifest => { manifest.labels[0].blend = 'Old blend' })
  const oldArtwork = oldPack.labels[0].artwork
  oldArtwork.data = Uint8Array.from(encode({ width: 825, height: 825, channels: 3, data: new Uint8Array(825 * 825 * 3).fill(220) })).buffer
  oldArtwork.asset.sha256 = await sha256(oldArtwork.data)
  const oldCandidate = await prepareImport(oldPack, { origin: 'local' })
  const empty = createCollection()
  let current = applyImport(empty, planImport(empty, oldCandidate))
  current = updateRow(current, current.rows[0].id, { quantity: 7 })
  current = addRequests(current, [{ catalogId: null, maker: 'Maker', blend: 'Pending request' }])
  current.printSettings = { page: 1, firstSlot: 3, offset: { x: .1, y: 0 } }
  const pack = await collectionFixture()
  const candidate = await prepareImport(pack, { origin })
  const before = current
  const onGalleryAdded = vi.fn()
  const hook = renderHook(({ collection }) => usePackImport({ collection, ready: true, commit: async change => {
    const next = change(current)
    if (failSave) throw new Error('Storage full')
    return current = { ...next, revision: current.revision + 1 }
  }, onStart: () => {}, onImported: () => {}, onGalleryAdded }), { initialProps: { collection: current } })
  act(() => hook.result.current.setCandidate(candidate))
  return { hook, candidate, before, onGalleryAdded, current: () => current, change: () => { current = { ...current, revision: current.revision + 1 } } }
}
it('does not count opening review or replacing a row that already has artwork as an added label', async () => {
  const run = await replacementSetup(false, 'gallery')
  expect(run.onGalleryAdded).not.toHaveBeenCalled()
  await act(async () => { await run.hook.result.current.saveCandidate(run.candidate, run.hook.result.current.review!, { [run.candidate.designs[0].id]: { action: 'replace', rowId: run.before.rows[0].id } }) })
  expect(run.onGalleryAdded).not.toHaveBeenCalled()
})
it('atomically replaces saved artwork and pending requests, resetting quantities while keeping reports', async () => {
  const run = await replacementSetup()
  await act(async () => { await run.hook.result.current.replaceCandidate(run.candidate, run.hook.result.current.review!) })
  const saved = run.current()
  expect(saved.rows).toHaveLength(1)
  expect(saved.rows[0]).toMatchObject({ blend: 'Fixture Blend', quantity: 1 })
  expect(saved.printSettings).toEqual({ page: 0, firstSlot: 1, offset: { x: 0, y: 0 } })
  expect(saved.receipts).toHaveLength(2)
  expect(run.hook.result.current.candidate).toBeNull()
  expect(run.before.rows).toHaveLength(2)
  expect(run.before.rows[0].quantity).toBe(7)
})
it('keeps the original saved collection and replacement review when saving fails', async () => {
  const run = await replacementSetup(true)
  await act(async () => { await expect(run.hook.result.current.replaceCandidate(run.candidate, run.hook.result.current.review!)).rejects.toThrow('Storage full') })
  expect(run.current()).toBe(run.before)
  expect(run.hook.result.current.candidate).toBe(run.candidate)
})
it('refuses a replacement if saved work changed since the reviewed plan', async () => {
  const run = await replacementSetup()
  run.change()
  await act(async () => { await expect(run.hook.result.current.replaceCandidate(run.candidate, run.hook.result.current.review!)).rejects.toMatchObject({ code: 'conflict' }) })
  expect(run.current().rows).toEqual(run.before.rows)
  expect(run.hook.result.current.candidate).toBe(run.candidate)
})
it('can replace artwork when retaining both collections would exceed the storage budget', async () => {
  const run = await replacementSetup()
  const limits = COLLECTION_LIMITS as { artworkBytes: number }
  const originalBudget = limits.artworkBytes
  const oldBytes = Object.values(run.before.designs)[0].item.artwork.data.byteLength
  const newBytes = run.candidate.designs[0].item.artwork.data.byteLength
  // Scale only the resource limit, keeping both real, different PNGs valid.
  limits.artworkBytes = Math.max(oldBytes, newBytes)
  try {
    const plan = run.hook.result.current.review!
    await act(async () => { await expect(run.hook.result.current.saveCandidate(run.candidate, plan, { [run.candidate.designs[0].id]: { action: 'add' } })).rejects.toMatchObject({ code: 'capacity' }) })
    expect(run.current()).toBe(run.before)
    await act(async () => { await run.hook.result.current.replaceCandidate(run.candidate, plan) })
    expect(run.current().rows).toHaveLength(1)
    expect(run.current().rows[0].blend).toBe('Fixture Blend')
  } finally { limits.artworkBytes = originalBudget }
})

it('fills an exact pending request when the design is chosen from the gallery', async () => {
  const run = await setup(true, true)
  run.change(current => updateRow(current, current.rows[0].id, { quantity: 5 }))
  const { outcome, current } = await run.complete()
  expect(outcome).toBeUndefined()
  expect(current.rows).toHaveLength(1)
  expect(current.rows[0]).toMatchObject({ quantity: 5, blend: 'Fixture Blend' })
  expect(current.rows[0].designId).toBeTruthy()
})
