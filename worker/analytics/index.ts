import { parsePrintIntent, PRINT_INTENT_LIMITS } from '../../src/lib/analytics/schema'
import type { GalleryDatabase, GalleryRateLimiter } from '../gallery/storage'
import { BodyReadError, boundedJson } from '../http'

export interface AnalyticsEnv {
  GALLERY?: GalleryDatabase
  ANALYTICS_ENABLED?: string
  ANALYTICS_DAILY_ALLOWANCE?: string
  ANALYTICS_RATE_LIMITER?: GalleryRateLimiter
}

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const response = (status: number) => new Response(null, { status, headers })
export const analyticsEnabled = (env: AnalyticsEnv): boolean => env.ANALYTICS_ENABLED === 'true' && !!env.GALLERY && !!env.ANALYTICS_RATE_LIMITER
export function analyticsDailyAllowance(env: AnalyticsEnv): number {
  if (env.ANALYTICS_DAILY_ALLOWANCE === undefined) return 1000
  const value = env.ANALYTICS_DAILY_ALLOWANCE
  // An invalid override fails closed. Raising the ceiling requires a code review.
  return /^\d{1,4}$/.test(value) && Number(value) <= 1000 ? Number(value) : 0
}

/** Strict global admission: failed downstream validation/writes do not refund it. */
export async function reservePrintIntent(db: GalleryDatabase, period: string, limit: number): Promise<boolean> {
  const admitted = await db.prepare(`INSERT INTO print_intent_admission(id,period_start,admissions)
    SELECT 1,?,1 WHERE ?>0
    ON CONFLICT(id) DO UPDATE SET period_start=excluded.period_start,
      admissions=CASE WHEN print_intent_admission.period_start<excluded.period_start THEN 1 ELSE print_intent_admission.admissions+1 END
    WHERE print_intent_admission.period_start<excluded.period_start
      OR (print_intent_admission.period_start=excluded.period_start AND print_intent_admission.admissions<?)
    RETURNING admissions`).bind(period, limit, limit).first<{ admissions: number }>()
  return !!admitted
}

/** Root routes only POST /api/analytics/v1/print-intent on the public host here. */
export async function analyticsResponse(request: Request, env: AnalyticsEnv, now = new Date()): Promise<Response> {
  if (!analyticsEnabled(env)) return response(204)
  if (request.method !== 'POST') return response(405)
  if (request.headers.get('Origin') !== new URL(request.url).origin || (request.headers.has('Sec-Fetch-Site') && request.headers.get('Sec-Fetch-Site') !== 'same-origin')) return response(403)
  if (request.headers.get('Content-Type') !== 'application/json') return response(415)
  const declared = request.headers.get('Content-Length')
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > PRINT_INTENT_LIMITS.bodyBytes)) return response(413)
  try {
    // Cloudflare's location-local approximate limiter is an abuse filter, not the global allowance.
    if (!(await env.ANALYTICS_RATE_LIMITER!.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })).success) return response(429)
    const payload = parsePrintIntent(await boundedJson(request, { maxBytes: PRINT_INTENT_LIMITS.bodyBytes }))
    if (!payload) return response(400)
    const period = now.toISOString().slice(0, 10)
    const db = env.GALLERY!.withSession?.('first-primary') ?? env.GALLERY!
    if (!await reservePrintIntent(db, period, analyticsDailyAllowance(env))) return response(429)
    // One bounded lookup resolves canonical IDs and aliases without trusting client names.
    const mapped = await db.prepare(`WITH incoming(id) AS (VALUES ${payload.labels.map(() => '(?)').join(',')})
      SELECT incoming.id AS requested,COALESCE(c.id,a.id) AS canonical
      FROM incoming LEFT JOIN gallery_tobaccos c ON c.id=incoming.id AND c.active=1
      LEFT JOIN gallery_catalog_aliases alias ON alias.alias_id=incoming.id
      LEFT JOIN gallery_tobaccos a ON a.id=alias.catalog_id AND a.active=1`)
      .bind(...payload.labels.map(label => label.catalogId)).all<{ requested: string; canonical: string | null }>()
    const canonical = new Map(mapped.results.map(row => [row.requested, row.canonical]))
    const ids = payload.labels.map(label => canonical.get(label.catalogId))
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) return response(400)
    const job = payload.event === 'print-job-requested'
    const statements = payload.labels.map((label, index) => db.prepare(`INSERT INTO print_intent_daily
      (catalog_id,period_start,added_count,selected_count,quantity_count,print_job_count) VALUES(?,?,?,?,?,?)
      ON CONFLICT(catalog_id,period_start) DO UPDATE SET
        added_count=added_count+excluded.added_count,selected_count=selected_count+excluded.selected_count,
        quantity_count=quantity_count+excluded.quantity_count,print_job_count=print_job_count+excluded.print_job_count`)
      .bind(ids[index], period, Number(payload.event === 'added-to-labels'), Number(payload.event === 'selected-for-print'), job ? label.quantity : 0, Number(job)))
    if (job) statements.push(db.prepare(`INSERT INTO print_intent_job_totals(period_start,print_job_count) VALUES(?,1)
      ON CONFLICT(period_start) DO UPDATE SET print_job_count=print_job_count+1`).bind(period))
    await db.batch(statements)
    return response(204)
  } catch (error) {
    // Never log request bodies, canonical demand or ordinary network information.
    return response(error instanceof BodyReadError ? error.status : 503)
  }
}
