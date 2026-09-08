import { expect, it } from 'vitest'
import { createCollection, removeRow } from './commands'
import { applyImport, planImport, prepareImport } from './import'
import { collectionFixture } from './test-fixtures'
import { isUploadedReceipt } from './history'
import { assertCollection } from './validation'

it('retains uploaded provenance after removing artwork, excluding gallery and demo receipts', async () => {
  const result = await collectionFixture()
  for (const origin of ['local', 'gallery', 'example'] as const) {
    const candidate = await prepareImport(result, { origin })
    const empty = createCollection()
    const saved = applyImport(empty, planImport(empty, candidate))
    const removed = removeRow(saved, saved.rows[0].id)
    expect(isUploadedReceipt(removed.receipts[0], removed.designs)).toBe(origin === 'local')
    expect(() => assertCollection(removed)).not.toThrow()
  }
})

it('shows an explicit upload of the same gallery pack and never loses that fact on reuse', async () => {
  const result = await collectionFixture()
  let collection = createCollection()
  for (const origin of ['gallery', 'local', 'gallery'] as const) {
    const candidate = await prepareImport(result, { origin })
    collection = applyImport(collection, planImport(collection, candidate))
    expect(collection.receipts).toHaveLength(1)
    expect(isUploadedReceipt(collection.receipts[0], collection.designs)).toBe(origin === 'local' || collection.receipts[0].origin === 'local')
  }
  expect(collection.receipts[0].origin).toBe('local')
  expect(collection.receipts[0].knownGalleryHashes).toHaveLength(1)
})

it('recognizes legacy designs, hides unidentifiable receipts, and rejects invalid origins', async () => {
  const candidate = await prepareImport(await collectionFixture(manifest => { manifest.extensions = { origin: 'gallery' } }), { origin: 'local' })
  expect(candidate.receipt.origin).toBe('local')
  delete candidate.receipt.origin
  const empty = createCollection()
  const saved = applyImport(empty, planImport(empty, candidate))
  expect(isUploadedReceipt(saved.receipts[0], saved.designs)).toBe(true)
  expect(isUploadedReceipt(saved.receipts[0], {})).toBe(false)
  expect(isUploadedReceipt({ ...saved.receipts[0], knownGalleryHashes: ['a'.repeat(64)] }, {})).toBe(false)
  expect(() => assertCollection({ ...saved, receipts: [{ ...saved.receipts[0], origin: 'invented' }] })).toThrow()
})
