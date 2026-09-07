import type { ContributionBinding, Storage } from './contributions'

export interface DiagnosticBudgetConfig {
  DIAGNOSTIC_COLLECTION_ENABLED?: string
  DIAGNOSTIC_DAILY_ALLOWANCE?: string
}
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
function policy(config: DiagnosticBudgetConfig) {
  const enabled = config.DIAGNOSTIC_COLLECTION_ENABLED ?? 'true'
  const raw = config.DIAGNOSTIC_DAILY_ALLOWANCE ?? '1000'
  if (!['true', 'false'].includes(enabled) || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > 100000) return null
  return { enabled: enabled === 'true', limit: Number(raw) }
}
export function pausedResponse(resetAt?: string) {
  return Response.json({ code: 'collection_paused', error: resetAt ? 'Diagnostic sharing is paused for today.' : 'Diagnostic sharing is paused.', ...(resetAt ? { resetAt } : {}) }, {
    status: resetAt ? 429 : 503,
    headers: { ...headers, ...(resetAt ? { 'Retry-After': String(Math.max(1, Math.ceil((Date.parse(resetAt) - Date.now()) / 1000))) } : {}) },
  })
}
// One fixed-size counter, shared by reports and notes. Reservations are not refunded:
// retries and interrupted persistence also consume allowance, conservatively.
export async function budgetResponse(storage: Storage, config: DiagnosticBudgetConfig, admit: boolean) {
  const setting = policy(config)
  if (!setting) return Response.json({ code: 'collection_unconfigured', error: 'Diagnostic allowance is unavailable' }, { status: 503, headers })
  return storage.transaction(async transaction => {
    const now = new Date()
    const day = now.toISOString().slice(0, 10)
    const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()
    const saved = await transaction.get<{ day: string; used: number; lastPausedAt?: string }>('diagnostic-budget-v1')
    if (saved !== undefined && (!saved || typeof saved !== 'object' ||
      typeof saved.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(saved.day) ||
      !Number.isFinite(Date.parse(saved.day)) || new Date(saved.day).toISOString().slice(0, 10) !== saved.day || saved.day > day ||
      !Number.isSafeInteger(saved.used) || saved.used < 0 ||
      (saved.lastPausedAt !== undefined && (typeof saved.lastPausedAt !== 'string' || !Number.isFinite(Date.parse(saved.lastPausedAt)) || new Date(saved.lastPausedAt).toISOString() !== saved.lastPausedAt)))) throw new Error('Invalid diagnostic allowance state')
    let used = saved?.day === day ? saved.used : 0
    let lastPausedAt = saved?.lastPausedAt
    const paused = !setting.enabled || used >= setting.limit
    if (admit) {
      if (paused) return pausedResponse(setting.enabled ? resetAt : undefined)
      used++
      if (used >= setting.limit) lastPausedAt = now.toISOString()
      await transaction.put('diagnostic-budget-v1', { day, used, ...(lastPausedAt ? { lastPausedAt } : {}) })
    }
    return Response.json({ version: 1, day, lastPausedAt: lastPausedAt ?? null, used, limit: setting.limit, paused: !setting.enabled || used >= setting.limit, resetAt }, { headers })
  })
}
export async function admitDiagnostics(binding?: ContributionBinding): Promise<Response | null> {
  if (!binding) return Response.json({ code: 'collection_unconfigured', error: 'Diagnostic allowance is unavailable' }, { status: 503, headers })
  try {
    const result = await binding.getByName('catalog-contributions-v1').fetch(new Request('https://catalog/budget', { method: 'POST' }))
    return result.ok ? null : result
  } catch { return Response.json({ code: 'collection_unconfigured', error: 'Diagnostic allowance is unavailable' }, { status: 503, headers }) }
}
export async function budgetStatus(request: Request, binding?: ContributionBinding, token?: string) {
  if (!token || request.headers.get('Authorization') !== `Bearer ${token}`) return new Response(null, { status: 403, headers })
  if (request.method !== 'GET') return new Response(null, { status: 405, headers })
  if (!binding) return Response.json({ error: 'Diagnostic allowance is unavailable' }, { status: 503, headers })
  try { return await binding.getByName('catalog-contributions-v1').fetch(new Request('https://catalog/budget')) }
  catch { return Response.json({ error: 'Diagnostic allowance is unavailable' }, { status: 503, headers }) }
}
