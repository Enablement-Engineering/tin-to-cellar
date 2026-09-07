import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { importCellarPack } from '../cellarpack/importer'
import { TOBACCO_CATALOG } from '../tobacco-catalog'
import { addRequests, createCollection, removeRow, setHandoff, updateRow } from './commands'
import { applyImport, planImport, prepareImport } from './import'
import { exportCollection } from './export'
import { assertCollection, verifyCollectionArtwork } from './validation'
import { collectionFixture } from './test-fixtures'

async function firstCollection() {
  const candidate = await prepareImport(await collectionFixture(), { origin: 'local' })
  const empty = createCollection()
  return applyImport(empty, planImport(empty, candidate))
}
describe('saved label collection', () => {
  it('adds to existing labels and preserves quantities, order and original bytes', async () => {
    const initial = await firstCollection()
    const existing = updateRow(initial, initial.rows[0].id, { quantity: 5 })
    const candidate = await prepareImport(await collectionFixture(manifest => { manifest.labels[0].blend = 'Another blend' }), { origin: 'gallery', publicationId: 'published-label' })
    const merged = applyImport(existing, planImport(existing, candidate))
    expect(merged.rows.map(row => [row.blend, row.quantity])).toEqual([['Fixture Blend', 5], ['Another blend', 1]])
    expect(merged.designs[merged.rows[0].designId!].item.artwork.data).toEqual(existing.designs[existing.rows[0].designId!].item.artwork.data)
    expect(merged.designs[merged.rows[1].designId!].origin).toBe('gallery')
  })
  it('deduplicates source-local IDs and paths, preserving quantities on repeat import', async () => {
    const initial = await firstCollection()
    const existing = updateRow(initial, initial.rows[0].id, { quantity: 4 })
    const candidate = await prepareImport(await collectionFixture(manifest => {
      manifest.labels[0].id = 'different-container-id'
      manifest.labels[0].artworkAssetId = 'new-asset'
      manifest.assets = { 'new-asset': { ...manifest.assets['asset-fixture'], path: 'artwork/renamed.png' } }
      manifest.packId = `urn:uuid:${crypto.randomUUID()}`
    }), { origin: 'local' })
    const plan = planImport(existing, candidate)
    expect(plan.entries[0].kind).toBe('duplicate')
    const merged = applyImport(existing, plan)
    expect(merged.rows).toEqual(existing.rows)
    expect(Object.keys(merged.designs)).toHaveLength(1)
    expect(merged.receipts).toHaveLength(2)
  })
  it('keeps distinct geometry or research as distinct designs while sharing equal artwork bytes', async () => {
    const existing = await firstCollection()
    for (const mutate of [
      (manifest: Awaited<ReturnType<typeof collectionFixture>>['manifest']) => { manifest!.labels[0].surface.safeInset.top = .01 },
      (manifest: Awaited<ReturnType<typeof collectionFixture>>['manifest']) => { manifest!.labels[0].research.adaptationSummary = 'A corrected account of the same artwork.' },
    ]) {
      const candidate = await prepareImport(await collectionFixture(mutate), { origin: 'local' })
      const plan = planImport(existing, candidate)
      expect(plan.entries[0].kind).toBe('choice')
      const merged = applyImport(existing, plan, { [candidate.designs[0].id]: { action: 'add' } })
      expect(merged.rows).toHaveLength(2)
      const designs = Object.values(merged.designs)
      expect(designs[0].fingerprint).not.toBe(designs[1].fingerprint)
      expect(designs[0].item.artwork.data).toBe(designs[1].item.artwork.data)
    }
  })
  it('fills an unchanged exact pending row without resetting its quantity', async () => {
    let collection = addRequests(createCollection(), [{ catalogId: null, maker: 'Fixture Maker', blend: 'Fixture Blend' }])
    collection = updateRow(collection, collection.rows[0].id, { quantity: 7, createRequested: true })
    const row = collection.rows[0]
    const candidate = await prepareImport(await collectionFixture(), { origin: 'local' })
    const plan = planImport(collection, candidate)
    expect(plan.entries[0]).toMatchObject({ kind: 'fill', matchRowIds: [row.id] })
    const next = applyImport(collection, plan)
    expect(next.rows).toHaveLength(1)
    expect(next.rows[0]).toMatchObject({ id: row.id, quantity: 7, createRequested: false })
    expect(next.rows[0].designId).toBe(candidate.designs[0].id)
  })
  it('requires review for a stale frozen target, and leaves missing or deleted targets alone', async () => {
    let collection = addRequests(createCollection(), [{ catalogId: null, maker: 'Fixture Maker', blend: 'Fixture Blend' }, { catalogId: null, maker: '', blend: 'Still missing' }])
    collection = setHandoff(collection, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), targets: collection.rows.map(row => ({ rowId: row.id, revision: row.revision, catalogId: row.catalogId, maker: row.maker, blend: row.blend, edition: row.edition, notes: row.notes })), prompt: 'Create the requested artwork', request: 'Requested labels', protocolRevision: '0.0.20', copied: true })
    const originalId = collection.rows[0].id
    collection = updateRow(collection, originalId, { notes: 'Use a new border' })
    const candidate = await prepareImport(await collectionFixture(), { origin: 'local' })
    const plan = planImport(collection, candidate)
    expect(plan.entries[0].kind).toBe('choice')
    expect(applyImport(collection, plan).rows.every(row => !row.designId)).toBe(true)
    const removed = removeRow(collection, originalId)
    const afterReturn = applyImport(removed, planImport(removed, candidate))
    expect(afterReturn.rows.some(row => row.id === originalId)).toBe(false)
    expect(afterReturn.rows.find(row => row.blend === 'Still missing')?.designId).toBe(null)
  })
  it('does not silently replace different editions or ambiguous identities', async () => {
    let collection = addRequests(createCollection(), [{ catalogId: null, maker: 'Fixture Maker', blend: 'Fixture Blend', edition: '1999' }, { catalogId: null, maker: 'Fixture Maker', blend: 'Fixture Blend', notes: 'First design' }, { catalogId: null, maker: 'Fixture Maker', blend: 'Fixture Blend', notes: 'Second design' }])
    const candidate = await prepareImport(await collectionFixture(manifest => { manifest.labels[0].research.observedPackage.variantDateOrEdition = '2026' }), { origin: 'local' })
    const plan = planImport(collection, candidate)
    expect(plan.entries[0].kind).toBe('choice')
    expect(plan.entries[0].matchRowIds).not.toContain(collection.rows[0].id)
    collection = applyImport(collection, plan)
    expect(collection.rows.every(row => row.designId === null)).toBe(true)
  })
  it('preserves original repair receipts across invalid returns and does not mutate on failure', async () => {
    const collection = await firstCollection()
    const candidate = await prepareImport({ status: 'rejected', manifest: null, labels: [], quarantinedLabels: [], issues: [{ severity: 'fatal', code: 'INVALID_ZIP', message: 'Unreadable ZIP' }], customSheetProfiles: [], conformance: { archive: 'nonconformant', generator: 'not-evaluated', printReady: 'not-evaluated' } }, { origin: 'local', repairPrompt: 'Repair this ZIP.' })
    const next = applyImport(collection, planImport(collection, candidate))
    expect(next.rows).toEqual(collection.rows)
    expect(next.receipts).toHaveLength(2)
    expect(next.receipts[1].repairPrompt).toBe('Repair this ZIP.')
    const changed = { ...collection, revision: collection.revision + 1 }
    expect(() => applyImport(changed, planImport(collection, candidate))).toThrow('changed')
    expect(collection.receipts).toHaveLength(1)
  })
  it('supports canonical catalog IDs, deduplicates requests, and bounds all saved quantities', async () => {
    const catalog = TOBACCO_CATALOG[0]
    let collection = addRequests(createCollection(), [{ catalogId: catalog.id, maker: '', blend: 'ignored' }, { catalogId: catalog.id, maker: '', blend: 'ignored' }])
    expect(collection.rows).toHaveLength(1)
    expect(collection.rows[0].maker).toBe(catalog.maker)
    expect(() => updateRow(collection, collection.rows[0].id, { quantity: 100 })).toThrow()
    collection = await firstCollection()
    expect(() => assertCollection({ ...collection, printSettings: { ...collection.printSettings, offset: { x: NaN, y: 0 } } })).toThrow()
    expect(() => addRequests(collection, Array.from({ length: 100 }, (_, i) => ({ catalogId: null, maker: '', blend: `Blend ${i}` })))).toThrow('100')
  })
  it('removes unselected design bytes after replacement and removal', async () => {
    const collection = await firstCollection()
    expect(Object.keys(removeRow(collection, collection.rows[0].id).designs)).toHaveLength(0)
    const candidate = await prepareImport(await collectionFixture(manifest => { manifest.labels[0].research.adaptationSummary = 'Replacement design' }), { origin: 'local' })
    const next = applyImport(collection, planImport(collection, candidate), { [candidate.designs[0].id]: { action: 'replace', rowId: collection.rows[0].id } })
    expect(Object.keys(next.designs)).toEqual([candidate.designs[0].id])
  })
  it('rejects byte corruption and strips arbitrary manifest extension data', async () => {
    const result = await collectionFixture(manifest => { manifest.labels[0].extensions = { privateNotes: 'Do not persist this freeform record.' } })
    const candidate = await prepareImport(result, { origin: 'local' })
    expect(candidate.designs[0].item.label.extensions).toBeUndefined()
    result.labels[0].artwork.data = new Uint8Array([1, 2, 3]).buffer
    await expect(prepareImport(result, { origin: 'local' })).rejects.toThrow('does not match')
    const collection = await firstCollection()
    Object.values(collection.designs)[0].item.artwork.data = new Uint8Array([1, 2, 3]).buffer
    await expect(verifyCollectionArtwork(collection)).rejects.toThrow('does not match')
  })
  it('rejects aggregate artwork, metadata and quantity overflow without deleting existing work', async () => {
    const collection = await firstCollection()
    const design = Object.values(collection.designs)[0]
    const oversized = { ...collection, designs: { [design.id]: { ...design, item: { ...design.item, artwork: { ...design.item.artwork, data: new ArrayBuffer(46 * 1024 * 1024) } } } } }
    expect(() => assertCollection(oversized)).toThrow('45 MiB')
    expect(() => assertCollection({ ...collection, rows: Array.from({ length: 5 }, () => ({ ...collection.rows[0], id: crypto.randomUUID(), quantity: 99 })) })).toThrow('450')
    const receipts = Array.from({ length: 25 }, () => ({ ...collection.receipts[0], id: crypto.randomUUID(), repairPrompt: 'x'.repeat(99_000) }))
    expect(() => assertCollection({ ...collection, receipts: [collection.receipts[0], ...receipts] })).toThrow('details exceed')
    expect(collection.rows).toHaveLength(1)
    expect(collection.receipts).toHaveLength(1)
  })
  it('exports a revalidated combined pack with complete asset references and no global AI claims', async () => {
    let collection = await firstCollection()
    const candidate = await prepareImport(await collectionFixture(manifest => { manifest.labels[0].blend = 'Second blend' }), { origin: 'gallery' })
    collection = applyImport(collection, planImport(collection, candidate))
    collection = addRequests(collection, [{ catalogId: null, maker: '', blend: 'Pending artwork' }])
    const file = await exportCollection(collection)
    const result = await importCellarPack(await file.arrayBuffer())
    expect(result.status).toBe('ready')
    expect(result.labels.map(item => item.label.blend)).toEqual(['Fixture Blend', 'Second blend'])
    expect(result.manifest!.extensions).toBeUndefined()
    expect(Object.keys(result.manifest!.assets)).toHaveLength(1)
    for (const item of result.labels) expect(item.artwork.data).toEqual(Object.values(collection.designs)[0].item.artwork.data)
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    for (const asset of Object.values(result.manifest!.assets)) expect(zip.file(asset.path)).not.toBe(null)
  })
})

it('fills a canonical requested row from an explicitly declared blend alias', async () => {
  const catalog = TOBACCO_CATALOG.find(entry => entry.id === 'a-and-c-petersen-escudo-navy-deluxe')!
  const current = addRequests(createCollection(), [{ catalogId: catalog.id, maker: catalog.maker, blend: catalog.blend }])
  const candidate = await prepareImport(await collectionFixture(manifest => {
    manifest.labels[0].maker = 'A&C Petersen'
    manifest.labels[0].blend = 'Escudo Navy De Luxe'
  }), { origin: 'local' })
  const plan = planImport(current, candidate)
  expect(plan.entries[0].kind).toBe('fill')
  const saved = applyImport(current, plan)
  expect(saved.rows).toHaveLength(1)
  expect(saved.rows[0]).toMatchObject({ catalogId: catalog.id, blend: 'Escudo Navy Deluxe', designId: candidate.designs[0].id })
})
