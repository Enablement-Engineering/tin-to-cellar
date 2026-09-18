import { parseUsage, parseProgress, DAY_MS, utcDay } from '../../src/lib/analytics/payloads'
import { boundedJson, BodyReadError } from '../http'
import { analyticsEnabled, analyticsDailyAllowance, reservePrintIntent, type AnalyticsEnv } from './index'
export interface UsageEnv extends AnalyticsEnv { WORKFLOW_ANALYTICS_ENABLED?: string; PROGRESS_ANALYTICS_ENABLED?: string }
export const usageCapabilities = (env: UsageEnv) => ({ version: 2, demandEnabled: analyticsEnabled(env), workflowEnabled: analyticsEnabled(env) && env.WORKFLOW_ANALYTICS_ENABLED === 'true', progressEnabled: analyticsEnabled(env) && env.PROGRESS_ANALYTICS_ENABLED === 'true', webTrafficEnabled: false })
export const privateJson = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
export async function usageResponse(request: Request, env: UsageEnv, now = new Date()) {
  const progress = new URL(request.url).pathname.endsWith('/progress')
  const capabilities = usageCapabilities(env)
  if (!(progress ? capabilities.progressEnabled : capabilities.workflowEnabled)) return privateJson({ recorded: false })
  if (request.method !== 'POST') return privateJson({ error: 'method_not_allowed' }, 405)
  if (request.headers.get('Origin') !== new URL(request.url).origin || (request.headers.has('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site') !== 'same-origin')) return privateJson({ error: 'forbidden' }, 403)
  if (request.headers.get('Content-Type') !== 'application/json') return privateJson({ error: 'unsupported_type' }, 415)
  if (Number(request.headers.get('Content-Length')) > 1024) return privateJson({ error: 'too_large' }, 413)
  try {
    if (!await env.ANALYTICS_RATE_LIMITER!.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' }).then(r => r.success)) return privateJson({ error: 'rate_limited' }, 429)
    const raw = await boundedJson(request, { maxBytes: 1024 })
    const event = progress ? null : parseUsage(raw), step = progress ? parseProgress(raw, now) : null
    if (!event && !step) return privateJson({ error: 'invalid_event' }, 400)
    const db = env.GALLERY!.withSession?.('first-primary') ?? env.GALLERY!, period = utcDay(now)
    if (!await reservePrintIntent(db, period, analyticsDailyAllowance(env))) return privateJson({ error: 'daily_allowance' }, 429)
    const statement = event
      ? db.prepare('INSERT INTO usage_event_daily(period_start,event,outcome,count) VALUES(?,?,?,1) ON CONFLICT(period_start,event,outcome) DO UPDATE SET count=count+1').bind(period, event.event, event.outcome)
      : db.prepare('INSERT INTO usage_progress(cohort,milestone,elapsed,count) VALUES(?,?,?,1) ON CONFLICT(cohort,milestone,elapsed) DO UPDATE SET count=count+1').bind(step!.cohort, step!.milestone, step!.elapsed)
    await db.batch([statement, db.prepare('UPDATE usage_collection_daily SET recorded=recorded+1 WHERE period_start=?').bind(period)])
    return privateJson({ recorded: true })
  } catch (error) { return privateJson({ error: 'collection_unavailable' }, error instanceof BodyReadError ? error.status : 503) }
}
export async function cleanUsage(env: UsageEnv, now = new Date()) {
  if (!env.GALLERY) return
  const db = env.GALLERY, cutoff = utcDay(new Date(now.getTime() - 364 * DAY_MS))
  await db.prepare('INSERT INTO usage_cleanup(id,last_attempt,failed) VALUES(1,?,1) ON CONFLICT(id) DO UPDATE SET last_attempt=excluded.last_attempt,failed=1').bind(now.toISOString()).run()
  try {
    for (const [table, date] of [['usage_event_daily', 'period_start'], ['usage_progress', 'cohort'], ['usage_collection_daily', 'period_start'], ['print_intent_daily', 'period_start'], ['print_intent_job_totals', 'period_start']]) {
      // Bounded work; an interrupted backlog remains visibly pending.
      await db.prepare(`DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${date}<? LIMIT 5000)`).bind(cutoff).run()
    }
    const checks = await Promise.all(['usage_event_daily', 'usage_collection_daily', 'print_intent_daily', 'print_intent_job_totals'].map(table => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE period_start<?`).bind(cutoff).first<{ n: number }>()))
    const progress = await db.prepare('SELECT COUNT(*) AS n FROM usage_progress WHERE cohort<?').bind(cutoff).first<{ n: number }>()
    if (checks.some(row => row?.n) || progress?.n) throw new Error('Usage expiry backlog')
    await db.prepare('UPDATE usage_cleanup SET last_success=?,failed=0 WHERE id=1').bind(now.toISOString()).run()
  } catch { throw new Error('Usage retention incomplete') }
}
