import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'
import { addRequests, createCollection, updateRow } from './commands'
import { applyImport, planImport, prepareImport } from './import'
import { createCollectionStore } from './store'
import { collectionFixture } from './test-fixtures'

describe('atomic local collection storage', () => {
  it('restores artwork, pending rows, quantities and receipts without network effects', async () => {
    const factory = new IDBFactory()
    const store = createCollectionStore({ indexedDB: factory })
    let collection = createCollection()
    const candidate = await prepareImport(await collectionFixture(), { origin: 'local', repairPrompt: 'Source-specific repair' })
    collection = applyImport(collection, planImport(collection, candidate))
    collection = addRequests(collection, [{ catalogId: null, maker: '', blend: 'Awaiting artwork' }])
    collection = updateRow(collection, collection.rows[0].id, { quantity: 8 })
    const saved = await store.save(0, collection)
    expect(saved.revision).toBe(1)
    store.close()
    const fetcher = vi.spyOn(globalThis, 'fetch')
    const fresh = createCollectionStore({ indexedDB: factory })
    expect(await fresh.load()).toEqual(saved)
    expect(fetcher).not.toHaveBeenCalled()
    fetcher.mockRestore(); fresh.close()
  })
  it('serializes concurrent tab saves and rejects the stale writer', async () => {
    const factory = new IDBFactory()
    const a = createCollectionStore({ indexedDB: factory }), b = createCollectionStore({ indexedDB: factory })
    const initial = await a.save(0, createCollection())
    const first = addRequests(initial, [{ catalogId: null, maker: '', blend: 'First tab' }])
    const second = addRequests(initial, [{ catalogId: null, maker: '', blend: 'Second tab' }])
    const results = await Promise.allSettled([a.save(initial.revision, first), b.save(initial.revision, second)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect((await b.load())?.revision).toBe(2)
    expect((await b.load())?.rows).toHaveLength(1)
    a.close(); b.close()
  })
  it('preserves the committed document when validation or a database write fails', async () => {
    const factory = new IDBFactory(), store = createCollectionStore({ indexedDB: factory })
    const initial = await store.save(0, createCollection())
    await expect(store.save(1, { ...initial, rows: [{ id: 'bad' }] } as never)).rejects.toThrow()
    expect(await store.load()).toEqual(initial)
    const write = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('Storage is full', 'QuotaExceededError') })
    await expect(store.save(1, addRequests(initial, [{ catalogId: null, maker: '', blend: 'Not saved' }]))).rejects.toThrow('could not be saved')
    write.mockRestore()
    expect(await store.load()).toEqual(initial)
    store.close()
  })
  it('does not reset unknown saved schema versions', async () => {
    const factory = new IDBFactory(), store = createCollectionStore({ indexedDB: factory })
    await store.save(0, createCollection())
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = factory.open('tin-to-cellar-collection', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('collection', 'readwrite'); tx.objectStore('collection').put({ version: 99 }, 'active'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error) })
    await expect(store.load()).rejects.toThrow('could not be read safely')
    await new Promise<void>(resolve => { const request = db.transaction('collection').objectStore('collection').get('active'); request.onsuccess = () => { expect(request.result).toEqual({ version: 99 }); resolve() } })
    db.close(); store.close()
  })
})
