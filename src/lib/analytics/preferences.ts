export const PREFERENCE_KEY = 'tin-to-cellar:usage-choice-v2'
export const PROGRESS_KEY = 'tin-to-cellar:local-progress-v2'
export const PROGRESS_LOCK = 'tin-to-cellar:progress-v2'
const CHANGE = 'tin-to-cellar:usage-choice-change'
let storageFailed = false
/** Do not repeat the invitation after any saved choice, including an older refusal. */
export function shouldOfferUsageChoice(): boolean {
  try {
    const legacy = localStorage.getItem('tin-to-cellar:aggregate-demand')
    return !storageFailed && localStorage.getItem(PREFERENCE_KEY) === null && (legacy === null || legacy === 'on')
  } catch { storageFailed = true; return false }
}
export function demandPreference(): { allowed: boolean; storageFailed: boolean } {
  try { return { allowed: !storageFailed && /^on:[a-f0-9-]{36}$/.test(localStorage.getItem(PREFERENCE_KEY) ?? ''), storageFailed } }
  catch { storageFailed = true; return { allowed: false, storageFailed: true } }
}
export function setDemandPreference(allowed: boolean) {
  try {
    localStorage.setItem(PREFERENCE_KEY, `${allowed ? 'on' : 'off'}:${crypto.randomUUID()}`)
    if (!allowed) {
      localStorage.removeItem(PROGRESS_KEY)
      // Wait for another tab's in-flight writer, while consent is already off.
      if (navigator.locks) void navigator.locks.request(PROGRESS_LOCK, async () => {
        if (!demandPreference().allowed) localStorage.removeItem(PROGRESS_KEY)
        else {
          const raw = localStorage.getItem(PROGRESS_KEY)
          if (raw) {
            const attempts: unknown = JSON.parse(raw), choice = localStorage.getItem(PREFERENCE_KEY)
            if (!Array.isArray(attempts) || attempts.every(a => a?.choice !== choice)) localStorage.removeItem(PROGRESS_KEY)
          }
        }
      }).catch(() => undefined)
    }
  } catch { storageFailed = true }
  window.dispatchEvent(new Event(CHANGE))
  return demandPreference()
}
export function subscribeDemandPreference(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener(CHANGE, listener)
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(CHANGE, listener) }
}
