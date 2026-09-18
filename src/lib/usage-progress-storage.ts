import { demandPreference, PROGRESS_KEY, PREFERENCE_KEY, PROGRESS_LOCK } from './usage-preferences'

const DAY_MS = 86_400_000
type Target = { rowId: string; revision: number; designId?: string; appliedRevision?: number }
export type Attempt = { choice: string; id: string; collectionId: string; started: number; targets: Target[]; startRecorded: boolean; importAttempted: boolean; importRecorded: boolean; printAttempted: boolean }
/** IDs only live here on this origin. They are never included in network payloads. */
export function read(now: number): Attempt[] {
  const raw = localStorage.getItem(PROGRESS_KEY)
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || value.length > 20) throw new Error('Invalid local progress')
  const valid = value.filter((item): item is Attempt => !!item && typeof item === 'object' && typeof item.id === 'string' && typeof item.collectionId === 'string' && Number.isFinite(item.started) && item.started <= now && now - item.started < 30 * DAY_MS && Array.isArray(item.targets) && item.targets.length > 0 && item.targets.length <= 100 && item.targets.every((t: Target) => typeof t.rowId === 'string' && Number.isSafeInteger(t.revision) && (t.designId === undefined || typeof t.designId === 'string')) && ['startRecorded', 'importAttempted', 'importRecorded', 'printAttempted'].every(k => typeof item[k] === 'boolean'))
  return valid.filter(item => item.choice === localStorage.getItem(PREFERENCE_KEY) && item.targets.every(t => !t.designId || Number.isSafeInteger(t.appliedRevision)))
}
export function save(attempts: Attempt[]) {
  if (!demandPreference().allowed) return
  const choice = localStorage.getItem(PREFERENCE_KEY)
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(attempts.filter(a => a.choice === choice)))
}
export function pruneProgress() {
  try {
    if (!demandPreference().allowed) localStorage.removeItem(PROGRESS_KEY)
    else if (navigator.locks) void navigator.locks.request(PROGRESS_LOCK, async () => {
      if (!demandPreference().allowed) localStorage.removeItem(PROGRESS_KEY)
      else {
        try { save(read(Date.now())) }
        catch { localStorage.removeItem(PROGRESS_KEY) }
      }
    }).catch(() => undefined)
  } catch { /* Optional local metadata must not block the application. */ }
}
