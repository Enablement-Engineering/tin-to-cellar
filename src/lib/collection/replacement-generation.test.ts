import { expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { addRequests, createCollection, removeRow, updateRow } from './commands'
import { applyImport, planImport, prepareImport } from './import'
import { assertCollection, readCollection } from './validation'
import { exportCollection } from './export'
import { createCollectionStore } from './store'
import { collectionFixture } from './test-fixtures'
import { importCellarPack } from '../cellarpack/importer'

async function ready() {
  const candidate = await prepareImport(await collectionFixture(), { origin: 'local' })
  const empty = createCollection()
  const saved = applyImport(empty, planImport(empty, candidate))
  return { candidate, saved: updateRow(saved, saved.rows[0].id, { quantity: 7 }) }
}

it('suspends selected artwork for generation and restores its exact design and quantity on cancellation', async () => {
  const { saved } = await ready()
  const row = saved.rows[0]
  const pending = updateRow(saved, row.id, { createRequested: true })
  expect(pending.rows[0]).toMatchObject({ designId: null, previousDesignId: row.designId, quantity: 7, createRequested: true })
  expect(Object.keys(pending.designs)).toEqual(Object.keys(saved.designs))
  expect(pending.designs[row.designId!].item.artwork.data).toBe(saved.designs[row.designId!].item.artwork.data)
  await expect(exportCollection(pending)).rejects.toThrow('Choose at least one ready label')
  const restored = updateRow(pending, row.id, { createRequested: false })
  expect(restored.rows[0]).toMatchObject({ designId: row.designId, quantity: 7, createRequested: false })
  expect(restored.rows[0]).not.toHaveProperty('previousDesignId')
  expect(saved.rows[0]).toEqual(row)
})

it('keeps suspended artwork through unrelated changes and prunes it when its row is removed or identity changes', async () => {
  const { saved } = await ready()
  const pending = updateRow(saved, saved.rows[0].id, { createRequested: true })
  const edited = updateRow(pending, pending.rows[0].id, { notes: 'A simpler border', quantity: 9 })
  expect(edited.rows[0].previousDesignId).toBe(saved.rows[0].designId)
  expect(updateRow(edited, edited.rows[0].id, { createRequested: false }).rows[0].quantity).toBe(9)
  expect(Object.keys(removeRow(edited, edited.rows[0].id).designs)).toHaveLength(0)
  const renamed = updateRow(edited, edited.rows[0].id, { blend: 'Different blend' })
  expect(renamed.rows[0]).not.toHaveProperty('previousDesignId')
  expect(Object.keys(renamed.designs)).toHaveLength(0)
  expect(updateRow(renamed, renamed.rows[0].id, { createRequested: false }).rows[0].designId).toBeNull()
})

it('keeps generation state unchanged while an import is reviewed or skipped, then activates accepted replacement', async () => {
  const { saved } = await ready()
  const pending = updateRow(saved, saved.rows[0].id, { createRequested: true })
  const snapshot = structuredClone(pending)
  const replacement = await prepareImport(await collectionFixture(manifest => { manifest.labels[0].research!.adaptationSummary = 'New replacement design details.' }), { origin: 'local' })
  const plan = planImport(pending, replacement)
  expect(plan.entries[0].kind).toBe('fill')
  expect(pending).toEqual(snapshot) // Closing the review does not apply the plan.
  expect(applyImport(pending, plan, { [replacement.designs[0].id]: { action: 'skip' } }).rows).toEqual(snapshot.rows)
  const accepted = applyImport(pending, plan)
  expect(accepted.rows[0]).toMatchObject({ designId: replacement.designs[0].id, quantity: 7, createRequested: false })
  expect(accepted.rows[0]).not.toHaveProperty('previousDesignId')
  expect(Object.keys(accepted.designs)).toEqual([replacement.designs[0].id])
  expect(updateRow(accepted, accepted.rows[0].id, { createRequested: false }).rows[0].designId).toBe(replacement.designs[0].id)
})

it('reimports retained identical artwork into an unfinished request instead of treating it as an already selected duplicate', async () => {
  const { saved, candidate } = await ready()
  const pending = updateRow(saved, saved.rows[0].id, { createRequested: true })
  const plan = planImport(pending, candidate)
  expect(plan.entries[0]).toMatchObject({ kind: 'fill', matchRowIds: [saved.rows[0].id] })
  const restored = applyImport(pending, plan)
  expect(restored.rows[0]).toMatchObject({ designId: saved.rows[0].designId, createRequested: false, quantity: 7 })
  expect(restored.rows[0]).not.toHaveProperty('previousDesignId')
  expect(planImport(restored, candidate).entries[0].kind).toBe('duplicate')
})

it('requires an explicit choice when retained artwork matches multiple unfinished requests', async () => {
  const { saved, candidate } = await ready()
  let pending = updateRow(saved, saved.rows[0].id, { createRequested: true })
  pending = addRequests(pending, [{ catalogId: null, maker: saved.rows[0].maker, blend: saved.rows[0].blend, notes: 'Another label' }])
  const plan = planImport(pending, candidate)
  expect(plan.entries[0].kind).toBe('choice')
  expect(applyImport(pending, plan).rows).toEqual(pending.rows)
  const chosen = applyImport(pending, plan, { [candidate.designs[0].id]: { action: 'replace', rowId: pending.rows[1].id } })
  expect(chosen.rows[0]).toMatchObject({ designId: null, previousDesignId: saved.rows[0].designId })
  expect(chosen.rows[1].designId).toBe(saved.rows[0].designId)
})

it('exports only active artwork when a different design is retained for restoration', async () => {
  const { saved } = await ready()
  const other = await prepareImport(await collectionFixture(manifest => { manifest.labels[0].blend = 'Ready other blend' }), { origin: 'local' })
  const both = applyImport(saved, planImport(saved, other))
  const pending = updateRow(both, saved.rows[0].id, { createRequested: true })
  const output = await exportCollection(pending)
  const result = await importCellarPack(await output.arrayBuffer())
  expect(result.labels.map(label => label.label.blend)).toEqual(['Ready other blend'])
  expect(Object.keys(pending.designs)).toHaveLength(2)
})

it('rejects inconsistent restore references and migrates legacy requested artwork without mutating the input', async () => {
  const { saved } = await ready()
  for (const patch of [{ previousDesignId: 'missing', designId: null, createRequested: true }, { previousDesignId: saved.rows[0].designId }, { createRequested: true }]) {
    expect(() => assertCollection({ ...saved, rows: [{ ...saved.rows[0], ...patch }] })).toThrow()
  }
  const legacy = { ...saved, rows: [{ ...saved.rows[0], createRequested: true }] }
  const migrated = readCollection(legacy)
  expect(migrated.rows[0]).toMatchObject({ createRequested: true, designId: null, previousDesignId: saved.rows[0].designId, quantity: 7 })
  expect(legacy.rows[0].designId).toBe(saved.rows[0].designId)
  expect(readCollection(migrated)).toEqual(migrated)
})

it('loads legacy replacement requests safely and persists restoration on the next normal save', async () => {
  const { saved } = await ready()
  const factory = new IDBFactory(), store = createCollectionStore({ indexedDB: factory })
  const committed = await store.save(0, saved)
  const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = factory.open('tin-to-cellar-collection', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
  await new Promise<void>((resolve, reject) => { const tx = db.transaction('collection', 'readwrite'); tx.objectStore('collection').put({ ...committed, rows: [{ ...committed.rows[0], createRequested: true }] }, 'active'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
  const migrated = (await store.load())!
  expect(migrated.rows[0]).toMatchObject({ designId: null, previousDesignId: saved.rows[0].designId })
  expect(migrated.revision).toBe(committed.revision)
  const restored = await store.save(migrated.revision, updateRow(migrated, migrated.rows[0].id, { createRequested: false }))
  expect((await store.load())?.rows).toEqual(restored.rows)
  db.close(); store.close()
})
