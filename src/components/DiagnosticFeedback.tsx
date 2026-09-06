import { useMemo, useState } from 'react'
import { parseDiagnosticReport, summarizeReports, type DiagnosticReport } from '../lib/feedback'

export function DiagnosticFeedback({ candidate }: { candidate: unknown }) {
  const report = useMemo(() => parseDiagnosticReport(candidate), [candidate])
  const [saved, setSaved] = useState<DiagnosticReport[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const reports = useMemo(() => {
    const unique = new Map<string, DiagnosticReport>()
    for (const item of [...(report ? [report] : []), ...saved]) unique.set(JSON.stringify(item), item)
    return [...unique.values()]
  }, [report, saved])
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
      {candidate != null && !report && <p role="status">The pack’s feedback did not match the private diagnostic format and was excluded. Your labels can still be used.</p>}
      {!report && <p>No valid feedback report in this pack. You can also open the separate JSON report from a failed attempt.</p>}
      {report && <><p>Agent-reported outcome: {report.outcome}. This is not an independent check.</p><details><summary>Review report</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(report, null, 2)}</pre></details><button className="button secondary" type="button" onClick={() => download(report, 'tin-to-cellar-feedback.json')}>Download feedback</button></>}
      <p><label>Open saved feedback reports <input aria-label="Open saved feedback reports" type="file" accept=".json,application/json" multiple disabled={busy} onChange={(event) => { void readFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} /></label></p>
      <p role="status">{message}</p>
      {reports.length > 0 && <>
        <p>{totals.reports} distinct reports. Identical reports count once; separate runs can have identical diagnostics. These counts describe only the files loaded here.</p>
        <ul>{Object.entries(totals.outcomes).map(([outcome, count]) => <li key={outcome}>{outcome}: {count}</li>)}</ul>
        <ul>{Object.entries(totals.issues).map(([code, count]) => <li key={code}>{code}: {count} reports</li>)}</ul>
        <details><summary>Review all reports</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(reports, null, 2)}</pre></details>
        <button className="button secondary" type="button" onClick={() => download({ format: 'tin-to-cellar/feedback-summary', totals, reports }, 'tin-to-cellar-feedback-summary.json')}>Download feedback summary</button>
      </>}
    </details>
  </section>
}
