import { mkdir, writeFile, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import Ajv from 'ajv'
import { readFileSync } from 'node:fs'
const token = process.env.CONTRIBUTION_ADMIN_TOKEN
if (!token) throw new Error('Set CONTRIBUTION_ADMIN_TOKEN in the local environment')
const base = new URL(process.env.DIAGNOSTICS_BASE_URL ?? 'https://tintocellar.com')
if (base.protocol !== 'https:') throw new Error('Backfill requires HTTPS')
const response = await fetch(new URL('/api/labels/contributions', base), { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(30000) })
if (!response.ok) throw new Error(`Legacy export failed (${response.status})`)
const { reports } = await response.json()
if (!Array.isArray(reports) || reports.length > 1000) throw new Error('Invalid legacy export')
const ajv = new Ajv()
const validators = ['schema.json','legacy-schema.json'].map(name => ajv.compile(JSON.parse(readFileSync(new URL(`../../src/lib/feedback/${name}`, import.meta.url), 'utf8'))))
const quote = value => "'" + value.replaceAll("'", "''") + "'"
const sql = []
for (const row of reports) {
  const c = row.contribution
  const date = new Date(row.receivedAt)
  if (!Number.isFinite(date.getTime()) || !/^[a-f0-9]{64}$/.test(c?.submissionId) || (c.feedback !== null && !validators.some(v => v(c.feedback)))) throw new Error('Invalid legacy record')
  const expires = new Date(date.getTime() + 90 * 86400000)
  if (expires <= new Date()) continue
  sql.push(`INSERT OR IGNORE INTO diagnostic_reports (id, received_at, expires_at, origin, feedback, validation) VALUES (${quote(c.submissionId)}, ${quote(date.toISOString())}, ${quote(expires.toISOString())}, 'legacy', ${c.feedback ? quote(JSON.stringify(c.feedback)) : 'NULL'}, NULL);`)
}
await mkdir('output/diagnostics', { recursive: true, mode: 0o700 })
const file = resolve('output/diagnostics/backfill.sql')
try {
  await writeFile(file, sql.join('\n'), { mode: 0o600 })
  if (sql.length) execFileSync('npm', ['exec', '--', 'wrangler', 'd1', 'execute', 'tin-to-cellar-diagnostics', '--remote', '--file', file], { stdio: 'inherit' })
  console.log(`Backfill attempted for ${sql.length} unexpired records; original 90-day expiry preserved. Verify database counts before rollout.`)
} finally { await rm(file, { force: true }) }
