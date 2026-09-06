import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { analyze, markdown, normalizeSnapshot } from './analyze.mjs'
const directory = resolve('output/diagnostics')
await mkdir(directory, { recursive: true, mode: 0o700 })
const command = process.argv[2] ?? 'fetch'
const save = async (name, value) => { const file = resolve(directory, name); await writeFile(file + '.tmp', value, { mode: 0o600 }); await rename(file + '.tmp', file) }
if (command === 'fetch') {
  const token = process.env.DIAGNOSTICS_READ_TOKEN
  if (!token) throw new Error('Set DIAGNOSTICS_READ_TOKEN in the local environment. Do not put it in prompts or source files.')
  const base = new URL(process.env.DIAGNOSTICS_BASE_URL ?? 'https://tintocellar.com')
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Use HTTPS for remote exports')
  let cursor = null
  let until = new Date().toISOString()
  const reports = []
  const visited = new Set()
  do {
    const url = new URL('/api/labels/diagnostics', base)
    url.searchParams.set('until', until)
    if (cursor) url.searchParams.set('cursor', cursor)
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`Export failed (${response.status}); review state was not advanced`)
    const page = await response.json()
    if (page.version !== 1 || !Array.isArray(page.reports) || page.until !== until || (page.nextCursor !== null && !/^[a-f0-9]{64}$/.test(page.nextCursor))) throw new Error('Invalid export page')
    reports.push(...page.reports)
    cursor = page.nextCursor
    if (cursor && visited.has(cursor)) throw new Error('Repeated export cursor')
    if (cursor) visited.add(cursor)
    if (reports.length > 100000) throw new Error('Snapshot limit reached; narrow the export before reviewing')
  } while (cursor)
  const snapshot = { version: 1, until, reports }
  snapshot.reports = normalizeSnapshot(snapshot)
  await save('snapshot.json', JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`Fetched ${snapshot.reports.length} private reports. No review cursor advanced.`)
} else if (command === 'analyze') {
  const snapshot = JSON.parse(await readFile(resolve(directory, 'snapshot.json'), 'utf8'))
  // Rewriting drops expired records/notes from the only local raw snapshot.
  snapshot.reports = normalizeSnapshot(snapshot)
  await save('snapshot.json', JSON.stringify(snapshot, null, 2) + '\n')
  const summary = analyze(snapshot)
  summary.sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  await save('summary.json', JSON.stringify(summary, null, 2) + '\n')
  await save('review.md', markdown(summary))
  let prior = { months: {} }
  try { prior = JSON.parse(await readFile(resolve(directory, 'monthly.json'), 'utf8')) } catch (error) { if (error.code !== 'ENOENT') throw error }
  // Preserve finalized months before raw expiry; never replace older totals with a partially retained month.
  const currentMonth = snapshot.until.slice(0,7)
  const date = new Date(snapshot.until)
  const previousMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)).toISOString().slice(0,7)
  for (const [month, stats] of Object.entries(summary.months)) if (!prior.months[month] || month === currentMonth || month === previousMonth) prior.months[month] = stats
  await save('monthly.json', JSON.stringify({ version: 1, months: prior.months }, null, 2) + '\n')
  console.log(`Analysis prepared: ${summary.weekly.submittedReports} reports this week. Review output/diagnostics/review.md.`)
} else if (command === 'complete') {
  const summary = JSON.parse(await readFile(resolve(directory, 'summary.json'), 'utf8'))
  const review = JSON.parse(await readFile(resolve(directory, 'review-result.json'), 'utf8'))
  if (review.snapshotId !== summary.snapshotId || !['no-material-change', 'findings'].includes(review.outcome) || !Array.isArray(review.findingIds) || review.findingIds.some(id => typeof id !== 'string' || !/^D-[0-9]{4}$/.test(id))) throw new Error('Complete a review-result.json matching this snapshot before advancing the review cursor')
  const register = JSON.parse(await readFile('docs/diagnostics/findings.json', 'utf8'))
  if (!Array.isArray(register.findings) || review.findingIds.some(id => !register.findings.some(f => f.id === id)) || (review.outcome === 'findings') !== (review.findingIds.length > 0)) throw new Error('Review outcome and findings register must agree')
  await save('cursor.json', JSON.stringify({ version: 1, until: summary.until, snapshotId: summary.snapshotId }, null, 2) + '\n')
  // Notes need not persist after a successful review. Structured aggregate files contain no raw prose.
  await rm(resolve(directory, 'snapshot.json'), { force: true })
  console.log('Review recorded and raw snapshot removed.')
} else throw new Error('Expected fetch, analyze, or complete')
