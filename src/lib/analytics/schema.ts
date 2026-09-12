export const PRINT_INTENT_PATH = '/api/analytics/v1/print-intent'
export const PRINT_INTENT_LIMITS = { bodyBytes: 16384, labels: 100, quantity: 450 } as const
export type PrintIntentEvent = 'added-to-labels' | 'selected-for-print' | 'print-job-requested'
export type PrintIntentLabel = { catalogId: string; quantity: number }
export type PrintIntentPayload = { event: PrintIntentEvent; labels: PrintIntentLabel[] }

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

/** Deliberately excludes arbitrary text and all client, collection, and event identifiers. */
export function parsePrintIntent(value: unknown): PrintIntentPayload | null {
  if (!record(value) || !exact(value, ['event', 'labels']) || typeof value.event !== 'string' || !['added-to-labels', 'selected-for-print', 'print-job-requested'].includes(value.event) || !Array.isArray(value.labels) || !value.labels.length || value.labels.length > PRINT_INTENT_LIMITS.labels) return null
  const ids = new Set<string>()
  let total = 0
  for (const label of value.labels) {
    if (!record(label) || !exact(label, ['catalogId', 'quantity']) || typeof label.catalogId !== 'string' || label.catalogId.length > 200 || !/^[a-z0-9][a-z0-9-]*$/.test(label.catalogId) || ids.has(label.catalogId) || !Number.isSafeInteger(label.quantity) || Number(label.quantity) < 1 || Number(label.quantity) > PRINT_INTENT_LIMITS.quantity) return null
    ids.add(label.catalogId)
    total += Number(label.quantity)
  }
  return total <= PRINT_INTENT_LIMITS.quantity ? value as PrintIntentPayload : null
}
