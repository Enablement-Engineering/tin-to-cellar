import { useMemo, useState } from 'react'
import { parseDiagnosticReport, summarizeReports, reportRevisionLabel, type DiagnosticReport } from '../lib/feedback'

export function DiagnosticFeedback({ candidate, protocolContext }: { candidate: unknown; protocolContext?: { status: string; revision?: number } }) {
  const report = useMemo(() => parseDiagnosticReport(candidate), [candidate])
  const [saved, setSaved] = useState<DiagnosticReport[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const reports = useMemo(() => {
    const unique = new Map<string, DiagnosticReport>()
    for (const item of [...(report && protocolContext?.status !== 'conflict' && protocolContext?.status !== 'invalid' ? [report] : []), ...saved]) unique.set(JSON.stringify(item), item)
    return [...unique.values()]
  }, [report, saved, protocolContext?.status])
  const totals = summarizeReports(reports)
  const download = (value: unknown, filename: string) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const readFiles = async (files: File[]) => {
    setBusy(true)
    const accepted: DiagnosticReport[] = []
    let rejected = Math.max(0, files.length - 100)
    for (const file of files.slice(0, 100)) {
      try {
        if (file.size > 32_768) throw new Error('Too large')
        const parsed = parseDiagnosticReport(JSON.parse(await file.text()))
        if (!parsed) throw new Error('Invalid report')
        accepted.push(parsed)
      } catch { rejected++ }
    }
    setSaved(accepted)
    setMessage(`${accepted.length} reports loaded. ${rejected} rejected. Selecting files replaces the previously loaded reports.`)
    setBusy(false)
  }
  return <section className="panel screen-only" aria-labelledby="feedback-title">
    <details>
      <summary id="feedback-title">Prompt feedback</summary>
      <p>Review the agent’s account of the request, steps and issues. Only fixed categories and counts are accepted. Reports stay in this browser until you download and share them yourself.</p>
      {protocolContext?.status === 'conflict' && <p role="status">The pack and feedback name different protocol revisions. Attribution is inconsistent; clarify the original revision before repairing or comparing this run. Your labels can still be used.</p>}
      {protocolContext?.status === 'invalid' && <p role="status">The pack’s protocol attribution is malformed. Use the original conversation’s instructions for repairs. Your labels can still be used.</p>}
      {protocolContext?.status === 'unknown' && <p role="status">The pack reports an unrecognized protocol revision. Keep its original instructions for repairs. Your labels can still be used.</p>}
      {candidate != null && !report && <p role="status">The pack’s feedback did not match the private diagnostic format and was excluded. Your labels can still be used.</p>}
      {!report && <p>No valid feedback report in this pack. You can also open the separate JSON report from a failed attempt.</p>}
      {report && <><p>Agent-reported outcome: {report.outcome}. {reportRevisionLabel(report)}. This is not an independent check.</p><details><summary>Review report</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(report, null, 2)}</pre></details><button className="button secondary" type="button" onClick={() => download(report, 'tin-to-cellar-feedback.json')}>Download feedback</button></>}
      <p><label>Open saved feedback reports <input aria-label="Open saved feedback reports" type="file" accept=".json,application/json" multiple disabled={busy} onChange={(event) => { void readFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} /></label></p>
      <p role="status">{message}</p>
      {reports.length > 0 && <>
        <p>{totals.reports} distinct reports. Identical reports count once; separate runs can have identical diagnostics. These counts describe only the files loaded here.</p>
        {protocolContext?.status === 'conflict' && <p>The current pack’s report is excluded from comparisons because its protocol attribution is inconsistent.</p>}
        {totals.byRevision.map((group) => <section key={group.revisionLabel} aria-label={group.revisionLabel}><h3>{group.revisionLabel}</h3><p>{group.reports} reports</p><ul>{Object.entries(group.outcomes).map(([outcome, count]) => <li key={outcome}>{outcome}: {count}</li>)}</ul><ul>{Object.entries(group.issues).map(([code, count]) => <li key={code}>{code}: {count} reports</li>)}</ul></section>)}
        <details><summary>Review all reports</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(reports, null, 2)}</pre></details>
        <button className="button secondary" type="button" onClick={() => download({ format: 'tin-to-cellar/feedback-summary', totals, reports }, 'tin-to-cellar-feedback-summary.json')}>Download feedback summary</button>
      </>}
    </details>
  </section>
}
