import { boundedJson, BodyReadError } from './http'
import { admitDiagnostics } from './diagnostic-budget'
import type { ContributionBinding } from './contributions'
import type { Contribution } from '../src/lib/contributions'
import { parseRetrospective } from '../src/lib/feedback/retrospective'

export interface Statement {
  bind(...values: unknown[]): Statement
  run(): Promise<{ meta: { changes: number } }>
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
}
export interface DiagnosticsDatabase { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown[]> }
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
export async function diagnosticCapabilityHash(request: Request): Promise<string | null> {
  const capability = request.headers.get('X-Diagnostic-Capability')
  if (!capability || !/^[a-f0-9]{64}$/.test(capability)) return null
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(capability))), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function diagnosticRecord(db: DiagnosticsDatabase, id: string) {
  return db.prepare('SELECT origin, feedback, validation, capability_hash FROM diagnostic_reports WHERE id = ?').bind(id).first<{ origin: string; feedback: string | null; validation: string | null; capability_hash: string | null }>()
}
const days = (date: Date, count: number) => new Date(date.getTime() + count * 86400000).toISOString()
export function diagnosticInsert(db: DiagnosticsDatabase, contribution: Pick<Contribution, 'submissionId' | 'origin' | 'validation'> & { feedback: unknown }, receipt = new Date(), legacy = false, capabilityHash: string | null = null) {
  const expiry = legacy ? days(receipt, 90) : (() => { const end = new Date(receipt); end.setUTCFullYear(end.getUTCFullYear() + 1); return end.toISOString() })()
  return db.prepare('INSERT OR IGNORE INTO diagnostic_reports (id, received_at, expires_at, origin, feedback, validation, capability_hash) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(contribution.submissionId, receipt.toISOString(), expiry, legacy ? 'legacy' : contribution.origin ?? 'pack', contribution.feedback ? JSON.stringify(contribution.feedback) : null, contribution.validation ? JSON.stringify(contribution.validation) : null, capabilityHash)
}
export async function storeDiagnostics(db: DiagnosticsDatabase, contribution: Contribution, receipt = new Date(), legacy = false, capabilityHash: string | null = null) {
  const result = await diagnosticInsert(db, contribution, receipt, legacy, capabilityHash).run()
  return result.meta.changes ? 'collected' : 'duplicate'
}
export async function cleanDiagnostics(db: DiagnosticsDatabase, now = new Date()) {
  // Explicit child cleanup also works with adapters that do not enable FK cascades.
  await db.batch([
    db.prepare('DELETE FROM diagnostic_notes WHERE expires_at <= ? OR report_id IN (SELECT id FROM diagnostic_reports WHERE expires_at <= ?)').bind(now.toISOString(), now.toISOString()),
    db.prepare('DELETE FROM diagnostic_reports WHERE expires_at <= ?').bind(now.toISOString()),
  ])
}
export async function diagnosticsExport(request: Request, db: DiagnosticsDatabase, token?: string) {
  if (!token || request.headers.get('Authorization') !== `Bearer ${token}`) return new Response(null, { status: 403, headers })
  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor') ?? ''
  // IDs are fixed SHA-256 strings. A snapshot cutoff keeps pagination stable across new writes.
  const until = url.searchParams.get('until') ?? new Date().toISOString()
  const since = url.searchParams.get('since') ?? '1970-01-01T00:00:00.000Z'
  if ((cursor && !/^[a-f0-9]{64}$/.test(cursor)) || !Number.isFinite(Date.parse(until)) || !Number.isFinite(Date.parse(since))) return new Response(null, { status: 400, headers })
  const now = new Date().toISOString()
  const result = await db.prepare(`SELECT r.id, r.received_at AS receivedAt, r.expires_at AS expiresAt, r.origin, r.feedback, r.validation,
    n.body AS retrospective, n.expires_at AS notesExpiresAt FROM diagnostic_reports r LEFT JOIN diagnostic_notes n ON n.report_id = r.id AND n.expires_at > ? AND n.received_at <= ?
    WHERE r.expires_at > ? AND r.received_at >= ? AND r.received_at <= ? AND r.id > ? ORDER BY r.id LIMIT 201`)
    .bind(now, new Date(until).toISOString(), now, new Date(since).toISOString(), new Date(until).toISOString(), cursor).all<Record<string, unknown>>()
  const page = result.results.slice(0, 200)
  return Response.json({ version: 1, until, reports: page.map(row => ({ ...row, feedback: row.feedback ? JSON.parse(String(row.feedback)) : null, validation: row.validation ? JSON.parse(String(row.validation)) : null, retrospective: row.retrospective ? JSON.parse(String(row.retrospective)) : null })), nextCursor: result.results.length > 200 ? page.at(-1)!.id : null }, { headers })
}
export async function shareNotes(request: Request, db?: DiagnosticsDatabase, limiter?: { limit(options: { key: string }): Promise<{ success: boolean }> }, binding?: ContributionBinding) {
  if (!db) return Response.json({ error: 'Diagnostics storage is unavailable' }, { status: 503, headers })
  if (request.method !== 'POST') return new Response(null, { status: 405, headers })
  if (request.headers.get('Origin') !== new URL(request.url).origin) return new Response(null, { status: 403, headers })
  if (request.headers.get('Content-Type') !== 'application/json') return new Response(null, { status: 415, headers })
  if (!limiter || !(await limiter.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'unknown' })).success) return new Response(null, { status: 429, headers })
  try {
    const body = await boundedJson(request, { maxBytes: 16384 })
    if (!body || typeof body !== 'object' || Object.keys(body).sort().join() !== 'retrospective,submissionId') return new Response(null, { status: 400, headers })
    const { retrospective, submissionId } = body as Record<string, unknown>
    const notes = parseRetrospective(retrospective)
    if (!notes || typeof submissionId !== 'string' || !/^[a-f0-9]{64}$/.test(submissionId)) return new Response(null, { status: 400, headers })
    const capabilityHash = await diagnosticCapabilityHash(request)
    if (!capabilityHash) return Response.json({ error: 'This tab does not have permission to attach notes', code: 'notes_unauthorized' }, { status: 403, headers })
    const now = new Date()
    const parent = await db.prepare('SELECT feedback, capability_hash FROM diagnostic_reports WHERE id = ? AND expires_at > ?').bind(submissionId, now.toISOString()).first<{ feedback: string | null; capability_hash: string | null }>()
    if (!parent) return Response.json({ error: 'Import or submit the report first' }, { status: 409, headers })
    if (parent.capability_hash !== capabilityHash) return Response.json({ error: 'This tab does not have permission to attach notes', code: 'notes_unauthorized' }, { status: 403, headers })
    if (!parent.feedback || JSON.parse(parent.feedback).protocolRevision !== notes.protocolRevision) return Response.json({ error: 'Instructions do not match' }, { status: 409, headers })
    const existing = await db.prepare('SELECT body FROM diagnostic_notes WHERE report_id = ?').bind(submissionId).first<{ body: string }>()
    if (existing) return existing.body === JSON.stringify(notes) ? Response.json({ status: 'duplicate' }, { headers }) : Response.json({ error: 'Different notes were already shared for this report' }, { status: 409, headers })
    const paused = await admitDiagnostics(binding, `notes:${submissionId}`)
    if (paused) return paused
    const writeTime = new Date()
    // Admission crosses a network boundary. Recheck ownership, expiry, and the
    // report contents in the INSERT itself in case cleanup/reimport replaced it.
    const result = await db.prepare(`INSERT OR IGNORE INTO diagnostic_notes (report_id, received_at, expires_at, body)
      SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM diagnostic_reports WHERE id = ? AND capability_hash = ? AND expires_at > ? AND feedback = ?)`)
      .bind(submissionId, writeTime.toISOString(), days(writeTime, 90), JSON.stringify(notes), submissionId, capabilityHash, writeTime.toISOString(), parent.feedback).run()
    if (!result.meta.changes) {
      const current = await db.prepare('SELECT feedback, capability_hash FROM diagnostic_reports WHERE id = ? AND expires_at > ?').bind(submissionId, new Date().toISOString()).first<{ feedback: string | null; capability_hash: string | null }>()
      if (!current) return Response.json({ error: 'Import or submit the report first' }, { status: 409, headers })
      if (current.capability_hash !== capabilityHash) return Response.json({ error: 'This tab does not have permission to attach notes', code: 'notes_unauthorized' }, { status: 403, headers })
      if (current.feedback !== parent.feedback) return Response.json({ error: 'Instructions do not match' }, { status: 409, headers })
      const existing = await db.prepare('SELECT body FROM diagnostic_notes WHERE report_id = ?').bind(submissionId).first<{ body: string }>()
      if (existing?.body !== JSON.stringify(notes)) return Response.json({ error: 'Different notes were already shared for this report' }, { status: 409, headers })
    }
    return Response.json({ status: result.meta.changes ? 'collected' : 'duplicate' }, { headers })
  } catch (error) {
    if (error instanceof BodyReadError) return Response.json({ error: error.message }, { status: error.status, headers })
    return Response.json({ error: 'Notes could not be accepted' }, { status: 400, headers })
  }
}
