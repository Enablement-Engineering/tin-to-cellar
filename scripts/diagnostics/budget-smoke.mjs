// Local-only workerd/D1 smoke. Uses synthetic data and disposable state, never
// the project's deployment configuration, credentials, or remote resources.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const root = process.cwd(), port = 43929, base = `http://127.0.0.1:${port}`
const work = mkdtempSync(resolve(tmpdir(), 'tin-diagnostic-smoke-'))
const config = resolve(work, 'wrangler.json'), state = resolve(work, 'state')
const token = 'synthetic-local-budget-smoke-only'
const environment = { PATH: process.env.PATH, TMPDIR: work, WRANGLER_LOG_PATH: resolve(work, 'wrangler.log'),
  XDG_CONFIG_HOME: work, WRANGLER_SEND_METRICS: 'false', CI: 'true', NO_COLOR: '1' }
let child
let output = ''
const cfg = {
  name: 'tin-diagnostic-smoke', main: resolve(root, 'worker/index.ts'), compatibility_date: '2026-09-05',
  workers_dev: false, preview_urls: false,
  assets: { directory: resolve(work, 'assets'), binding: 'ASSETS', run_worker_first: true },
  d1_databases: [{ binding: 'DIAGNOSTICS', database_name: 'local-diagnostic-smoke', database_id: '00000000-0000-0000-0000-000000000002', migrations_dir: resolve(root, 'migrations') }],
  durable_objects: { bindings: [{ name: 'CATALOG_CONTRIBUTIONS', class_name: 'CatalogContributions' }] },
  migrations: [{ tag: 'local-smoke-v1', new_sqlite_classes: ['CatalogContributions'] }],
  ratelimits: [{ name: 'CONTRIBUTION_RATE_LIMITER', namespace_id: '9901', simple: { limit: 100, period: 60 } }],
  vars: { DIAGNOSTICS_READ_TOKEN: token, DIAGNOSTIC_COLLECTION_ENABLED: 'false', DIAGNOSTIC_DAILY_ALLOWANCE: '2' },
  observability: { enabled: false },
}
const authorization = { Authorization: `Bearer ${token}` }
async function stop() {
  if (!child) return
  const current = child; child = undefined
  if (!current.pid) return
  try { process.kill(-current.pid, 'SIGTERM') } catch (error) { if (error.code !== 'ESRCH') throw error }
  if (current.exitCode === null && current.signalCode === null) {
    await Promise.race([new Promise(resolveExit => current.once('exit', resolveExit)), delay(5000)])
    if (current.exitCode === null && current.signalCode === null) {
      try { process.kill(-current.pid, 'SIGKILL') } catch (error) { if (error.code !== 'ESRCH') throw error }
    }
  }
}
async function start(enabled) {
  await stop()
  cfg.vars.DIAGNOSTIC_COLLECTION_ENABLED = String(enabled)
  writeFileSync(config, JSON.stringify(cfg))
  output = ''
  child = spawn('npm', ['exec', '--', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--inspector-port', '0', '--config', config, '--persist-to', state], {
    cwd: root, env: environment, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { output = (output + data).slice(-12000) })
  child.on('error', error => { output += error.message })
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Local Wrangler exited: ${output}`)
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(500) })
      if (response.ok) return
    } catch { /* Wait for this process to bind the previously checked free port. */ }
    await delay(200)
  }
  throw new Error(`Local Wrangler did not start: ${output}`)
}
const post = (path, body) => fetch(base + path, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) })
const report = { version: 2, submissionId: 'a'.repeat(64), feedback: { format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '0.0.16', request: { labelCount: 1, shape: 'circle' }, outcome: 'complete', steps: [], issues: [] }, sources: [], origin: 'pack', validation: null }
const notes = { submissionId: report.submissionId, retrospective: { format: 'tin-to-cellar/retrospective', schemaVersion: '0.1.0', protocolRevision: '0.0.16', capabilities: { browsing: 'available' }, tools: [], observations: [{ stage: 'packaging', kind: 'helped', explanation: 'Synthetic local smoke test.' }] } }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void stop().finally(() => { rmSync(work, { recursive: true, force: true }); process.exit(1) }) })
try {
  await new Promise((resolveFree, reject) => {
    const probe = createServer(); probe.once('error', reject); probe.listen(port, '127.0.0.1', () => probe.close(resolveFree))
  })
  mkdirSync(resolve(work, 'assets')); writeFileSync(resolve(work, 'assets/index.html'), '<!doctype html><title>Local diagnostic smoke</title>')
  writeFileSync(config, JSON.stringify(cfg))
  execFileSync('npm', ['exec', '--', 'wrangler', 'd1', 'migrations', 'apply', 'DIAGNOSTICS', '--local', '--config', config, '--persist-to', state], { cwd: root, env: environment, stdio: 'pipe', timeout: 60000 })
  await start(false)
  let response = await post('/api/labels/contributions', report)
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'collection_paused')
  assert.equal((await fetch(`${base}/api/labels/diagnostics/budget`)).status, 403)
  let aggregate = await (await fetch(`${base}/api/labels/diagnostics/budget`, { headers: authorization })).json()
  assert.equal(aggregate.used, 0); assert.equal(aggregate.paused, true)
  await start(true)
  response = await post('/api/labels/contributions', report)
  assert.equal(response.status, 200); assert.equal((await response.json()).status, 'collected')
  response = await post('/api/labels/process-notes', notes)
  assert.equal(response.status, 200); assert.equal((await response.json()).status, 'collected')
  response = await post('/api/labels/contributions', { ...report, submissionId: 'b'.repeat(64) })
  assert.equal(response.status, 429); assert.ok(Number(response.headers.get('Retry-After')) > 0)
  const paused = await response.json(); assert.equal(paused.code, 'collection_paused'); assert.ok(Number.isFinite(Date.parse(paused.resetAt)))
  await start(true)
  aggregate = await (await fetch(`${base}/api/labels/diagnostics/budget`, { headers: authorization })).json()
  assert.equal(aggregate.used, 2); assert.equal(aggregate.limit, 2); assert.equal(aggregate.paused, true)
  assert.ok(aggregate.lastPausedAt)
  assert.deepEqual(Object.keys(aggregate).sort(), ['day', 'lastPausedAt', 'limit', 'paused', 'resetAt', 'used', 'version'])
  const exported = await (await fetch(`${base}/api/labels/diagnostics`, { headers: authorization })).json()
  assert.equal(exported.reports.length, 1); assert.equal(exported.reports[0].id, report.submissionId)
  assert.equal(exported.reports[0].retrospective.observations[0].explanation, 'Synthetic local smoke test.')
  console.log(JSON.stringify({ localOnly: true, manualPause: 503, resumed: true, report: 200, notes: 200, thirdSubmission: 429, unauthorizedBudget: 403, usedAfterRestart: aggregate.used, limit: aggregate.limit, persistedReports: exported.reports.length, passed: true }))
} finally {
  await stop()
  rmSync(work, { recursive: true, force: true })
}
