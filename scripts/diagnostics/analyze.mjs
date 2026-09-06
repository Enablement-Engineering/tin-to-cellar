import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import Ajv from 'ajv'
import { parseRetrospective } from '../../src/lib/feedback/retrospective.ts'
import { parseWebsiteValidation } from '../../src/lib/contributions/validation.ts'
const ajv = new Ajv()
const validators = ['schema.json', 'legacy-schema.json'].map(name => ajv.compile(JSON.parse(readFileSync(new URL(`../../src/lib/feedback/${name}`, import.meta.url), 'utf8'))))
export function normalizeSnapshot(input, now = new Date()) {
  if (input?.version !== 1 || !Array.isArray(input.reports) || input.reports.length > 100000 || !Number.isFinite(Date.parse(input.until))) throw new Error('Invalid snapshot')
  const unique = new Map()
  for (const row of input.reports) {
    if (!row || !/^[a-f0-9]{64}$/.test(row.id) || !['pack', 'standalone', 'legacy'].includes(row.origin) || !Number.isFinite(Date.parse(row.receivedAt)) || !Number.isFinite(Date.parse(row.expiresAt))) throw new Error('Invalid report metadata')
    if (Date.parse(row.expiresAt) <= now.getTime() || Date.parse(row.receivedAt) > Date.parse(input.until)) continue
    if (row.feedback !== null && !validators.some(validate => validate(row.feedback))) throw new Error('Unsupported feedback schema')
    const validation = row.validation === null ? null : parseWebsiteValidation(row.validation)
    if (row.validation !== null && !validation) throw new Error('Invalid website results')
    let retrospective = null
    if (row.retrospective && Date.parse(row.notesExpiresAt) > now.getTime()) {
      retrospective = parseRetrospective(row.retrospective)
      if (!retrospective || retrospective.protocolRevision !== row.feedback?.protocolRevision) throw new Error('Invalid process notes')
    }
    const normalized = { id: row.id, receivedAt: row.receivedAt, expiresAt: row.expiresAt, origin: row.origin, feedback: row.feedback, validation, retrospective, notesExpiresAt: retrospective ? row.notesExpiresAt : null }
    if (unique.has(row.id) && JSON.stringify(unique.get(row.id)) !== JSON.stringify(normalized)) throw new Error('Conflicting duplicate report')
    unique.set(row.id, normalized)
  }
  return [...unique.values()].sort((a,b) => a.id.localeCompare(b.id))
}
const tally = values => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(v => v === value).length]))
function groupStats(rows) {
  const feedback = rows.filter(r => r.feedback)
  const issueCodes = [...new Set(feedback.flatMap(r => r.feedback.issues.map(i => i.code)))].sort()
  return {
    submittedReports: rows.length, aiReports: feedback.length, reportsWithNotes: rows.filter(r => r.retrospective).length,
    origins: tally(rows.map(r => r.origin)), outcomes: tally(feedback.map(r => r.feedback.outcome)),
    issues: Object.fromEntries(issueCodes.map(code => [code, {
      affectedReports: feedback.filter(r => r.feedback.issues.some(i => i.code === code)).length,
      unresolvedReports: feedback.filter(r => r.feedback.issues.some(i => i.code === code && !i.resolved)).length,
      resolvedReports: feedback.filter(r => r.feedback.issues.some(i => i.code === code && i.resolved)).length,
    }])),
    stages: Object.fromEntries([...new Set(feedback.flatMap(r => r.feedback.steps.map(s => s.stage)))].sort().map(stage => {
      const relevant = feedback.filter(r => r.feedback.steps.some(s => s.stage === stage))
      return [stage, { reportingRuns: relevant.length, failedOrUnavailableRuns: relevant.filter(r => r.feedback.steps.some(s => s.stage === stage && ['failed', 'unavailable'].includes(s.status))).length, attempts: relevant.reduce((sum, r) => sum + r.feedback.steps.filter(s => s.stage === stage).reduce((n,s) => n + s.attempts, 0), 0) }]
    })),
    websiteOutcomes: tally(rows.filter(r => r.validation).map(r => r.validation.outcome)),
    websiteIssues: tally(rows.flatMap(r => (r.validation?.issues ?? []).map(i => i.code))),
    observationKinds: tally(rows.flatMap(r => (r.retrospective?.observations ?? []).map(o => o.kind))),
  }
}
export function analyze(input, now = new Date()) {
  const rows = normalizeSnapshot(input, now)
  const until = new Date(input.until)
  const group = (sample, key) => Object.fromEntries([...new Set(sample.map(key))].sort().map(value => [value, groupStats(sample.filter(row => key(row) === value))]))
  const window = days => {
    const sample = rows.filter(r => Date.parse(r.receivedAt) >= until.getTime() - days * 86400000)
    return { ...groupStats(sample), byRevision: group(sample, r => r.feedback?.protocolRevision ?? r.feedback?.promptVersion ?? 'unknown'),
      byOrigin: group(sample, r => r.origin),
      byTool: group(sample, r => r.retrospective?.tools.length ? r.retrospective.tools.map(t => `${t.id}@${t.version}`).sort().join(',') : 'unknown'),
      byCapabilities: group(sample, r => r.retrospective ? Object.entries(r.retrospective.capabilities).sort().map(([k,v]) => `${k}=${v}`).join(',') || 'unknown' : 'unknown') }
  }
  return { version: 1, normalizationVersion: '0.1.0', snapshotId: createHash('sha256').update(JSON.stringify(rows)).digest('hex'), until: input.until,
    caveat: 'Submitted reports only, not unique users or production success rates. Notes are an optional sample. Before/after differences do not establish causality.',
    reportIds: rows.map(r => r.id), weekly: window(7), trailing28Days: window(28),
    months: group(rows, r => r.receivedAt.slice(0,7)),
    // Deliberately exclude narrative and URLs from the long-lived summary.
  }
}
export function markdown(summary) {
  const w = summary.weekly
  return `# Diagnostics review input\n\nSnapshot: ${summary.snapshotId}\nThrough: ${summary.until}\n\n${summary.caveat}\n\n${w.submittedReports} submitted reports this week; ${w.aiReports} include AI diagnostics; ${w.reportsWithNotes} include optional process notes.\n\n${w.submittedReports ? 'Review summary.json for revision, stage, capability, and tool comparisons. Raw process notes remain in the private snapshot only.' : 'No submitted reports in this window. This is not evidence that no runs failed.'}\n\nDocument at most three material findings, including what worked and should be preserved. Cite report IDs and denominators; mark causes as hypotheses.\n`
}
