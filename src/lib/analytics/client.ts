import { resolveTobaccoId } from '../tobacco-catalog'
import { parsePrintIntent, type PrintIntentEvent } from './schema'
import { demandPreference, PREFERENCE_KEY, setDemandPreference as savePreference } from './preferences'
import { parseUsage, parseProgress, USAGE_PATH, PROGRESS_PATH, type UsagePayload, type ProgressPayload } from './events'
export { demandPreference, subscribeDemandPreference } from './preferences'
let capabilities = { demandEnabled: false, workflowEnabled: false, progressEnabled: false }
let configuration: Promise<void> | undefined
const actions = new WeakSet<object>()
export function setDemandPreference(allowed: boolean) {
  const result = savePreference(allowed)
  if (result.allowed) void initializeDemandCollection()
  return result
}
/** Configuration contains no user data. Legacy clients never receive enabled=true. */
export function initializeDemandCollection(): Promise<void> {
  if (!demandPreference().allowed || navigator.onLine === false) return Promise.resolve()
  if (configuration) return configuration
  configuration = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    try {
      const response = await fetch('/api/analytics/v2/config', { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal })
      const value = response.ok ? await response.json() : null
      if (value?.version === 2) capabilities = { demandEnabled: value.demandEnabled === true, workflowEnabled: value.workflowEnabled === true, progressEnabled: value.progressEnabled === true }
    } catch { /* No deferred event delivery after failed configuration. */ }
    finally { clearTimeout(timer) }
  })()
  return configuration
}
export function collectionAllowed(kind: keyof typeof capabilities) {
  return capabilities[kind] && demandPreference().allowed && navigator.onLine !== false
}
/** No retry: an uncertain write is never sent again. Only an explicit receipt proves recording. */
async function send(path: string, payload: unknown, expectedChoice?: string): Promise<boolean> {
  if (!demandPreference().allowed || navigator.onLine === false) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    if (expectedChoice !== undefined && localStorage.getItem(PREFERENCE_KEY) !== expectedChoice) return false
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal })
    return response.ok && (await response.json().catch(() => null))?.recorded === true
  } catch { return false }
  finally { clearTimeout(timer) }
}
export function recordUsage(payload: UsagePayload, action: object = {}) {
  try {
    if (!collectionAllowed('workflowEnabled') || actions.has(action) || !parseUsage(payload)) return
    actions.add(action)
    void send(USAGE_PATH, payload)
  } catch { /* Optional collection cannot alter the action's outcome. */ }
}
export async function recordProgress(payload: ProgressPayload, expectedChoice: string): Promise<boolean> {
  try { return collectionAllowed('progressEnabled') && !!parseProgress(payload) && await send(PROGRESS_PATH, payload, expectedChoice) }
  catch { return false }
}
export type DemandRow = { catalogId: string | null; quantity?: number }
export function recordDemand(event: PrintIntentEvent, rows: readonly DemandRow[], action: object = {}) {
  try {
    if (!collectionAllowed('demandEnabled') || actions.has(action)) return
    const quantities = new Map<string, number>()
    for (const row of rows) {
      const id = row.catalogId ? resolveTobaccoId(row.catalogId)?.id : undefined
      const quantity = event === 'print-job-requested' ? row.quantity : 1
      if (!id || quantity === undefined || !Number.isSafeInteger(quantity) || quantity <= 0) continue
      quantities.set(id, event === 'print-job-requested' ? (quantities.get(id) ?? 0) + quantity : 1)
    }
    const payload = parsePrintIntent({ event, labels: [...quantities].map(([catalogId, quantity]) => ({ catalogId, quantity })) })
    if (!payload) return
    actions.add(action)
    void send('/api/analytics/v2/print-intent', { version: 2, ...payload })
  } catch { /* Printing and saving work independently of measurement. */ }
}
