// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { appRecovery, installAppRecovery } from './app-recovery'
import { createOptionalUsage } from './optional-usage'
import { setDemandPreference } from './usage-preferences'

it('ignores the handled optional preload failure while preserving a concurrent essential failure', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('localStorage', (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window.localStorage)
  const report = vi.spyOn(appRecovery, 'report').mockReturnValue(true)
  try {
    installAppRecovery()
    setDemandPreference(true)
    const optional = new TypeError('Failed to fetch dynamically imported module: optional')
    const essential = new TypeError('Failed to fetch dynamically imported module: essential')
    const usage = createOptionalUsage(() => {
      window.dispatchEvent(Object.assign(new Event('vite:preloadError'), { payload: optional }))
      window.dispatchEvent(Object.assign(new Event('vite:preloadError'), { payload: essential }))
      return Promise.reject(optional)
    })
    await usage.initialize()
    await vi.runAllTimersAsync()
    expect(report).toHaveBeenCalledExactlyOnceWith(essential)
  } finally { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() }
})
