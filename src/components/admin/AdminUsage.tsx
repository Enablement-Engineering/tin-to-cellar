import { useEffect, useState } from 'react'
import type { UsageSummary, BlendUsage } from '../../lib/analytics/report-types'
import '../../styles/admin-usage.css'
async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`/api/analytics/v2/admin/${path}`, { cache: 'no-store', referrerPolicy: 'no-referrer', signal })
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Sign in again to view usage.' : 'Usage reports are unavailable. No counts have been substituted.')
  return response.json()
}
const names: Record<string, string> = { 'instructions-copy-result': 'Instruction copy attempts', 'pack-check-result': 'Local ZIP checks', 'pack-import-applied': 'Local pack saves', 'gallery-design-applied': 'Gallery design saves', 'print-preparation-result': 'Print preparation attempts', 'print-requested': 'Print requests', 'labels-download-requested': 'Label ZIP download requests', 'workflow-failed': 'Other workflow failures' }
export function AdminUsage() {
  const [days, setDays] = useState(30), [refresh, setRefresh] = useState(0)
  const [metric, setMetric] = useState('added'), [missing, setMissing] = useState(false), [cursor, setCursor] = useState(0)
  const key = `${days}:${metric}:${missing}:${cursor}:${refresh}`
  const [result, setResult] = useState<{ key: string; summary: UsageSummary | null; blends: BlendUsage | null; error: string } | null>(null)
  const loading = result?.key !== key
  const summary = !loading ? result!.summary : null, blends = !loading ? result!.blends : null, error = !loading ? result!.error : ''
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([read<UsageSummary>(`summary?days=${days}`, controller.signal), read<BlendUsage>(`blends?days=${days}&metric=${metric}&availability=${missing ? 'missing' : 'all'}&cursor=${cursor}`, controller.signal)])
      .then(([summary, blends]) => { if (!controller.signal.aborted) setResult({ key, summary, blends, error: '' }) })
      .catch(cause => { if (!controller.signal.aborted) setResult({ key, summary: null, blends: null, error: cause instanceof Error ? cause.message : 'Usage reports are unavailable.' }) })
    return () => controller.abort()
  }, [days, metric, missing, cursor, key])
  const cohorts = [...new Set(summary?.progress.map(row => row.cohort) ?? [])].sort().reverse()
  const count = (cohort: string, milestone: string) => summary!.progress.filter(r => r.cohort === cohort && r.milestone === milestone).reduce((n, r) => n + r.count, 0)
  const totals = summary?.events.reduce<Record<string, number>>((acc, row) => { const key = `${names[row.event] ?? row.event}: ${row.outcome}`; acc[key] = (acc[key] ?? 0) + row.count; return acc }, {}) ?? {}
  return <section className="usage-page" aria-busy={loading}>
    <h1>Usage</h1>
    <p>Received action counts and request progress. These are not unique people, confirmed abandonment, or successful physical prints.</p>
    <div className="usage-controls"><label>Reporting period <select value={days} onChange={e => { setDays(Number(e.target.value)); setCursor(0) }}>{[7,30,90,365].map(n => <option key={n} value={n}>Last {n} UTC days</option>)}</select></label><button className="button secondary" onClick={() => setRefresh(n => n + 1)}>Refresh</button></div>
    {loading && <p role="status">Loading usage…</p>}{error && <p role="alert">{error}</p>}
    {summary && <>
      <section className="panel"><h2>Collection status</h2>
        <p>{summary.from} through {summary.through} UTC. Today is partial. Refreshed {summary.refreshedAt}.</p>
        <ul><li>Label demand: {summary.capabilities.demandEnabled ? 'enabled' : 'off'}</li><li>App actions: {summary.capabilities.workflowEnabled ? 'enabled' : 'off'}</li><li>Local request progress: {summary.capabilities.progressEnabled ? 'enabled' : 'off'}</li><li>Daily shared admission allowance: {summary.allowance}</li></ul>
        <p>These settings describe now. Historical collection availability is unknown. Zero received events does not mean nobody used the app. Counts exclude people who did not opt in and deliveries that failed.</p>
        <p>Admission under the current daily allowance: {summary.admissionBlockedNow ? 'blocked for the rest of today unless the allowance changes' : 'capacity remains'}. Historical exhaustion below records the allowance observed when requests were admitted.</p>
        <p>Expiry cleanup: {summary.cleanup ? `${summary.cleanup.failed ? 'incomplete; expired records may await deletion' : 'last run completed'}. Last success: ${summary.cleanup.last_success ?? 'none recorded'}.` : 'No cleanup result recorded.'}</p>
        <details><summary>Admissions and successful recording</summary><div className="usage-table" tabIndex={0} role="region" aria-label="Scrollable usage table"><table><caption>UTC request admissions, including requests that later failed</caption><thead><tr><th>Date</th><th>Admitted</th><th>Recorded</th><th>Allowance reached</th></tr></thead><tbody>{summary.collection.map(r => <tr key={r.period_start}><th>{r.period_start}</th><td>{r.admitted}</td><td>{r.recorded}</td><td>{r.allowance_reached ? 'Yes; partial collection' : 'Not observed'}</td></tr>)}</tbody></table></div></details>
      </section>
      <section className="panel"><h2>Locally matched request progress</h2>
        <p>Whole starting weeks from {summary.cohortFrom} through {summary.through}. The first week can include starts before the daily activity period.</p>
        {summary.cohortBoundaryExpired && <p>The week crossing the retention cutoff has expired and is excluded from request progress.</p>}
        <p>Each start is a measured request whose instructions were copied. A matched import means all its requested rows received usable local artwork under that saved request. The match happens in the browser; request identifiers are not sent. It does not establish that the artwork came from that AI chat.</p>
        <p>Reports require confirmed recording of the preceding milestone. Clearing browser data, changed requests, other devices, unavailable browser locks, failed delivery, or disabling measurement can hide completion. Missing completion is “not observed,” not abandonment. Progress expires after 30 days; a starting week closes only after its last possible start has had 30 days.</p>
        {!cohorts.length ? <p>No request progress received for starting weeks in this period.</p> : <div className="usage-table" tabIndex={0} role="region" aria-label="Scrollable usage table"><table><caption>Requests by starting Monday in UTC; counts within 30 days of each start</caption><thead><tr><th>Starting week</th><th>Starts received</th><th>Matched imports received</th><th>Print requests received</th><th>Window</th></tr></thead><tbody>{cohorts.map(cohort => <tr key={cohort}><th>{cohort}</th><td>{count(cohort,'started')}</td><td>{count(cohort,'imported')}</td><td>{count(cohort,'print-requested')}</td><td>{Date.parse(summary.refreshedAt) - Date.parse(cohort) < 37 * 86400000 ? 'Still open' : 'Closed; missing outcomes remain unknown'}</td></tr>)}</tbody></table></div>}
        <details><summary>Elapsed-time buckets</summary><div className="usage-table" tabIndex={0} role="region" aria-label="Scrollable usage table"><table><caption>Time from copying instructions, measured on the device</caption><thead><tr><th>Starting week</th><th>Milestone</th><th>Elapsed</th><th>Count</th></tr></thead><tbody>{summary.progress.map(r => <tr key={`${r.cohort}:${r.milestone}:${r.elapsed}`}><th>{r.cohort}</th><td>{r.milestone}</td><td>{r.elapsed}</td><td>{r.count}</td></tr>)}</tbody></table></div></details>
      </section>
      <section className="panel"><h2>Activity and problems</h2><p>A local pack save can contain many labels; a gallery design save usually contains one. Do not compare them as source shares. Loading, empty, and needs-artwork are preparation states, not defects.</p>
        <p>Failures are counted by workflow stage only. This report does not distinguish storage capacity, storage availability, or conflict causes.</p>
        {!Object.keys(totals).length ? <p>0 received events in this period.</p> : <dl className="usage-totals">{Object.entries(totals).map(([label, n]) => <div key={label}><dt>{label}</dt><dd>{n}</dd></div>)}</dl>}
        <p>For reported instruction and tool problems, use the existing protected diagnostics review: <code>npm run diagnostics:fetch</code>, then <code>npm run diagnostics:analyze</code>. Its submitted-report counts have a separate denominator.</p>
        <details><summary>Daily activity table</summary><div className="usage-table" tabIndex={0} role="region" aria-label="Scrollable usage table"><table><caption>Received actions by UTC date</caption><thead><tr><th>Date</th><th>Action</th><th>Outcome</th><th>Count</th></tr></thead><tbody>{summary.events.map(r => <tr key={`${r.period_start}:${r.event}:${r.outcome}`}><th>{r.period_start}</th><td>{names[r.event] ?? r.event}</td><td>{r.outcome}</td><td>{r.count}</td></tr>)}</tbody></table></div></details>
      </section>
    </>}
    <section className="panel"><h2>Artwork demand</h2><div className="usage-controls"><label>Rank by <select value={metric} onChange={e => { setMetric(e.target.value); setCursor(0) }}>{['added','selected','jobs','quantity'].map(v => <option key={v}>{v}</option>)}</select></label><label><input type="checkbox" checked={missing} onChange={e => { setMissing(e.target.checked); setCursor(0) }} /> No currently published artwork</label></div>
      <p>Availability is current, not historical. Demand is not automatically unmet need. Job counts below cover recognized catalog blends and must not be added to overall print requests.</p>
      {blends && <><p>Public gallery serving is {blends.serving ? 'on' : 'off'}. Availability checked {blends.refreshedAt}.</p>{!blends.blends.length ? <p>No matching demand received.</p> : <div className="usage-table" tabIndex={0} role="region" aria-label="Scrollable usage table"><table><caption>Catalog blend participation and current artwork availability</caption><thead><tr><th>Blend</th><th>Adds</th><th>Selections</th><th>Jobs</th><th>Quantity</th><th>Published designs</th></tr></thead><tbody>{blends.blends.map(r => <tr key={r.catalog_id}><th>{r.maker} — {r.blend}</th><td>{r.added}</td><td>{r.selected}</td><td>{r.jobs}</td><td>{r.quantity}</td><td>{r.artwork}</td></tr>)}</tbody></table></div>}<div className="usage-controls">{cursor > 0 && <button className="button secondary" onClick={() => setCursor(Math.max(0,cursor-50))}>Previous blends</button>}{blends.hasMore && <button className="button secondary" onClick={() => setCursor(blends.nextCursor!)}>More blends</button>}</div></>}
    </section>
    <section className="panel"><h2>Website traffic</h2><p>Cloudflare Web Analytics is deferred. This release includes no traffic beacon. Traffic reports would be a separate, explicitly controlled measurement.</p></section>
  </section>
}
