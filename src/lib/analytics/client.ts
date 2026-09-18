import { resolveTobaccoId } from '../tobacco-catalog'
import { parsePrintIntent, type PrintIntentEvent } from './schema'
import { usageChoice } from '../usage-preferences'
import { parseUsage, parseProgress, USAGE_PATH, PROGRESS_PATH, type UsagePayload, type ProgressPayload } from './payloads'

let capabilities = { demandEnabled: false, workflowEnabled: false, progressEnabled: false }
let configuration: Promise<boolean> | undefined
let configuredChoice: string | null = null
let generation = 0
let unavailable = false
const pending = new Set<AbortController>()
const actions = new WeakSet<object>()

export function suspendCollection() {
  generation++
  configuredChoice = null
  configuration = undefined
  capabilities = { demandEnabled: false, workflowEnabled: false, progressEnabled: false }
  for (const controller of pending) controller.abort()
  pending.clear()
}
/** No retries or alternate route after blocked, failed, or uncertain delivery. */
export function stopCollection() {
  unavailable = true
  suspendCollection()
}
function requestScope() {
  const controller = new AbortController(), epoch = generation
  pending.add(controller)
  const timer = setTimeout(() => controller.abort(), 2500)
  return {
    signal: controller.signal,
    current: (choice: string) => generation === epoch && usageChoice() === choice,
    close: () => { clearTimeout(timer); pending.delete(controller) },
  }
}
/** Configuration contains no user data. Failed configuration stays off until reload. */
export function initializeDemandCollection(): Promise<boolean> {
  const choice = usageChoice()
  if (!choice || unavailable || navigator.onLine === false) return Promise.resolve(false)
  if (configuredChoice === choice && configuration) return configuration
  suspendCollection()
  configuredChoice = choice
  configuration = (async () => {
    const scope = requestScope()
    try {
      const response = await fetch('/api/analytics/v2/config', { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: scope.signal })
      const value = response.ok ? await response.json() : null
      if (!scope.current(choice)) return false
      if (scope.signal.aborted || value?.version !== 2 || !['demandEnabled', 'workflowEnabled', 'progressEnabled'].every(key => typeof value[key] === 'boolean')) {
        stopCollection(); return false
      }
      capabilities = { demandEnabled: value.demandEnabled, workflowEnabled: value.workflowEnabled, progressEnabled: value.progressEnabled }
      return true
    } catch {
      if (scope.current(choice)) stopCollection()
      return false
    } finally { scope.close() }
  })()
  return configuration
}
export function collectionAllowed(kind: keyof typeof capabilities) {
  return !unavailable && capabilities[kind] && configuredChoice !== null && usageChoice() === configuredChoice && navigator.onLine !== false
}
/** Only an explicit receipt proves recording; an uncertain write is never resent. */
async function send(path: string, payload: unknown, expectedChoice?: string): Promise<boolean> {
  const choice = usageChoice()
  if (!choice || unavailable || choice !== configuredChoice || navigator.onLine === false || expectedChoice !== undefined && choice !== expectedChoice) return false
  const scope = requestScope()
  try {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: scope.signal })
    const recorded = response.ok && (await response.json())?.recorded === true
    if (!scope.current(choice)) return false
    if (!recorded || scope.signal.aborted) { stopCollection(); return false }
    return true
  } catch {
    if (scope.current(choice)) stopCollection()
    return false
  } finally { scope.close() }
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
