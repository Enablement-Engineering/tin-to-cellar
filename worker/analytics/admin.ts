import { cohortWeek, DAY_MS, utcDay } from '../../src/lib/analytics/payloads'
import { analyticsDailyAllowance } from './index'
import { privateJson, usageCapabilities, type UsageEnv } from './usage'
/** The root dispatcher enforces exact admin host and human Access before this handler. */
export async function usageAdminResponse(request: Request, env: UsageEnv & { GALLERY_SERVING?: string }, now = new Date()) {
  if (request.method !== 'GET') return privateJson({ error: 'method_not_allowed' }, 405)
  if (!env.GALLERY || !env.ANALYTICS_RATE_LIMITER) return privateJson({ error: 'storage_unavailable' }, 503)
  if (!await env.ANALYTICS_RATE_LIMITER.limit({ key: `usage-admin:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}` }).then(r => r.success)) return privateJson({ error: 'rate_limited' }, 429)
  const url = new URL(request.url), days = Number(url.searchParams.get('days') ?? 30)
  if (![7, 30, 90, 365].includes(days)) return privateJson({ error: 'invalid_period' }, 400)
  const from = utcDay(new Date(now.getTime() - (days - 1) * DAY_MS)), through = utcDay(now)
  const cutoff = utcDay(new Date(now.getTime() - 364 * DAY_MS))
  const oldestWeek = cohortWeek(new Date(cutoff))
  const firstRetainedWeek = oldestWeek < cutoff ? utcDay(new Date(Date.parse(oldestWeek) + 7 * DAY_MS)) : oldestWeek
  const desiredWeek = cohortWeek(new Date(from))
  const cohortFrom = desiredWeek < firstRetainedWeek ? firstRetainedWeek : desiredWeek
  const cohortBoundaryExpired = cohortFrom !== desiredWeek, allowance = analyticsDailyAllowance(env)
  const db = env.GALLERY.withSession?.('first-primary') ?? env.GALLERY
  try {
    if (url.pathname.endsWith('/summary')) {
      if ([...url.searchParams.keys()].some(k => k !== 'days')) return privateJson({ error: 'invalid_query' }, 400)
      const [events, progress, collection, cleanup] = await Promise.all([
        db.prepare('SELECT * FROM usage_event_daily WHERE period_start BETWEEN ? AND ? ORDER BY period_start,event,outcome').bind(from, through).all(),
        db.prepare('SELECT * FROM usage_progress WHERE cohort BETWEEN ? AND ? ORDER BY cohort,milestone,elapsed').bind(cohortFrom, through).all(),
        db.prepare('SELECT * FROM usage_collection_daily WHERE period_start BETWEEN ? AND ? ORDER BY period_start').bind(from, through).all<{ period_start: string; admitted: number; recorded: number; allowance: number; allowance_reached: number }>(),
        db.prepare('SELECT last_attempt,last_success,failed FROM usage_cleanup WHERE id=1').first(),
      ])
      const today = collection.results.find(row => row.period_start === through)
      const admissionBlockedNow = allowance === 0 || Number(today?.admitted ?? 0) >= allowance
      return privateJson({ from, through, cohortFrom, cohortBoundaryExpired, admissionBlockedNow, refreshedAt: now.toISOString(), capabilities: usageCapabilities(env), allowance, events: events.results, progress: progress.results, collection: collection.results, cleanup })
    }
    if (url.pathname.endsWith('/blends')) {
      const metric = url.searchParams.get('metric') ?? 'added', availability = url.searchParams.get('availability') ?? 'all', raw = url.searchParams.get('cursor') ?? '0'
      if ([...url.searchParams.keys()].some(k => !['days','metric','availability','cursor'].includes(k)) || !['added','selected','jobs','quantity'].includes(metric) || !['all','missing'].includes(availability) || !/^\d{1,5}$/.test(raw) || Number(raw) > 10000) return privateJson({ error: 'invalid_query' }, 400)
      const results = await db.prepare(`WITH counts AS (SELECT catalog_id,SUM(added_count) added,SUM(selected_count) selected,SUM(print_job_count) jobs,SUM(quantity_count) quantity FROM print_intent_daily WHERE period_start BETWEEN ? AND ? GROUP BY catalog_id), artwork AS (SELECT catalog_id,COUNT(*) n FROM gallery_submissions WHERE state='published' GROUP BY catalog_id)
        SELECT c.*,t.maker,t.blend,COALESCE(a.n,0) artwork FROM counts c JOIN gallery_tobaccos t ON t.id=c.catalog_id LEFT JOIN artwork a ON a.catalog_id=c.catalog_id
        ${availability === 'missing' ? 'WHERE COALESCE(a.n,0)=0' : ''} ORDER BY ${metric} DESC,c.catalog_id LIMIT 51 OFFSET ?`).bind(from, through, Number(raw)).all()
      const settings = await db.prepare('SELECT serving FROM gallery_settings WHERE id=1').first<{ serving: number }>()
      return privateJson({ blends: results.results.slice(0, 50), hasMore: results.results.length > 50, nextCursor: results.results.length > 50 ? Number(raw) + 50 : null, refreshedAt: now.toISOString(), serving: env.GALLERY_SERVING === 'true' && settings?.serving === 1 })
    }
    return privateJson({ error: 'not_found' }, 404)
  } catch { return privateJson({ error: 'reports_unavailable' }, 503) }
}
