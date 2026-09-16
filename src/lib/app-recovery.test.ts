import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRecovery, fetchAppBuild, isModuleLoadFailure, RECOVERY_FOCUS_KEY } from './app-recovery'

const moduleFailure = () => new TypeError('Failed to fetch dynamically imported module: https://example.test/assets/prompt-old.js')
type Options = ConstructorParameters<typeof AppRecovery>[0]

function setup(overrides: Partial<Options> = {}) {
  const values = new Map<string, string>()
  const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value) }) }
  const version = vi.fn(async () => 'build-B')
  const reload = vi.fn()
  const options: Options = {
    buildId: 'build-A', version, storage: () => storage, reload,
    href: () => 'https://example.test/labels/help', online: () => true, visible: () => true,
    now: () => Date.now(), ...overrides,
  }
  const controller = new AppRecovery(options)
  return { controller, options, values, storage, version, reload }
}

async function fail(controller: AppRecovery) {
  expect(controller.report(moduleFailure())).toBe(true)
  await controller.check()
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-16T12:00:00Z')) })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('AppRecovery decisions', () => {
  it('ignores generic render errors and plain strings instead of offering an update as a cure', () => {
    const test = setup()
    expect(test.controller.report(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(test.controller.report('Failed to fetch dynamically imported module')).toBe(false)
    expect(test.controller.getSnapshot().phase).toBe('idle')
    expect(test.version).not.toHaveBeenCalled()
    expect(test.reload).not.toHaveBeenCalled()
  })

  it.each([
    'Failed to fetch dynamically imported module: /assets/a.js',
    'Importing a module script failed.',
    'error loading dynamically imported module',
    'Unable to preload CSS for /assets/a.css',
    'Loading chunk settings failed',
    'Loading CSS chunk settings failed',
  ])('recognizes module-loading failure: %s', message => {
    expect(isModuleLoadFailure(new Error(message))).toBe(true)
  })

  it('refreshes a known update only after an owner declares the document safe, and records focus first', async () => {
    const test = setup()
    test.controller.guard(Symbol('app'), null, true)
    await fail(test.controller)
    expect(test.controller.getSnapshot().phase).toBe('update')
    expect(test.reload).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(100)
    expect(test.reload).toHaveBeenCalledOnce()
    expect(test.storage.getItem(RECOVERY_FOCUS_KEY)).toBe('1')
    expect(test.storage.setItem.mock.invocationCallOrder.at(-1)).toBeLessThan(test.reload.mock.invocationCallOrder[0])
    expect(test.controller.refresh()).toBe(false)
    expect(test.reload).toHaveBeenCalledOnce()
  })

  it('requires an owner for automatic and explicit refresh, including after its owner unmounts', async () => {
    const test = setup()
    await fail(test.controller)
    await vi.advanceTimersByTimeAsync(100)
    expect(test.controller.refresh()).toBe(false)
    const dispose = test.controller.guard(Symbol('app'), null, true)
    dispose()
    await vi.advanceTimersByTimeAsync(100)
    expect(test.controller.refresh()).toBe(false)
    expect(test.reload).not.toHaveBeenCalled()
    expect(test.controller.getSnapshot().blocked).toBeTruthy()
  })

  it('coalesces concurrent failures and checks into one version request and one refresh', async () => {
    let resolveVersion!: (version: string) => void
    const version = vi.fn(() => new Promise<string>(resolve => { resolveVersion = resolve }))
    const test = setup({ version })
    test.controller.guard(Symbol('app'), null, true)
    test.controller.report(moduleFailure())
    test.controller.report(moduleFailure())
    const pending = test.controller.check()
    expect(test.controller.check()).toBe(pending)
    expect(version).toHaveBeenCalledOnce()
    resolveVersion('build-B')
    await pending
    await vi.advanceTimersByTimeAsync(100)
    expect(test.reload).toHaveBeenCalledOnce()
  })

  it('rechecks activity that starts while the marker request is pending', async () => {
    let resolveVersion!: (version: string) => void
    const test = setup({ version: () => new Promise<string>(resolve => { resolveVersion = resolve }) })
    test.controller.guard(Symbol('app'), null, true)
    test.controller.report(moduleFailure())
    const pending = test.controller.check()
    const release = test.controller.guard(Symbol('save'), 'Saving your labels.')
    resolveVersion('build-B')
    await pending
    await vi.advanceTimersByTimeAsync(100)
    expect(test.reload).not.toHaveBeenCalled()
    expect(test.controller.refresh()).toBe(false)
    expect(test.controller.getSnapshot().blocked).toBe('Saving your labels.')
    release()
    await vi.advanceTimersByTimeAsync(100)
    expect(test.reload).toHaveBeenCalledOnce()
  })

  it('checks a dialog or print state immediately before both automatic and manual refresh', async () => {
    let blocked: string | null = null
    const test = setup({ blocked: () => blocked })
    test.controller.guard(Symbol('app'), null, true)
    await fail(test.controller)
    blocked = 'Close the print dialog.'
    await vi.advanceTimersByTimeAsync(100)
    expect(test.reload).not.toHaveBeenCalled()
    expect(test.controller.refresh()).toBe(false)
    expect(test.controller.getSnapshot().blocked).toBe(blocked)
    blocked = null
    expect(test.controller.refresh()).toBe(true)
    expect(test.reload).toHaveBeenCalledOnce()
  })

  it('does not refresh a different screen after a delayed version result', async () => {
    let href = 'https://example.test/labels/help'
    const test = setup({ href: () => href })
    test.controller.guard(Symbol('app'), null, true)
    await fail(test.controller)
    href = 'https://example.test/labels/order'
    await vi.advanceTimersByTimeAsync(100)
    expect(test.reload).not.toHaveBeenCalled()
    // An explicit request on a safe screen is still a deliberate recovery choice.
    expect(test.controller.refresh()).toBe(true)
  })

  it('does not check or refresh while offline, and can check after reconnection', async () => {
    let online = false
    const test = setup({ online: () => online })
    test.controller.guard(Symbol('app'), null, true)
    await fail(test.controller)
    expect(test.controller.getSnapshot().phase).toBe('offline')
    expect(test.version).not.toHaveBeenCalled()
    expect(test.controller.refresh()).toBe(false)
    online = true
    await test.controller.check()
    await vi.advanceTimersByTimeAsync(100)
    expect(test.reload).toHaveBeenCalledOnce()
  })

  it('does not refresh after the tab becomes hidden or disconnected during a version check', async () => {
    for (const property of ['visible', 'online'] as const) {
      let available = true
      const test = setup({ [property]: () => available })
      test.controller.guard(Symbol('app'), null, true)
      await fail(test.controller)
      available = false
      await vi.advanceTimersByTimeAsync(100)
      expect(test.controller.refresh()).toBe(false)
      expect(test.reload).not.toHaveBeenCalled()
    }
  })

  it('keeps same-build failures available for deliberate recovery without automatic refresh', async () => {
    const test = setup({ version: async () => 'build-A' })
    test.controller.guard(Symbol('app'), null, true)
    await fail(test.controller)
    await vi.advanceTimersByTimeAsync(500)
    expect(test.controller.getSnapshot().phase).toBe('current')
    expect(test.reload).not.toHaveBeenCalled()
    expect(test.controller.refresh()).toBe(true)
  })

  it.each(['timeout', 'invalid marker', 'network failure'])('does not automatically refresh after %s', async message => {
    const test = setup({ version: async () => { throw new Error(message) } })
    test.controller.guard(Symbol('app'), null, true)
    await fail(test.controller)
    await vi.advanceTimersByTimeAsync(500)
    expect(test.controller.getSnapshot().phase).toBe('unknown')
    expect(test.reload).not.toHaveBeenCalled()
  })

  it.each(['access', 'read', 'write'])('disables automatic recovery when storage %s fails but permits a safe deliberate refresh', async fault => {
    const test = setup()
    const denied = () => { throw new Error('Storage denied') }
    if (fault === 'access') test.options.storage = denied
    if (fault === 'read') test.storage.getItem.mockImplementation(denied)
    if (fault === 'write') test.storage.setItem.mockImplementation(denied)
    test.controller.guard(Symbol('app'), null, true)
    await fail(test.controller)
    await vi.advanceTimersByTimeAsync(100)
    expect(test.reload).not.toHaveBeenCalled()
    expect(test.controller.getSnapshot().attempted).toBe(true)
    const release = test.controller.guard(Symbol('draft'), 'Save the draft first.')
    expect(test.controller.refresh()).toBe(false)
    release()
    expect(test.controller.refresh()).toBe(true)
    expect(test.reload).toHaveBeenCalledOnce()
  })

  it('limits recovery across documents even when another new build is advertised', async () => {
    const first = setup()
    first.controller.guard(Symbol('app'), null, true)
    await fail(first.controller)
    await vi.advanceTimersByTimeAsync(100)
    expect(first.reload).toHaveBeenCalledOnce()
    const next = setup({ buildId: 'build-B', version: async () => 'build-C', storage: () => first.storage })
    next.controller.guard(Symbol('app'), null, true)
    await fail(next.controller)
    await vi.advanceTimersByTimeAsync(100)
    expect(next.reload).not.toHaveBeenCalled()
    expect(next.controller.getSnapshot().attempted).toBe(true)
    expect(next.controller.refresh()).toBe(true)
    expect(next.reload).toHaveBeenCalledOnce()
  })

  it('allows a fresh automatic attempt after the cooldown has expired', async () => {
    const first = setup()
    first.controller.guard(Symbol('app'), null, true)
    await fail(first.controller)
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    const next = setup({ buildId: 'build-B', version: async () => 'build-C', storage: () => first.storage })
    next.controller.guard(Symbol('app'), null, true)
    await fail(next.controller)
    await vi.advanceTimersByTimeAsync(100)
    expect(next.reload).toHaveBeenCalledOnce()
  })

  it.each(['null', 'not JSON', '{}', '{"at":"yesterday"}'])('fails closed on a corrupt reload record: %s', async record => {
    const test = setup()
    test.values.set('tin-to-cellar:app-recovery-attempt', record)
    test.controller.guard(Symbol('app'), null, true)
    await fail(test.controller)
    await vi.advanceTimersByTimeAsync(100)
    expect(test.reload).not.toHaveBeenCalled()
  })
})

describe('fetchAppBuild marker validation', () => {
  it('fetches a bounded same-origin build identity with fresh cache semantics', async () => {
    const fetch = vi.fn(async () => Response.json({ buildId: 'release.2026-09-16_A' }))
    vi.stubGlobal('fetch', fetch)
    await expect(fetchAppBuild()).resolves.toBe('release.2026-09-16_A')
    expect(fetch).toHaveBeenCalledWith('/app-version.json', expect.objectContaining({ cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: expect.any(AbortSignal) }))
  })

  it.each([
    'null', '[]', 'true', '42', '"release-A"', '{}', '{',
    '{"buildId":0}', '{"buildId":""}', '{"buildId":"../app"}',
    '{"buildId":"A","protocol":"B"}', JSON.stringify({ buildId: 'A'.repeat(161) }),
  ])('rejects a malformed marker without accepting it as a new release: %s', async body => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'Content-Type': 'application/json' } })))
    await expect(fetchAppBuild()).rejects.toThrow()
  })

  it.each([
    new Response('<!DOCTYPE html><title>SPA fallback</title>', { headers: { 'Content-Type': 'text/html' } }),
    Response.json({ buildId: 'A' }, { status: 503 }),
    new Response(null, { headers: { 'Content-Type': 'application/json' } }),
  ])('rejects HTML fallback, HTTP errors, and missing bodies', async response => {
    vi.stubGlobal('fetch', vi.fn(async () => response))
    await expect(fetchAppBuild()).rejects.toThrow('Build unavailable')
  })

  it('cancels an oversized streaming marker before consuming its remaining chunks', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode(`{"buildId":"A"}${' '.repeat(513)}`)) },
      cancel,
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { headers: { 'Content-Type': 'application/json' } })))
    await expect(fetchAppBuild()).rejects.toThrow('Invalid build marker')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('uses a five-second deadline and propagates a timed-out request as failed verification', async () => {
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => {
      setTimeout(() => controller.abort(new DOMException('Deadline exceeded', 'TimeoutError')), milliseconds)
      return controller.signal
    })
    vi.stubGlobal('fetch', vi.fn((_input, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(options.signal!.reason), { once: true })
    })))
    const request = fetchAppBuild()
    const rejected = expect(request).rejects.toThrow('Deadline exceeded')
    await vi.advanceTimersByTimeAsync(5000)
    await rejected
    expect(timeout).toHaveBeenCalledWith(5000)
  })
})
