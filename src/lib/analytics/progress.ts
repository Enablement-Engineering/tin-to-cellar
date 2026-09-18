import type { Collection, CollectionHandoff, ImportCandidate } from '../collection/types'
import { planImport } from '../collection/import'
import { collectionAllowed, recordProgress } from './client'
import { demandPreference, PREFERENCE_KEY, PROGRESS_LOCK } from '../usage-preferences'
import { read, save, type Attempt } from '../usage-progress-storage'
import { cohortWeek, DAY_MS, elapsedBucket, type ProgressPayload } from './payloads'

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
