// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TOBACCO_CATALOG } from '../tobacco-catalog'

const catalogId = TOBACCO_CATALOG[0].id
beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ enabled: true })))
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
  expect(url).toBe('/api/analytics/v1/print-intent')
  expect(JSON.parse(options!.body as string)).toEqual({ event: 'print-job-requested', labels: [{ catalogId, quantity: 5 }] })
  expect(options).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' })
})

it('does not snapshot quantities for add or print-selection intent', async () => {
  const client = await import('./client')
  await client.initializeDemandCollection()
  for (const event of ['added-to-labels', 'selected-for-print'] as const) {
    client.recordDemand(event, [{ catalogId, quantity: 99 }, { catalogId, quantity: 25 }])
    expect(JSON.parse(vi.mocked(fetch).mock.lastCall![1]!.body as string)).toEqual({ event, labels: [{ catalogId, quantity: 1 }] })
  }
})

it('reads opt-out immediately before each send, including another tab changing the preference', async () => {
  const client = await import('./client')
  await client.initializeDemandCollection()
  localStorage.setItem('tin-to-cellar:aggregate-demand', 'off')
  client.recordDemand('added-to-labels', [{ catalogId }])
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('does not fetch configuration or queue events while opted out or offline', async () => {
  const client = await import('./client')
  client.setDemandPreference(false)
  await client.initializeDemandCollection()
  client.recordDemand('added-to-labels', [{ catalogId }])
  expect(fetch).not.toHaveBeenCalled()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  client.setDemandPreference(true)
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
  expect(client.setDemandPreference(false)).toEqual({ allowed: false, storageFailed: true })
  client.recordDemand('added-to-labels', [{ catalogId }])
  expect(fetch).toHaveBeenCalledTimes(1)
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  expect(client.demandPreference().allowed).toBe(false)
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
