// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { Blob as NodeBlob } from 'node:buffer'
import { createCollection, addRequests, setHandoff, updateRow } from '../collection/commands'
import { prepareImport, planImport, applyImport } from '../collection/import'
import { collectionFixture } from '../collection/test-fixtures'
import { PREFERENCE_KEY, PROGRESS_KEY } from '../usage-preferences'
let progress: typeof import('./progress')
let client: typeof import('./client')
let preferences: typeof import('../usage-preferences')
let storage: typeof import('../usage-progress-storage')
const now = new Date('2026-09-16T12:00:00Z')
beforeEach(async () => {
  vi.stubGlobal('localStorage', (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window.localStorage)
  vi.resetModules()
  progress = await import('./progress')
  client = await import('./client')
  preferences = await import('../usage-preferences')
  storage = await import('../usage-progress-storage')
  localStorage.clear()
  vi.stubGlobal('Blob', NodeBlob)
  vi.spyOn(Date, 'now').mockReturnValue(now.getTime())
  localStorage.setItem(PREFERENCE_KEY, 'on:00000000-0000-0000-0000-000000000000')
  let busy = false
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_name: string, options: unknown, callback?: (lock: unknown) => Promise<void>) => {
    const task = typeof options === 'function' ? options : callback!
    if (busy) return task(null)
    busy = true
    try { return await task({ name: 'local' }) } finally { busy = false }
  } } })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.endsWith('/config') ? { version: 2, demandEnabled: true, workflowEnabled: true, progressEnabled: true } : { recorded: true })))
  await client.initializeDemandCollection()
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function fixture() {
  const incoming = await prepareImport(await collectionFixture(), { origin: 'local' })
  const label = incoming.designs[0].item.label
  let before = addRequests(createCollection(), [{ catalogId: null, maker: label.maker, blend: label.blend }])
  before = setHandoff(before, { id: 'local-request-secret', createdAt: now.toISOString(), targets: before.rows.map(({ id, revision, catalogId, maker, blend, edition, notes }) => ({ rowId: id, revision, catalogId, maker, blend, edition, notes })), prompt: 'private prompt', request: 'private request', protocolRevision: '0.0.30', copied: true })
  const after = applyImport(before, planImport(before, incoming))
  return { incoming, before, after }
}
const sent = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/progress')).map(([,options]) => JSON.parse(options!.body as string))
it('matches the saved request locally and sends only coarse milestone counters once', async () => {
  const { before, after, incoming } = await fixture()
  await progress.startProgress(before.id, before.handoff!)
  await progress.startProgress(before.id, before.handoff!)
  await progress.importProgress(before, after, incoming)
  await progress.importProgress(before, after, incoming)
  await progress.printProgress(after, after.rows.map(r => r.id))
  await progress.printProgress(after, after.rows.map(r => r.id))
  expect(sent()).toEqual(['started','imported','print-requested'].map(milestone => ({ version: 2, cohort: '2026-09-14', milestone, elapsed: 'same-day' })))
  expect(JSON.stringify(sent())).not.toContain('secret')
  expect(JSON.stringify(sent())).not.toContain(before.rows[0].id)
  expect(localStorage.getItem(PROGRESS_KEY)).toContain('local-request-secret')
})
it('does not infer progress from gallery artwork, changed requests, or a subset of printed rows', async () => {
  const { before, after, incoming } = await fixture()
  await progress.startProgress(before.id, before.handoff!)
  await progress.importProgress(before, after, { ...incoming, receipt: { ...incoming.receipt, origin: 'gallery' } })
  await progress.importProgress({ ...before, handoff: { ...before.handoff!, id: 'different' } }, after, incoming)
  expect(sent()).toHaveLength(1)
  await progress.importProgress(before, after, incoming)
  await progress.printProgress(after, [])
  expect(sent().map(r => r.milestone)).toEqual(['started','imported'])
})
it('does not report later milestones or retry when the start receipt is lost', async () => {
  const { before, after, incoming } = await fixture()
  vi.mocked(fetch).mockRejectedValue(new Error('receipt lost'))
  await progress.startProgress(before.id, before.handoff!)
  vi.mocked(fetch).mockResolvedValue(Response.json({ recorded: true }))
  await progress.startProgress(before.id, before.handoff!)
  await progress.importProgress(before, after, incoming)
  expect(sent()).toHaveLength(1)
})
it('does not resurrect local metadata after off/on while a receipt is pending', async () => {
  const { before } = await fixture()
  let complete!: (response: Response) => void
  vi.mocked(fetch).mockReturnValue(new Promise(resolve => { complete = resolve }))
  const pending = progress.startProgress(before.id, before.handoff!)
  await Promise.resolve()
  preferences.setDemandPreference(false)
  preferences.setDemandPreference(true)
  complete(Response.json({ recorded: true }))
  await pending
  expect(localStorage.getItem(PROGRESS_KEY)).toBeNull()
})
it('expires local records on the next check and stays silent without opt-in or browser locks', async () => {
  const { before } = await fixture()
  await progress.startProgress(before.id, before.handoff!)
  vi.spyOn(Date, 'now').mockReturnValue(now.getTime() + 31 * 86400000)
  storage.pruneProgress(); await Promise.resolve(); await Promise.resolve()
  expect(localStorage.getItem(PROGRESS_KEY)).toBe('[]')
  preferences.setDemandPreference(false)
  await progress.startProgress(before.id, before.handoff!)
  expect(localStorage.getItem(PROGRESS_KEY)).toBeNull()
  preferences.setDemandPreference(true)
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
  await progress.startProgress(before.id, before.handoff!)
  expect(sent()).toHaveLength(1)
})
it('suppresses simultaneous starts in different callers through the browser lock', async () => {
  const { before } = await fixture()
  await Promise.all([progress.startProgress(before.id, before.handoff!), progress.startProgress(before.id, before.handoff!)])
  expect(sent()).toHaveLength(1)
})
it('discards a stale write from another tab after opt-out and a new opt-in', async () => {
  const { before, after, incoming } = await fixture()
  await progress.startProgress(before.id, before.handoff!)
  const stale = localStorage.getItem(PROGRESS_KEY)!
  preferences.setDemandPreference(false)
  localStorage.setItem(PROGRESS_KEY, stale) // Another tab finishes its old write after deletion.
  preferences.setDemandPreference(true)
  await Promise.resolve(); await Promise.resolve()
  await client.initializeDemandCollection()
  await progress.importProgress(before, after, incoming)
  expect(sent().map(r => r.milestone)).toEqual(['started'])
  expect(localStorage.getItem(PROGRESS_KEY)).toBe('[]')
})
it('does not complete a partial import after a previously matched target changes', async () => {
  const a = await prepareImport(await collectionFixture(), { origin: 'local' })
  const b = await prepareImport(await collectionFixture(m => { m.labels[0].blend = 'Second blend' }), { origin: 'local' })
  let before = addRequests(createCollection(), [a,b].map(i => ({ catalogId: null, maker: i.designs[0].item.label.maker, blend: i.designs[0].item.label.blend })))
  before = setHandoff(before, { id: 'two-targets', createdAt: now.toISOString(), targets: before.rows.map(({ id, revision, catalogId, maker, blend, edition, notes }) => ({ rowId: id, revision, catalogId, maker, blend, edition, notes })), prompt: 'private prompt', request: 'private request', protocolRevision: '0.0.30', copied: true })
  await progress.startProgress(before.id, before.handoff!)
  const partial = applyImport(before, planImport(before, a))
  await progress.importProgress(before, partial, a)
  const changed = updateRow(partial, before.rows[0].id, { notes: 'Changed request' })
  const complete = applyImport(changed, planImport(changed, b))
  await progress.importProgress(changed, complete, b)
  expect(sent().map(r => r.milestone)).toEqual(['started'])
})
it('does not match a print after an imported request target changes', async () => {
  const { before, after, incoming } = await fixture()
  await progress.startProgress(before.id, before.handoff!)
  await progress.importProgress(before, after, incoming)
  const changed = updateRow(after, after.rows[0].id, { notes: 'Changed request' })
  await progress.printProgress(changed, changed.rows.map(r => r.id))
  expect(sent().map(r => r.milestone)).toEqual(['started','imported'])
})
it('does not send an already-read old attempt after consent changes during matching', async () => {
  const { before, after, incoming } = await fixture()
  await progress.startProgress(before.id, before.handoff!)
  let changed = false
  const interleaved = { ...before, get rows() {
    if (!changed) { changed = true; preferences.setDemandPreference(false); preferences.setDemandPreference(true) }
    return before.rows
  } }
  await progress.importProgress(interleaved, after, incoming)
  expect(sent().map(r => r.milestone)).toEqual(['started'])
})
