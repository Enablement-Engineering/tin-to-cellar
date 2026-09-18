export const USAGE_VERSION = 2
export const USAGE_PATH = '/api/analytics/v2/events'
export const PROGRESS_PATH = '/api/analytics/v2/progress'
export const DAY_MS = 86_400_000
export const outcomes = {
  'instructions-copy-result': ['copied', 'preparation-failed', 'clipboard-failed'],
  'pack-check-result': ['ready', 'partial', 'rejected', 'read-failed', 'module-unavailable'],
  'pack-import-applied': ['saved'],
  'gallery-design-applied': ['saved'],
  'print-preparation-result': ['ready', 'preview-unavailable', 'loading', 'needs-artwork', 'empty'],
  'print-requested': ['requested'],
  'labels-download-requested': ['requested'],
  'workflow-failed': ['import-save', 'gallery-add', 'labels-export'],
} as const
export type UsageEvent = keyof typeof outcomes
export type UsagePayload = { [E in UsageEvent]: { version: 2; event: E; outcome: typeof outcomes[E][number] } }[UsageEvent]
export const milestones = ['started', 'imported', 'print-requested'] as const
export const elapsedBuckets = ['same-day', '1-7-days', '8-14-days', '15-30-days'] as const
export type ProgressPayload = { version: 2; cohort: string; milestone: typeof milestones[number]; elapsed: typeof elapsedBuckets[number] }
export const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export const hasKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
export const utcDay = (date: Date) => date.toISOString().slice(0, 10)
export function cohortWeek(date: Date): string {
  const start = new Date(`${utcDay(date)}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
  return utcDay(start)
}
export function elapsedBucket(start: number, now: number): ProgressPayload['elapsed'] {
  const days = Math.floor((now - start) / DAY_MS)
  return days < 1 ? 'same-day' : days <= 7 ? '1-7-days' : days <= 14 ? '8-14-days' : '15-30-days'
}
export function parseUsage(value: unknown): UsagePayload | null {
  if (!isRecord(value) || !hasKeys(value, ['version', 'event', 'outcome']) || value.version !== 2 || typeof value.event !== 'string' || !Object.hasOwn(outcomes, value.event)) return null
  return (outcomes[value.event as UsageEvent] as readonly unknown[]).includes(value.outcome) ? value as UsagePayload : null
}
export function parseProgress(value: unknown, now = new Date()): ProgressPayload | null {
  if (!isRecord(value) || !hasKeys(value, ['version', 'cohort', 'milestone', 'elapsed']) || value.version !== 2 || typeof value.cohort !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.cohort) || !(milestones as readonly unknown[]).includes(value.milestone) || !(elapsedBuckets as readonly unknown[]).includes(value.elapsed)) return null
  const date = new Date(`${value.cohort}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || utcDay(date) !== value.cohort || date.getUTCDay() !== 1) return null
  const age = (now.getTime() - date.getTime()) / DAY_MS
  if (age < 0 || age >= 37 || (value.milestone === 'started' && (value.elapsed !== 'same-day' || value.cohort !== cohortWeek(now)))) return null
  const minimum = value.elapsed === '15-30-days' ? 15 : value.elapsed === '8-14-days' ? 8 : value.elapsed === '1-7-days' ? 1 : 0
  return age >= minimum ? value as ProgressPayload : null
}
