// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { pruneProgress } from './usage-progress-storage'
import { PREFERENCE_KEY, PROGRESS_KEY, setDemandPreference } from './usage-preferences'

beforeEach(() => {
  vi.stubGlobal('localStorage', (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window.localStorage)
  localStorage.clear()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name: string, task: () => unknown) => task() } })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it.each(['broken json', '{}', '[null]', '[]'])('cleans invalid progress without loading collection: %s', async raw => {
  setDemandPreference(true)
  localStorage.setItem(PROGRESS_KEY, raw)
  pruneProgress()
  await Promise.resolve()
  expect([null, '[]']).toContain(localStorage.getItem(PROGRESS_KEY))
})

it('expires old records and preserves valid current records locally', async () => {
  setDemandPreference(true)
  const current = { choice: localStorage.getItem(PREFERENCE_KEY), id: 'local', collectionId: 'local', started: Date.now(), targets: [{ rowId: 'row', revision: 1 }], startRecorded: true, importAttempted: false, importRecorded: false, printAttempted: false }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify([current, { ...current, id: 'expired', started: Date.now() - 31 * 86400000 }]))
  pruneProgress()
  await Promise.resolve()
  expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!)).toEqual([current])
  setDemandPreference(false)
  expect(localStorage.getItem(PROGRESS_KEY)).toBeNull()
})
