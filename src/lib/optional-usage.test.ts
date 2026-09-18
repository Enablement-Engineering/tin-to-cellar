// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

type Runtime = typeof import('./analytics/runtime')
let preferences: typeof import('./usage-preferences')
let create: typeof import('./optional-usage').createOptionalUsage
const event = { version: 2, event: 'print-requested', outcome: 'requested' } as const
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function mockRuntime(): Runtime {
  return {
    initializeDemandCollection: vi.fn().mockResolvedValue(true),
    suspendCollection: vi.fn(), stopCollection: vi.fn(),
    recordDemand: vi.fn(), recordUsage: vi.fn(),
    startProgress: vi.fn().mockResolvedValue(undefined),
    importProgress: vi.fn().mockResolvedValue(undefined),
    printProgress: vi.fn().mockResolvedValue(undefined),
  }
}
beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window.localStorage)
  localStorage.clear()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  preferences = await import('./usage-preferences')
  create = (await import('./optional-usage')).createOptionalUsage
  preferences.setDemandPreference(true)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('shares one load and drops all observations before readiness', async () => {
  const loading = deferred<Runtime>(), module = mockRuntime(), load = vi.fn(() => loading.promise)
  const usage = create(load)
  const a = usage.initialize(), b = usage.initialize()
  usage.recordUsage(event)
  expect(load).toHaveBeenCalledTimes(1)
  loading.resolve(module)
  await Promise.all([a, b])
  expect(module.recordUsage).not.toHaveBeenCalled()
  usage.recordUsage(event)
  expect(module.recordUsage).toHaveBeenCalledExactlyOnceWith(event)
})

it.each(['rejection', 'synchronous throw'])('a loader %s stays inactive through new actions and off/on', async failure => {
  const load = vi.fn(() => {
    if (failure === 'synchronous throw') throw Error('blocked')
    return Promise.reject(Error('evaluation or network failure'))
  })
  const usage = create(load)
  await usage.initialize()
  usage.recordUsage(event)
  preferences.setDemandPreference(false)
  await usage.initialize()
  preferences.setDemandPreference(true)
  await usage.initialize()
  expect(load).toHaveBeenCalledTimes(1)
})

it.each(['throw', 'reject'])('runtime observation failure %s cannot escape or retry', async failure => {
  const module = mockRuntime(), usage = create(async () => module)
  await usage.initialize()
  vi.mocked(module.recordUsage).mockImplementation(() => {
    if (failure === 'throw') throw Error('runtime failure')
    return Promise.reject(Error('runtime rejection')) as unknown as void
  })
  expect(() => usage.recordUsage(event)).not.toThrow()
  await Promise.resolve(); await Promise.resolve()
  usage.recordUsage(event)
  expect(module.recordUsage).toHaveBeenCalledTimes(1)
  expect(module.stopCollection).toHaveBeenCalledTimes(1)
})

it('handles rejected initialization without affecting future app actions', async () => {
  const module = mockRuntime(), load = vi.fn(async () => module), usage = create(load)
  vi.mocked(module.initializeDemandCollection).mockRejectedValue(Error('configuration'))
  await usage.initialize()
  await usage.initialize()
  usage.recordUsage(event)
  expect(load).toHaveBeenCalledTimes(1)
  expect(module.recordUsage).not.toHaveBeenCalled()
})

it('does not load when opted out, offline, or preference storage fails', async () => {
  const load = vi.fn(async () => mockRuntime()), usage = create(load)
  preferences.setDemandPreference(false)
  await usage.initialize()
  preferences.setDemandPreference(true)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  await usage.initialize()
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('denied') })
  await usage.initialize()
  expect(load).not.toHaveBeenCalled()
})

it('a consent change during module loading cannot initialize the old choice', async () => {
  const loading = deferred<Runtime>(), module = mockRuntime(), usage = create(() => loading.promise)
  const pending = usage.initialize()
  preferences.setDemandPreference(false)
  loading.resolve(module)
  await pending
  expect(module.initializeDemandCollection).not.toHaveBeenCalled()
  usage.recordUsage(event)
  expect(module.recordUsage).not.toHaveBeenCalled()
})

it('an off/on change during configuration cannot make old initialization ready', async () => {
  const configured = deferred<boolean>(), module = mockRuntime(), usage = create(async () => module)
  vi.mocked(module.initializeDemandCollection).mockReturnValueOnce(configured.promise)
  const old = usage.initialize()
  await Promise.resolve()
  preferences.setDemandPreference(false)
  await usage.initialize()
  preferences.setDemandPreference(true)
  configured.resolve(true)
  await old
  usage.recordUsage(event)
  expect(module.recordUsage).not.toHaveBeenCalled()
  await usage.initialize()
  usage.recordUsage(event)
  expect(module.recordUsage).toHaveBeenCalledTimes(1)
})

it('startup subscriptions survive remount without duplicating initialization and handle another tab opting out', async () => {
  const module = mockRuntime(), load = vi.fn(async () => module), usage = create(load)
  const release = usage.start()
  release(); release()
  const releaseAgain = usage.start()
  await usage.initialize()
  expect(load).toHaveBeenCalledTimes(1)
  expect(module.initializeDemandCollection).toHaveBeenCalledTimes(1)
  localStorage.setItem(preferences.PROGRESS_KEY, '[]')
  localStorage.setItem(preferences.PREFERENCE_KEY, 'off:another-tab')
  window.dispatchEvent(new StorageEvent('storage', { key: preferences.PREFERENCE_KEY }))
  usage.recordUsage(event)
  expect(module.recordUsage).not.toHaveBeenCalled()
  expect(localStorage.getItem(preferences.PROGRESS_KEY)).toBeNull()
  expect(module.suspendCollection).toHaveBeenCalled()
  releaseAgain()
})
