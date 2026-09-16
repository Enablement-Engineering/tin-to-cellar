import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRecoveryFile, loadRecoveryFile, saveRecoveryFile } from './app-recovery-file'

const TAB_KEY = 'tin-to-cellar:app-recovery-file'
let storage: Map<string, string>
let now: number

beforeEach(() => {
  storage = new Map()
  now = Date.now()
  vi.stubGlobal('indexedDB', new IDBFactory())
  vi.stubGlobal('IDBKeyRange', IDBKeyRange)
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value) },
  })
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

const file = (name = 'labels.cellarpack.zip') => new File(['local ZIP bytes'], name, { type: 'application/zip', lastModified: 123456 })

async function entries(): Promise<unknown[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('tin-to-cellar-app-recovery', 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('files').objectStore('files').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

describe('temporary local ZIP recovery', () => {
  it('does not open the database when this tab has no recovery file', async () => {
    const open = vi.spyOn(indexedDB, 'open')
    expect(await loadRecoveryFile()).toBeNull()
    await clearRecoveryFile()
    expect(open).not.toHaveBeenCalled()
  })

  it('restores the selected bytes and file metadata across module reload without network activity', async () => {
    const network = vi.spyOn(globalThis, 'fetch')
    const selected = file('Private blend notes.zip')
    await saveRecoveryFile(selected)
    expect(storage.get(TAB_KEY)).toMatch(/^[0-9a-f-]{36}$/)
    vi.resetModules()
    const restored = await (await import('./app-recovery-file')).loadRecoveryFile()
    expect(restored).toBeInstanceOf(File)
    expect(restored?.name).toBe(selected.name)
    expect(restored?.type).toBe(selected.type)
    expect(restored?.lastModified).toBe(selected.lastModified)
    expect(await restored?.text()).toBe(await selected.text())
    expect(network).not.toHaveBeenCalled()
    expect([...storage.values()].join()).not.toContain('Private blend notes')
  })

  it('resolves saving only after the write transaction completes', async () => {
    let completed = false
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      this.transaction.addEventListener('complete', () => { completed = true })
      return put.call(this, value, key)
    })
    await saveRecoveryFile(file())
    expect(completed).toBe(true)
  })

  it('keeps checkpoints isolated by tab address and clears before an explicit resume', async () => {
    await saveRecoveryFile(file('first.zip'))
    const first = storage.get(TAB_KEY)!
    storage.delete(TAB_KEY)
    expect(await loadRecoveryFile()).toBeNull()
    await saveRecoveryFile(file('second.zip'))
    expect((await loadRecoveryFile())?.name).toBe('second.zip')
    await clearRecoveryFile()
    expect(await loadRecoveryFile()).toBeNull()
    storage.set(TAB_KEY, first)
    expect((await loadRecoveryFile())?.name).toBe('first.zip')
  })

  it('deletes expired files in every tab and never resumes them', async () => {
    await saveRecoveryFile(file('expired.zip'))
    now += 60 * 60 * 1000
    expect(await loadRecoveryFile()).toBeNull()
    expect(await entries()).toEqual([])
    await saveRecoveryFile(file('also-expired.zip'))
    storage.delete(TAB_KEY)
    now += 60 * 60 * 1000
    await saveRecoveryFile(file('fresh.zip'))
    expect(await entries()).toHaveLength(1)
    now += 60 * 60 * 1000
    await clearRecoveryFile()
    expect(await entries()).toEqual([])
  })

  it('bounds live checkpoints without evicting another tab and allows replacing its own file', async () => {
    const keys: string[] = []
    for (let index = 0; index < 3; index++) {
      storage.delete(TAB_KEY)
      await saveRecoveryFile(file(`${index}.zip`))
      keys.push(storage.get(TAB_KEY)!)
    }
    storage.delete(TAB_KEY)
    await expect(saveRecoveryFile(file('fourth.zip'))).rejects.toThrow('storage is full')
    expect(await entries()).toHaveLength(3)
    for (const [index, key] of keys.entries()) {
      storage.set(TAB_KEY, key)
      expect((await loadRecoveryFile())?.name).toBe(`${index}.zip`)
    }
    await saveRecoveryFile(file('replacement.zip'))
    expect((await loadRecoveryFile())?.name).toBe('replacement.zip')
    expect(await entries()).toHaveLength(3)
  })

  it('serializes competing tabs so simultaneous saves cannot exceed the shared bound', async () => {
    const saves = Array.from({ length: 4 }, (_, index) => {
      storage.set(TAB_KEY, `tab-${index}`)
      return saveRecoveryFile(file(`${index}.zip`))
    })
    const results = await Promise.allSettled(saves)
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(3)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(await entries()).toHaveLength(3)
  })

  it('rejects oversized files before trying to save bytes', async () => {
    const selected = file()
    Object.defineProperty(selected, 'size', { value: 50 * 1024 * 1024 + 1 })
    const open = vi.spyOn(indexedDB, 'open')
    await expect(saveRecoveryFile(selected)).rejects.toThrow('50 MiB')
    expect(open).not.toHaveBeenCalled()
    expect(storage.has(TAB_KEY)).toBe(false)
  })

  it('rejects storage failure and leaves the previous durable checkpoint unchanged', async () => {
    await saveRecoveryFile(file('original.zip'))
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => { throw new DOMException('Storage full', 'QuotaExceededError') })
    await expect(saveRecoveryFile(file('replacement.zip'))).rejects.toThrow('Storage full')
    put.mockRestore()
    expect((await loadRecoveryFile())?.name).toBe('original.zip')
  })

  it('rejects an aborted write instead of treating request success as durable', async () => {
    const put = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(function (this: IDBObjectStore, value, key) {
      const request = put.call(this, value, key)
      request.addEventListener('success', () => this.transaction.abort())
      return request
    })
    await expect(saveRecoveryFile(file())).rejects.toThrow()
    expect(await loadRecoveryFile()).toBeNull()
  })

  it('surfaces denied tab storage and unavailable IndexedDB rather than claiming recovery is saved', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => { throw new DOMException('Denied', 'SecurityError') } })
    await expect(saveRecoveryFile(file())).rejects.toThrow('Denied')
    await expect(loadRecoveryFile()).resolves.toBeNull()
    await expect(clearRecoveryFile()).rejects.toThrow('Denied')
    vi.stubGlobal('sessionStorage', { getItem: () => 'tab-key' })
    vi.stubGlobal('indexedDB', undefined)
    await expect(saveRecoveryFile(file())).rejects.toThrow()
  })
})
