import { describe, expect, it } from 'vitest'
import { createCollection, removeRow } from './commands'
import { applyImport, planImport, prepareImport } from './import'
import { assertCollection } from './validation'
import { collectionFixture } from './test-fixtures'

describe('known community artwork receipts', () => {
  it('retains validated publication hashes after removing artwork and importing changed metadata', async () => {
    const result = await collectionFixture()
    const candidate = await prepareImport(result, { origin: 'gallery', publicationId: 'verified-publication' })
    const empty = createCollection()
    const saved = applyImport(empty, planImport(empty, candidate))
    const hash = result.labels[0].artwork.asset.sha256
    expect(saved.receipts[0].knownGalleryHashes).toEqual([hash])
    const removed = removeRow(saved, saved.rows[0].id)
    expect(Object.keys(removed.designs)).toHaveLength(0)
    const local = await prepareImport(await collectionFixture(manifest => { manifest.labels[0].research!.adaptationSummary = 'Different metadata for the same community bytes' }), { origin: 'local' })
    const restored = applyImport(removed, planImport(removed, local))
    expect(restored.receipts.flatMap(receipt => receipt.knownGalleryHashes ?? [])).toContain(restored.designs[restored.rows[0].designId!].item.artwork.asset.sha256)
    expect(() => assertCollection(restored)).not.toThrow()
  })

  it('adds verified origin to an existing same-manifest receipt without changing delivery', async () => {
    const result = await collectionFixture()
    const local = await prepareImport(result, { origin: 'local' })
    const empty = createCollection()
    const saved = applyImport(empty, planImport(empty, local))
    saved.receipts[0].delivery = 'sent'
    const publication = await prepareImport(result, { origin: 'gallery', publicationId: 'verified-publication' })
    const next = applyImport(saved, planImport(saved, publication))
    expect(next.receipts).toHaveLength(1)
    expect(next.receipts[0]).toMatchObject({ delivery: 'sent', knownGalleryHashes: [result.labels[0].artwork.asset.sha256] })
    expect(next.rows).toEqual(saved.rows)
  })

  it('does not trust manifest origin claims, and bounds restored hashes', async () => {
    const result = await collectionFixture(manifest => { manifest.extensions = { knownGalleryHashes: ['a'.repeat(64)], origin: 'gallery' } })
    const local = await prepareImport(result, { origin: 'local' })
    expect(local.receipt.knownGalleryHashes).toBeUndefined()
    const empty = createCollection()
    const saved = applyImport(empty, planImport(empty, local))
    for (const hashes of [['not-a-hash'], Array(101).fill('a'.repeat(64)), ['a'.repeat(64), 'a'.repeat(64)]]) {
      expect(() => assertCollection({ ...saved, receipts: [{ ...saved.receipts[0], knownGalleryHashes: hashes }] })).toThrow()
    }
  })
})
