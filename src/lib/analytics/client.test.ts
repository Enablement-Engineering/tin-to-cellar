// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TOBACCO_CATALOG } from '../tobacco-catalog'

let preferences: typeof import('../usage-preferences')
const catalogId = TOBACCO_CATALOG[0].id
beforeEach(async () => {
  // Use the browser environment's storage, not Node's host storage global.
  vi.stubGlobal('localStorage', (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window.localStorage)
  vi.resetModules()
  preferences = await import('../usage-preferences')
  localStorage.clear()
  localStorage.setItem('tin-to-cellar:usage-choice-v2', 'on:00000000-0000-0000-0000-000000000000')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  vi.stubGlobal('fetch', vi.fn(async url => Response.json(String(url).endsWith('/config') ? { version: 2, demandEnabled: true, workflowEnabled: true, progressEnabled: true } : { recorded: true })))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('waits for enabled configuration and sends only canonical merged quantities on a print action', async () => {
  const client = await import('./client')
  client.recordDemand('print-job-requested', [{ catalogId, quantity: 2 }])
  expect(fetch).not.toHaveBeenCalled()
  await client.initializeDemandCollection()
  const action = {}
  client.recordDemand('print-job-requested', [
    { catalogId, quantity: 2, ...{ notes: 'private' } }, { catalogId, quantity: 3 },
    { catalogId: null, quantity: 1 }, { catalogId: 'private-custom-blend', quantity: 2 },
  ], action)
  client.recordDemand('print-job-requested', [{ catalogId, quantity: 5 }], action)
  expect(fetch).toHaveBeenCalledTimes(2)
  const [url, options] = vi.mocked(fetch).mock.calls[1]
  expect(url).toBe('/api/analytics/v2/print-intent')
  expect(JSON.parse(options!.body as string)).toEqual({ version: 2, event: 'print-job-requested', labels: [{ catalogId, quantity: 5 }] })
  expect(options).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' })
})

it('does not snapshot quantities for add or print-selection intent', async () => {
  const client = await import('./client')
  await client.initializeDemandCollection()
  for (const event of ['added-to-labels', 'selected-for-print'] as const) {
    client.recordDemand(event, [{ catalogId, quantity: 99 }, { catalogId, quantity: 25 }])
    expect(JSON.parse(vi.mocked(fetch).mock.lastCall![1]!.body as string)).toEqual({ version: 2, event, labels: [{ catalogId, quantity: 1 }] })
  }
})

it('reads opt-out immediately before each send, including another tab changing the preference', async () => {
  const client = await import('./client')
  await client.initializeDemandCollection()
  localStorage.setItem('tin-to-cellar:usage-choice-v2', 'off')
  client.recordDemand('added-to-labels', [{ catalogId }])
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('does not fetch configuration or queue events while opted out or offline', async () => {
  const client = await import('./client')
  preferences.setDemandPreference(false)
  await client.initializeDemandCollection()
  client.recordDemand('added-to-labels', [{ catalogId }])
  expect(fetch).not.toHaveBeenCalled()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  preferences.setDemandPreference(true)
  client.recordDemand('added-to-labels', [{ catalogId }])
  expect(fetch).not.toHaveBeenCalled()
})

it.each(['disabled', 'failure'])('fails private when configuration is %s', async mode => {
  if (mode === 'disabled') vi.mocked(fetch).mockResolvedValue(Response.json({ enabled: false }))
  else vi.mocked(fetch).mockRejectedValue(new Error('offline'))
  const client = await import('./client')
  await client.initializeDemandCollection()
  client.recordDemand('added-to-labels', [{ catalogId }])
  await client.initializeDemandCollection()
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('fails private on storage reads or writes and never throws into a print handler', async () => {
  const client = await import('./client')
  await client.initializeDemandCollection()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  expect(preferences.setDemandPreference(false)).toEqual({ allowed: false, storageFailed: true })
  client.recordDemand('added-to-labels', [{ catalogId }])
  expect(fetch).toHaveBeenCalledTimes(1)
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  expect(preferences.demandPreference().allowed).toBe(false)
})

it('drops invalid or oversized jobs and never retries a failed request', async () => {
  const client = await import('./client')
  await client.initializeDemandCollection()
  client.recordDemand('print-job-requested', [{ catalogId, quantity: 451 }])
  client.recordDemand('print-job-requested', [{ catalogId, quantity: 0 }])
  expect(fetch).toHaveBeenCalledTimes(1)
  vi.mocked(fetch).mockRejectedValue(new Error('timeout'))
  expect(() => client.recordDemand('print-job-requested', [{ catalogId, quantity: 1 }])).not.toThrow()
  await Promise.resolve()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it.each(['blocked', 'http failure', 'missing receipt', 'timeout'])('stops every collection type after %s', async failure => {
  const client = await import('./client')
  await client.initializeDemandCollection()
  if (failure === 'timeout') {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(Error('aborted')))
    }))
  } else if (failure === 'blocked') vi.mocked(fetch).mockRejectedValue(Error('blocked'))
  else vi.mocked(fetch).mockImplementation(async () => failure === 'http failure' ? new Response('', { status: 503 }) : Response.json({ recorded: false }))
  client.recordUsage({ version: 2, event: 'print-requested', outcome: 'requested' })
  if (failure === 'timeout') { await vi.advanceTimersByTimeAsync(2500); vi.useRealTimers() }
  await vi.waitFor(() => expect(client.collectionAllowed('demandEnabled')).toBe(false))
  client.recordDemand('added-to-labels', [{ catalogId }])
  client.recordUsage({ version: 2, event: 'print-requested', outcome: 'requested' })
  await client.recordProgress({ version: 2, cohort: '2026-09-14', milestone: 'started', elapsed: 'same-day' }, preferences.usageChoice()!)
  preferences.setDemandPreference(false)
  preferences.setDemandPreference(true)
  await client.initializeDemandCollection()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('aborts pending requests and does not activate old configuration after off/on', async () => {
  const client = await import('./client')
  let complete!: (response: Response) => void
  vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { complete = resolve }))
  const pending = client.initializeDemandCollection()
  const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!
  preferences.setDemandPreference(false)
  client.suspendCollection()
  preferences.setDemandPreference(true)
  complete(Response.json({ version: 2, demandEnabled: true, workflowEnabled: true, progressEnabled: true }))
  expect(signal.aborted).toBe(true)
  expect(await pending).toBe(false)
  expect(client.collectionAllowed('demandEnabled')).toBe(false)
  vi.mocked(fetch).mockImplementation(async () => Response.json({ version: 2, demandEnabled: true, workflowEnabled: true, progressEnabled: true }))
  expect(await client.initializeDemandCollection()).toBe(true)
})

it('does not treat opt-out cancellation as a delivery failure for a later choice', async () => {
  const client = await import('./client')
  await client.initializeDemandCollection()
  let signal: AbortSignal | undefined
  vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    signal = options!.signal!
    signal.addEventListener('abort', () => reject(Error('cancelled')))
  }))
  client.recordDemand('added-to-labels', [{ catalogId }])
  preferences.setDemandPreference(false)
  client.suspendCollection()
  expect(signal!.aborted).toBe(true)
  await Promise.resolve()
  preferences.setDemandPreference(true)
  vi.mocked(fetch).mockImplementation(async () => Response.json({ version: 2, demandEnabled: true, workflowEnabled: true, progressEnabled: true }))
  expect(await client.initializeDemandCollection()).toBe(true)
})
