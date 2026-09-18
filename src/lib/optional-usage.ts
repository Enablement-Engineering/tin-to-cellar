import { usageChoice, subscribeDemandPreference } from './usage-preferences'
import { pruneProgress } from './usage-progress-storage'
import { markOptionalModuleFailure } from './optional-module-failures'
import type * as UsageRuntime from './analytics/runtime'

type Runtime = typeof UsageRuntime

/** The core app never waits for collection, and observations are never queued. */
export function createOptionalUsage(load: () => Promise<Runtime>) {
  let runtime: Runtime | undefined
  let loading: Promise<Runtime> | undefined
  let initialization: { choice: string; promise: Promise<void> } | undefined
  let choice: string | null = null
  let readyChoice: string | null = null
  let unavailable = false
  let users = 0
  let unsubscribe: (() => void) | undefined

  function stop() {
    unavailable = true
    readyChoice = null
    try { runtime?.stopCollection() } catch { /* Collection must not affect the app. */ }
  }
  function syncChoice() {
    const current = usageChoice()
    if (current !== choice) {
      choice = current
      readyChoice = null
      initialization = undefined
      runtime?.suspendCollection()
    }
    return current
  }
  function initialize(): Promise<void> {
    try {
      const current = syncChoice()
      if (!current || unavailable || navigator.onLine === false) return Promise.resolve()
      if (initialization?.choice === current) return initialization.promise
      loading ??= load()
      const promise = loading.then(async module => {
        runtime = module
        if (unavailable || usageChoice() !== current || choice !== current) return
        const ready = await module.initializeDemandCollection()
        if (usageChoice() === current && choice === current && ready && !unavailable) readyChoice = current
      }).catch(error => { markOptionalModuleFailure(error); stop() })
      initialization = { choice: current, promise }
      return promise
    } catch { stop(); return Promise.resolve() }
  }
  function observe(action: (module: Runtime) => unknown) {
    try {
      const current = syncChoice()
      if (!current || current !== readyChoice || unavailable || !runtime || navigator.onLine === false) return
      // Invoke now or drop it. Never retain this closure while the runtime loads.
      void Promise.resolve(action(runtime)).catch(stop)
    } catch { stop() }
  }
  function start() {
    if (users++ === 0) {
      const changed = () => { pruneProgress(); void initialize() }
      unsubscribe = subscribeDemandPreference(changed)
      changed()
    }
    let released = false
    return () => {
      if (released) return
      released = true
      if (--users === 0) { unsubscribe?.(); unsubscribe = undefined }
    }
  }
  return {
    start, initialize,
    recordDemand: (...args: Parameters<Runtime['recordDemand']>) => observe(module => module.recordDemand(...args)),
    recordUsage: (...args: Parameters<Runtime['recordUsage']>) => observe(module => module.recordUsage(...args)),
    startProgress: (...args: Parameters<Runtime['startProgress']>) => observe(module => module.startProgress(...args)),
    importProgress: (...args: Parameters<Runtime['importProgress']>) => observe(module => module.importProgress(...args)),
    printProgress: (...args: Parameters<Runtime['printProgress']>) => observe(module => module.printProgress(...args)),
  }
}

const usage = createOptionalUsage(() => import('./analytics/runtime'))
export const startUsage = usage.start
export const recordDemand = usage.recordDemand
export const recordUsage = usage.recordUsage
export const startProgress = usage.startProgress
export const importProgress = usage.importProgress
export const printProgress = usage.printProgress
