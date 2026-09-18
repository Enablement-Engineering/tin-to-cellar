import { isOptionalModuleFailure } from './optional-module-failures'

export type RecoveryPhase = 'idle' | 'checking' | 'offline' | 'current' | 'update' | 'unknown' | 'reloading'
export type RecoveryState = { phase: RecoveryPhase; blocked: string | null; attempted: boolean }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>
type Options = {
  buildId: string
  version: () => Promise<string>
  storage: () => Storage
  reload: () => void
  href: () => string
  online: () => boolean
  visible: () => boolean
  blocked?: () => string | null
  now?: () => number
}
const ATTEMPT_KEY = 'tin-to-cellar:app-recovery-attempt'
export const RECOVERY_FOCUS_KEY = 'tin-to-cellar:app-recovery-focus'
const WINDOW_MS = 10 * 60 * 1000

export function isModuleLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (?:CSS )?chunk [\w-]+ failed/i.test(message)
}

export async function fetchAppBuild(): Promise<string> {
  const response = await fetch('/app-version.json', { cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(5000) })
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('Build unavailable')
  // Read incrementally so an accidental HTML/large response cannot consume unbounded memory.
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Build unavailable')
  let body = ''
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      body += decoder.decode(value, { stream: true })
      if (body.length > 512) throw new Error('Invalid build marker')
    }
    body += decoder.decode()
  } finally { await reader.cancel().catch(() => undefined) }
  const value: unknown = JSON.parse(body)
  if (!value || typeof value !== 'object' || Object.keys(value).join() !== 'buildId' || !('buildId' in value) || typeof value.buildId !== 'string' || !/^[A-Za-z0-9._-]{1,160}$/.test(value.buildId)) throw new Error('Invalid build marker')
  return value.buildId
}

/** One controller per document; no protocol upgrades or action replay. */
export class AppRecovery {
  private state: RecoveryState = { phase: 'idle', blocked: null, attempted: false }
  private listeners = new Set<() => void>()
  private blockers = new Map<symbol, string>()
  private owners = new Set<symbol>()
  private pending: Promise<void> | null = null
  private failureHref = ''
  private target = ''
  private sequence = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private options: Options
  constructor(options: Options) { this.options = options }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  reconsider = () => { this.emit(); this.schedule() }
  private emit(patch: Partial<RecoveryState> = {}) {
    this.state = { ...this.state, ...patch, blocked: this.blockers.values().next().value ?? this.options.blocked?.() ?? (this.owners.size ? null : 'Finish your work before reloading this page.') }
    this.listeners.forEach(listener => listener())
  }
  guard(id: symbol, reason: string | null, owner = false) {
    if (owner) this.owners.add(id)
    if (reason) this.blockers.set(id, reason); else this.blockers.delete(id)
    this.emit()
    this.schedule()
    return () => { this.blockers.delete(id); this.owners.delete(id); this.emit(); this.schedule() }
  }
  report(error: unknown) {
    if (!isModuleLoadFailure(error)) return false
    if (this.state.phase !== 'idle') return true
    this.failureHref = this.options.href()
    void this.check()
    return true
  }
  dismiss = () => {
    this.sequence++
    this.pending = null
    clearTimeout(this.timer)
    this.failureHref = ''
    this.target = ''
    this.emit({ phase: 'idle', attempted: false })
  }
  check = (): Promise<void> => {
    if (this.pending) return this.pending
    if (!this.options.online()) { this.emit({ phase: 'offline' }); return Promise.resolve() }
    const sequence = ++this.sequence
    this.emit({ phase: 'checking' })
    this.pending = this.options.version().then(build => {
      if (sequence !== this.sequence) return
      this.target = build
      this.emit({ phase: build === this.options.buildId ? 'current' : 'update' })
      this.schedule()
    }).catch(() => { if (sequence === this.sequence) this.emit({ phase: this.options.online() ? 'unknown' : 'offline' }) }).finally(() => { if (sequence === this.sequence) this.pending = null })
    return this.pending
  }
  private schedule() {
    clearTimeout(this.timer)
    // Let component activity guards settle before rechecking, never use a captured safety value.
    if (this.state.phase === 'update') this.timer = setTimeout(() => this.refresh(true), 100)
  }
  refresh = (automatic = false): boolean => {
    if (!this.owners.size || this.blockers.size || this.options.blocked?.() || !this.options.visible() || !this.options.online() || this.state.phase === 'reloading') { this.emit(); return false }
    if (automatic && (this.state.phase !== 'update' || this.failureHref !== this.options.href())) return false
    try {
      const storage = this.options.storage()
      const now = (this.options.now ?? Date.now)()
      const previous = storage.getItem(ATTEMPT_KEY)
      if (automatic && previous) {
        const attempt = JSON.parse(previous) as { at?: unknown }
        if (typeof attempt.at !== 'number' || now - attempt.at < WINDOW_MS) { this.emit({ attempted: true }); return false }
      }
      storage.setItem(ATTEMPT_KEY, JSON.stringify({ at: now, from: this.options.buildId, to: this.target }))
      storage.setItem(RECOVERY_FOCUS_KEY, '1')
    } catch {
      if (automatic) { this.emit({ attempted: true }); return false }
    }
    this.emit({ phase: 'reloading' })
    this.options.reload()
    return true
  }
}

declare const __APP_BUILD_ID__: string
export const appRecovery = new AppRecovery({
  buildId: typeof __APP_BUILD_ID__ === 'undefined' ? 'development' : __APP_BUILD_ID__,
  version: fetchAppBuild,
  storage: () => sessionStorage,
  reload: () => window.location.reload(),
  href: () => window.location.href,
  online: () => navigator.onLine,
  visible: () => document.visibilityState !== 'hidden',
  blocked: () => document.querySelector('dialog[open]') ? 'Close the open dialog before updating the app.' : document.body.dataset.printMode ? 'Finish printing before updating the app.' : null,
})

export function installAppRecovery() {
  const printGuard = Symbol('printing')
  window.addEventListener('vite:preloadError', event => {
    // Vite emits before rejecting the import. Let its caller classify the failure
    // before deciding whether essential app code needs recovery. Keep the rejection.
    const error = (event as Event & { payload: unknown }).payload
    setTimeout(() => { if (!isOptionalModuleFailure(error)) appRecovery.report(error) }, 0)
  })
  window.addEventListener('beforeprint', () => appRecovery.guard(printGuard, 'Close the print dialog before updating the app.'))
  window.addEventListener('afterprint', () => appRecovery.guard(printGuard, null))
  window.addEventListener('close', appRecovery.reconsider, true)
  document.addEventListener('visibilitychange', appRecovery.reconsider)
}
