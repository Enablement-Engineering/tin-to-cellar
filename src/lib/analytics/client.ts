import { resolveTobaccoId } from '../tobacco-catalog'
import { parsePrintIntent, PRINT_INTENT_PATH, type PrintIntentEvent } from './schema'

const preferenceKey = 'tin-to-cellar:aggregate-demand'
const preferenceEvent = 'tin-to-cellar:aggregate-demand-change'
let storageFailed = false
let enabled = false
let configuration: Promise<void> | undefined
const actions = new WeakSet<object>()

export function demandPreference(): { allowed: boolean; storageFailed: boolean } {
  try {
    const stored = localStorage.getItem(preferenceKey)
    return { allowed: !storageFailed && (stored === null || stored === 'on'), storageFailed }
  } catch {
    storageFailed = true
    return { allowed: false, storageFailed: true }
  }
}

export function setDemandPreference(allowed: boolean) {
  try { localStorage.setItem(preferenceKey, allowed ? 'on' : 'off') }
  catch { storageFailed = true }
  window.dispatchEvent(new Event(preferenceEvent))
  if (allowed && !storageFailed) void initializeDemandCollection()
  return demandPreference()
}

export function subscribeDemandPreference(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener(preferenceEvent, listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener(preferenceEvent, listener)
  }
}

/** Configuration is read once per loaded app. Failed reads never queue events. */
export function initializeDemandCollection(): Promise<void> {
  if (!demandPreference().allowed || navigator.onLine === false) return Promise.resolve()
  if (configuration) return configuration
  configuration = (async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    try {
      const response = await fetch('/api/analytics/v1/config', { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal })
      if (response.ok) {
        const config: unknown = await response.json()
        enabled = typeof config === 'object' && config !== null && 'enabled' in config && config.enabled === true
      }
    } catch { enabled = false }
    finally { clearTimeout(timeout) }
  })()
  return configuration
}

export type DemandRow = { catalogId: string | null; quantity?: number }

/** Only explicit user handlers call this. No retries, delayed sends or event store. */
export function recordDemand(event: PrintIntentEvent, rows: readonly DemandRow[], action: object = {}) {
  try {
    if (!enabled || !demandPreference().allowed || navigator.onLine === false || actions.has(action)) return
    const quantities = new Map<string, number>()
    for (const row of rows) {
      const catalogId = row.catalogId ? resolveTobaccoId(row.catalogId)?.id : undefined
      if (!catalogId) continue
      const quantity = event === 'print-job-requested' ? row.quantity : 1
      if (quantity === undefined || !Number.isSafeInteger(quantity) || quantity <= 0) continue
      quantities.set(catalogId, event === 'print-job-requested' ? (quantities.get(catalogId) ?? 0) + quantity : 1)
    }
    const payload = parsePrintIntent({ event, labels: [...quantities].map(([catalogId, quantity]) => ({ catalogId, quantity })) })
    if (!payload || !demandPreference().allowed) return
    actions.add(action)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    // Even a synchronous fetch error must leave the user's print action usable.
    try {
      void fetch(PRINT_INTENT_PATH, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal,
      }).catch(() => undefined).finally(() => clearTimeout(timeout))
    } catch { clearTimeout(timeout) }
  } catch { /* Demand collection is optional and must never interrupt local work. */ }
}
