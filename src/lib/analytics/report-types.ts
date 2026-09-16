export type UsageSummary = {
  from: string; through: string; cohortFrom: string; cohortBoundaryExpired: boolean; admissionBlockedNow: boolean; refreshedAt: string
  capabilities: { version: number; demandEnabled: boolean; workflowEnabled: boolean; progressEnabled: boolean; webTrafficEnabled: boolean }
  allowance: number
  events: { period_start: string; event: string; outcome: string; count: number }[]
  progress: { cohort: string; milestone: string; elapsed: string; count: number }[]
  collection: { period_start: string; admitted: number; recorded: number; allowance: number; allowance_reached: number }[]
  cleanup: { last_attempt: string | null; last_success: string | null; failed: number } | null
}
export type BlendUsage = { blends: { catalog_id: string; maker: string; blend: string; added: number; selected: number; jobs: number; quantity: number; artwork: number }[]; hasMore: boolean; nextCursor: number | null; refreshedAt: string; serving: boolean }
