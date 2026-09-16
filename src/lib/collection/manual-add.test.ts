import { expect, it } from 'vitest'
import { addManualLabel } from './manual-add'
import { createCollection } from './commands'
import { prepareImport } from './import'
import { collectionFixture } from './test-fixtures'

const identity = { catalogId: 'peterson-nightcap', maker: 'Peterson', blend: 'Nightcap' }
const community = async () => prepareImport(await collectionFixture(manifest => {
  manifest.labels[0].maker = identity.maker; manifest.labels[0].blend = identity.blend
}), { origin: 'gallery', publicationId: '43649b43-8094-4a32-b5ee-8be75208fb61' })

it('adds AI requests without an undecided intermediate row', () => {
  const before = createCollection()
  const after = addManualLabel(before, identity, 'ai')
  expect(before.rows).toEqual([])
  expect(after.rows).toEqual([expect.objectContaining({ ...identity, designId: null, createRequested: true })])
  expect(after.handoff).toBeNull()
})

it('adds the selected community design and receipt together without requesting AI', async () => {
  const before = createCollection(), candidate = await community()
  const after = addManualLabel(before, identity, candidate)
  expect(before.rows).toEqual([])
  expect(after.rows).toEqual([expect.objectContaining({ ...identity, designId: candidate.designs[0].id, createRequested: false })])
  expect(after.receipts).toHaveLength(1)
  expect(after.designs[candidate.designs[0].id].origin).toBe('gallery')
})

it('rejects mismatched or unusable downloaded artwork without changing the collection', async () => {
  const before = createCollection(), candidate = await community()
  expect(() => addManualLabel(before, { catalogId: null, maker: '', blend: 'Another blend' }, candidate)).toThrow('does not match')
  expect(() => addManualLabel(before, identity, { ...candidate, designs: [] })).toThrow('does not match')
  expect(before.rows).toEqual([]); expect(before.receipts).toEqual([])
})

it('does not overwrite existing artwork or duplicate a blend added by another tab', async () => {
  const candidate = await community()
  const before = addManualLabel(createCollection(), identity, candidate)
  const snapshot = structuredClone(before)
  expect(() => addManualLabel(before, identity, 'ai')).toThrow('already saved')
  expect(() => addManualLabel(before, identity, candidate)).toThrow('already saved')
  expect(before).toEqual(snapshot)
})
