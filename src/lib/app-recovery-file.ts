// A recovery checkpoint is local, temporary, and never imported automatically.
// Keep this module independent of the ZIP reader: it must work when that chunk fails.
const DATABASE = 'tin-to-cellar-app-recovery'
const STORE = 'files'
const TAB_KEY = 'tin-to-cellar:app-recovery-file'
const MAX_FILE_BYTES = 50 * 1024 * 1024 // Matches the compressed CellarPack limit.
const MAX_ENTRIES = 3 // Each entry is bounded above: at most 150 MiB across tabs.
const EXPIRES_MS = 60 * 60 * 1000

type Checkpoint = { key: string; blob: Blob; name: string; type: string; lastModified: number; expiresAt: number }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    let settled = false
    const timer = setTimeout(() => fail(new Error('Temporary ZIP storage did not open. Keep this page open and try again.')), 5000)
    const fail = (error: unknown) => { if (!settled) { settled = true; clearTimeout(timer); reject(error) } }
    request.onupgradeneeded = () => {
      if (settled) { request.transaction?.abort(); return }
      request.result.createObjectStore(STORE, { keyPath: 'key' }).createIndex('expiresAt', 'expiresAt')
    }
    request.onerror = () => fail(request.error ?? new Error('Temporary ZIP storage is unavailable.'))
    request.onblocked = () => fail(new Error('Temporary ZIP storage is busy in another tab. Keep this page open and try again.'))
    request.onsuccess = () => {
      const database = request.result
      if (settled) { database.close(); return }
      settled = true; clearTimeout(timer)
      database.onversionchange = () => database.close()
      resolve(database)
    }
  })
}

function tabKey(create = false): string | null {
  const key = sessionStorage.getItem(TAB_KEY)
  if (key) return key
  if (!create) return null
  const created = crypto.randomUUID()
  sessionStorage.setItem(TAB_KEY, created)
  return created
}

type Receive = <T>(request: IDBRequest<T>, callback: (value: T) => void) => void

async function transact<T>(operation: (store: IDBObjectStore, receive: Receive, complete: (value: T) => void) => void): Promise<T> {
  const database = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite')
      const store = transaction.objectStore(STORE)
      let result: T
      let failure: unknown
      transaction.oncomplete = () => resolve(result)
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('The selected ZIP could not be kept for the update.'))
      transaction.onerror = () => { failure ??= transaction.error }
      const receive: Receive = (request, callback) => {
        request.onsuccess = () => {
          try { callback(request.result) }
          catch (error) { failure = error; transaction.abort() }
        }
      }
      // Key cursors and counts avoid cloning other tabs' ZIP payloads.
      receive(store.index('expiresAt').openKeyCursor(IDBKeyRange.upperBound(Date.now())), cursor => {
        if (cursor) { store.delete(cursor.primaryKey); cursor.continue() }
        else operation(store, receive, value => { result = value })
      })
    })
  } finally { database.close() }
}

/** Resolve only after IndexedDB commits the checkpoint; rejection must block refresh. */
export async function saveRecoveryFile(file: File): Promise<void> {
  if (file.size > MAX_FILE_BYTES) throw new Error('This ZIP exceeds the 50 MiB recovery limit. Keep the original file and choose it again after updating.')
  const key = tabKey(true)!
  await transact<void>((store, receive, complete) => {
    receive(store.count(), count => receive(store.getKey(key), existing => {
      if (count - (existing === undefined ? 0 : 1) >= MAX_ENTRIES) {
        throw new Error('Temporary ZIP storage is full. Finish recovery in another tab, or keep this page open and try again later.')
      }
      store.put({ key, blob: file.slice(), name: file.name, type: file.type, lastModified: file.lastModified, expiresAt: Date.now() + EXPIRES_MS } satisfies Checkpoint)
      complete(undefined)
    }))
  })
}

/** Reading never imports, parses, uploads, or changes the saved label collection. */
export async function loadRecoveryFile(): Promise<File | null> {
  let key: string | null
  try { key = tabKey() } catch { return null }
  if (!key) return null
  return transact((store, receive, complete) => {
    receive(store.get(key), (entry: Checkpoint | undefined) => {
      if (!entry) { complete(null); return }
      if (!(entry.blob instanceof Blob) || entry.blob.size > MAX_FILE_BYTES || typeof entry.name !== 'string' || typeof entry.type !== 'string' || !Number.isFinite(entry.lastModified)) {
        throw new Error('The saved ZIP could not be restored. Keep the original file and choose it again after updating.')
      }
      complete(new File([entry.blob], entry.name, { type: entry.type, lastModified: entry.lastModified }))
    })
  })
}

/** Call and await before an explicit resume, so recovery cannot replay side effects. */
export async function clearRecoveryFile(): Promise<void> {
  const key = tabKey()
  if (!key) return
  await transact<void>((store, _receive, complete) => { store.delete(key); complete(undefined) })
  // Keeping the random tab address avoids a race with another save in this tab.
  // It contains no file data and an absent checkpoint simply returns null.
}
