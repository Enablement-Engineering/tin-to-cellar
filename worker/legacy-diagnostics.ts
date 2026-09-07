import { storedFeedback, type Contribution } from '../src/lib/contributions'
import type { Storage, ContributionBinding } from './contributions'
import { diagnosticInsert, type DiagnosticsDatabase, type Statement } from './diagnostics'

const retention = 90 * 86400000
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
type Stored = { receivedAt: string; contribution: Contribution }

// Preserve legacy receipts and expiry; interrupted copies can safely retry.
export async function migrateLegacyDiagnostics(storage: Storage, database?: DiagnosticsDatabase): Promise<Response> {
  if (!database) return Response.json({ error: 'Diagnostics storage unavailable' }, { status: 503, headers })
  if (await storage.get('diagnostics-migrated-v1')) return Response.json({ status: 'already-migrated' }, { headers })
  const records = await storage.list<Stored>({ prefix: 'report:', limit: 1000 })
  let copied = 0
  let batch: Statement[] = []
  for (const item of records.values()) {
    const date = new Date(item.receivedAt)
    if (date.getTime() <= Date.now() - retention) continue
    // Legacy source metadata is not copied to D1. Its catalog membership may
    // have changed since collection and must not block diagnostic migration.
    const stored = item.contribution
    if (!stored || typeof stored.submissionId !== 'string' || !/^[a-f0-9]{64}$/.test(stored.submissionId) || !Number.isFinite(date.getTime())) throw new Error('Invalid stored diagnostic identity')
    const feedback = stored.feedback === null ? null : storedFeedback(stored.feedback)
    if (stored.feedback !== null && !feedback) throw new Error('Invalid stored diagnostic feedback')
    const contribution = { submissionId: stored.submissionId, feedback }
    batch.push(diagnosticInsert(database, contribution, date, true))
    if (batch.length === 50) { await database.batch(batch); batch = [] }
    copied++
  }
  if (batch.length) await database.batch(batch)
  // Set the marker only after all writes succeed. INSERT OR IGNORE makes interruption retry safe.
  await storage.put('diagnostics-migrated-v1', true)
  return Response.json({ status: 'migrated', copied }, { headers })
}

export async function requestLegacyMigration(binding: ContributionBinding): Promise<Response> {
  return binding.getByName('catalog-contributions-v1').fetch(new Request('https://catalog/migrate', { method: 'POST' }))
}

export async function legacyMigrationResponse(request: Request, binding?: ContributionBinding, token?: string): Promise<Response> {
  if (!token || request.headers.get('Authorization') !== `Bearer ${token}`) return new Response(null, { status: 403, headers })
  if (request.method !== 'POST') return new Response(null, { status: 405, headers })
  if (!binding) return Response.json({ error: 'Migration storage is unavailable' }, { status: 503, headers })
  try { return await requestLegacyMigration(binding) }
  catch { return Response.json({ error: 'Diagnostics migration is incomplete' }, { status: 503, headers }) }
}
