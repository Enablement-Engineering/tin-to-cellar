import type { Collection, CollectionHandoff, ImportCandidate } from '../collection/types'
import { planImport } from '../collection/import'
import { collectionAllowed, recordProgress } from './client'
import { demandPreference, PROGRESS_KEY, PREFERENCE_KEY, PROGRESS_LOCK } from './preferences'
import { cohortWeek, DAY_MS, elapsedBucket, type ProgressPayload } from './events'

type Target = { rowId: string; revision: number; designId?: string; appliedRevision?: number }
type Attempt = { choice: string; id: string; collectionId: string; started: number; targets: Target[]; startRecorded: boolean; importAttempted: boolean; importRecorded: boolean; printAttempted: boolean }
/** IDs only live here on this origin. They are never included in network payloads. */
function read(now: number): Attempt[] {
  const raw = localStorage.getItem(PROGRESS_KEY)
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || value.length > 20) throw new Error('Invalid local progress')
  const valid = value.filter((item): item is Attempt => !!item && typeof item === 'object' && typeof item.id === 'string' && typeof item.collectionId === 'string' && Number.isFinite(item.started) && item.started <= now && now - item.started < 30 * DAY_MS && Array.isArray(item.targets) && item.targets.length > 0 && item.targets.length <= 100 && item.targets.every((t: Target) => typeof t.rowId === 'string' && Number.isSafeInteger(t.revision) && (t.designId === undefined || typeof t.designId === 'string')) && ['startRecorded', 'importAttempted', 'importRecorded', 'printAttempted'].every(k => typeof item[k] === 'boolean'))
  return valid.filter(item => item.choice === localStorage.getItem(PREFERENCE_KEY) && item.targets.every(t => !t.designId || Number.isSafeInteger(t.appliedRevision)))
}
function save(attempts: Attempt[]) {
  if (!demandPreference().allowed) return
  const choice = localStorage.getItem(PREFERENCE_KEY)
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(attempts.filter(a => a.choice === choice)))
}
function payload(attempt: Attempt, milestone: ProgressPayload['milestone'], now: number): ProgressPayload {
  return { version: 2, cohort: cohortWeek(new Date(attempt.started)), milestone, elapsed: elapsedBucket(attempt.started, now) }
}
/** Cross-tab exclusion is required; unsupported browsers still get normal action counts. No waiting event queue. */
async function locked(task: (attempts: Attempt[], now: number) => Promise<void>) {
  try {
    if (!collectionAllowed('progressEnabled') || !navigator.locks) return
    await navigator.locks.request(PROGRESS_LOCK, { ifAvailable: true }, async lock => {
      if (!lock || !collectionAllowed('progressEnabled')) return
      const now = Date.now(), attempts = read(now)
      save(attempts)
      await task(attempts, now)
    })
  } catch { /* No progress measurement when browser storage/locking is unavailable. */ }
}
export function pruneProgress() {
  try {
    if (!demandPreference().allowed) localStorage.removeItem(PROGRESS_KEY)
    else if (navigator.locks) void navigator.locks.request(PROGRESS_LOCK, async () => {
      if (!demandPreference().allowed) localStorage.removeItem(PROGRESS_KEY)
      else save(read(Date.now()))
    }).catch(() => undefined)
  } catch { /* Optional local metadata must not block the application. */ }
}
export function startProgress(collectionId: string, handoff: CollectionHandoff) {
  return locked(async (attempts, now) => {
    const choice = localStorage.getItem(PREFERENCE_KEY), age = now - Date.parse(handoff.createdAt)
    if (!handoff.targets.length || attempts.some(a => a.id === handoff.id) || attempts.length >= 20 || !Number.isFinite(age) || age < 0 || age >= 30 * DAY_MS) return
    const attempt: Attempt = { choice: choice!, id: handoff.id, collectionId, started: now, targets: handoff.targets.map(({ rowId, revision }) => ({ rowId, revision })), startRecorded: false, importAttempted: false, importRecorded: false, printAttempted: false }
    attempts.push(attempt)
    save(attempts) // Mark before sending. A lost receipt never causes a resend.
    const recorded = await recordProgress(payload(attempt, 'started', now), attempt.choice)
    if (!demandPreference().allowed || localStorage.getItem(PREFERENCE_KEY) !== choice) return
    attempt.startRecorded = recorded
    save(attempts)
  })
}
export function importProgress(before: Collection, after: Collection, incoming: ImportCandidate) {
  if (incoming.receipt.origin !== 'local') return Promise.resolve()
  return locked(async (attempts, now) => {
    const choice = localStorage.getItem(PREFERENCE_KEY)
    const attempt = attempts.find(a => a.id === before.handoff?.id && a.collectionId === before.id)
    if (!attempt?.startRecorded || attempt.importAttempted) return
    const eligible = new Set(incoming.designs.map(d => d.id))
    const matching = planImport(before, incoming).entries
    for (const target of attempt.targets) {
      const old = before.rows.find(r => r.id === target.rowId), current = after.rows.find(r => r.id === target.rowId)
      const exact = matching.some(entry => entry.designId === current?.designId && entry.matchRowIds.length === 1 && entry.matchRowIds[0] === target.rowId)
      if (exact && old?.revision === target.revision && current?.designId && eligible.has(current.designId) && !current.createRequested && (old.designId !== current.designId || old.createRequested) && old.maker === current.maker && old.blend === current.blend) {
        target.designId = current.designId
        target.appliedRevision = current.revision
      }
    }
    // All requested rows must currently hold the matched, locally imported artwork.
    const complete = attempt.targets.every(t => t.designId && after.rows.some(r => r.id === t.rowId && r.designId === t.designId && r.revision === t.appliedRevision && !r.createRequested))
    if (!complete) { save(attempts); return }
    attempt.importAttempted = true
    save(attempts)
    const recorded = await recordProgress(payload(attempt, 'imported', now), attempt.choice)
    if (!demandPreference().allowed || localStorage.getItem(PREFERENCE_KEY) !== choice) return
    attempt.importRecorded = recorded
    save(attempts)
  })
}
export function printProgress(collection: Collection, printedRowIds: string[]) {
  return locked(async (attempts, now) => {
    const attempt = attempts.find(a => a.id === collection.handoff?.id && a.collectionId === collection.id)
    if (!attempt?.importRecorded || attempt.printAttempted || !attempt.targets.every(t => printedRowIds.includes(t.rowId) && collection.rows.some(r => r.id === t.rowId && r.designId === t.designId && r.revision === t.appliedRevision && !r.createRequested))) return
    attempt.printAttempted = true
    save(attempts)
    await recordProgress(payload(attempt, 'print-requested', now), attempt.choice)
  })
}
