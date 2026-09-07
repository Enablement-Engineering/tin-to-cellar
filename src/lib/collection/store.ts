import { assertCollection, verifyCollectionArtwork } from './validation'
import { CollectionError, type Collection } from './types'

export type CollectionStore = { load(): Promise<Collection | null>; save(expectedRevision: number, next: Collection): Promise<Collection>; close(): void }

/** One document per browser. Validation/decoding is outside the short write transaction. */
export function createCollectionStore(options: { name?: string; indexedDB?: IDBFactory } = {}): CollectionStore {
  let database: Promise<IDBDatabase> | null = null
  const open = () => database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const factory = options.indexedDB ?? globalThis.indexedDB
    if (!factory) { reject(new CollectionError('unavailable', 'This browser could not open saved labels. Enable browser storage and retry.')); return }
    const request = factory.open(options.name ?? 'tin-to-cellar-collection', 1)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('collection')) request.result.createObjectStore('collection') }
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = null }
      resolve(request.result)
    }
    request.onerror = () => { database = null; reject(new CollectionError('unavailable', 'Saved labels could not be opened. Your existing browser data has not been removed.')) }
    request.onblocked = () => { database = null; reject(new CollectionError('unavailable', 'Another tab is preventing saved labels from opening. Close older Tin to Cellar tabs and retry.')) }
  })
  return {
    async load() {
      const db = await open()
      const value = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction('collection', 'readonly')
        const request = tx.objectStore('collection').get('active')
        tx.oncomplete = () => resolve(request.result)
        tx.onabort = () => reject(new CollectionError('unavailable', 'Saved labels could not be read. Retry without clearing browser storage.'))
      })
      if (value === undefined) return null
      assertCollection(value)
      await verifyCollectionArtwork(value)
      return value
    },
    async save(expectedRevision, next) {
      assertCollection(next)
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || next.revision !== expectedRevision) throw new CollectionError('conflict', 'Your labels changed. Refresh the saved work and review this change again.')
      const db = await open()
      return new Promise<Collection>((resolve, reject) => {
        const tx = db.transaction('collection', 'readwrite')
        const store = tx.objectStore('collection')
        const request = store.get('active')
        let failure: Error | null = null
        const saved = { ...next, revision: expectedRevision + 1 }
        request.onsuccess = () => {
          const current = request.result as Collection | undefined
          if (current && (current.version !== 1 || current.id !== next.id || current.revision !== expectedRevision) || !current && expectedRevision !== 0) {
            failure = new CollectionError('conflict', 'Your labels changed in another tab. Refresh the saved work and review this change again.')
            tx.abort(); return
          }
          try { store.put(saved, 'active') }
          catch { failure = new CollectionError('unavailable', 'This change could not be saved. Your previously saved labels are still available; retry the change.'); tx.abort() }
        }
        tx.oncomplete = () => resolve(saved)
        tx.onabort = () => reject(failure ?? new CollectionError('unavailable', tx.error?.name === 'QuotaExceededError' ? 'Your browser has no space to save this change. Your previously saved labels are still available.' : 'This change could not be saved. Your previously saved labels are still available; retry the change.'))
      })
    },
    close() { void database?.then(db => db.close()).catch(() => {}); database = null },
  }
}
