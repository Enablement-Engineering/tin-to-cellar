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
    setMessage(`${accepted.length} ${accepted.length === 1 ? 'report' : 'reports'} loaded. ${rejected} rejected. These files replace the reports you opened before.`)
    setBusy(false)
  }
  return <section className="panel screen-only" aria-labelledby="feedback-title">
    <details>
      <summary id="feedback-title">Prompt feedback</summary>
      <p>See what your AI reported about the request, the steps it took, and any problems. Reports use fixed categories and counts. Importing a label pack sends its valid feedback to help improve the instructions. Reports you open separately are kept in this browser.</p>
      {protocolContext?.status === 'conflict' && <p role="status">The pack and its feedback list different instruction versions. Check the original chat to find which version was used before asking for repairs or comparing reports. You can still print labels that passed the ZIP checks.</p>}
      {protocolContext?.status === 'invalid' && <p role="status">The app couldn’t read the pack’s instruction version. Use the instructions from the original chat when asking for repairs. You can still print labels that passed the ZIP checks.</p>}
      {protocolContext?.status === 'unknown' && <p role="status">The app doesn’t recognize the pack’s instruction version. Keep the original chat’s instructions for repairs. You can still print labels that passed the ZIP checks.</p>}
      {candidate != null && !report && <p role="status">The pack’s feedback could not be read in the expected format and was excluded. You can still print labels that passed the ZIP checks.</p>}
      {!report && <p>No readable feedback report in this pack. If your AI provided a separate JSON report after a failed attempt, you can open it below.</p>}
      {report && <><p>The AI reported: {report.outcome}. {reportRevisionLabel(report)}. The app has not independently verified this report.</p><details><summary>Review report</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(report, null, 2)}</pre></details><button className="button secondary" type="button" onClick={() => download(report, 'tin-to-cellar-feedback.json')}>Download feedback</button></>}
      <p><label>Open saved feedback reports <input aria-label="Open saved feedback reports" type="file" accept=".json,application/json" multiple disabled={busy} onChange={(event) => { void readFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} /></label></p>
      <p role="status">{message}</p>
      {reports.length > 0 && <>
        <p>{totals.reports} distinct {totals.reports === 1 ? 'report' : 'reports'}. Identical reports count once, even if they came from separate attempts. These totals cover only the reports open here.</p>
        {protocolContext?.status === 'conflict' && <p>The current pack’s report is left out of comparisons because its instruction version doesn’t match the pack.</p>}
        {totals.byRevision.map((group) => <section key={group.revisionLabel} aria-label={group.revisionLabel}><h3>{group.revisionLabel}</h3><p>{group.reports} {group.reports === 1 ? 'report' : 'reports'}</p><ul>{Object.entries(group.outcomes).map(([outcome, count]) => <li key={outcome}>{outcome}: {count}</li>)}</ul><ul>{Object.entries(group.issues).map(([code, count]) => <li key={code}>{code}: {count} {count === 1 ? 'report' : 'reports'}</li>)}</ul></section>)}
        <details><summary>Review all reports</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(reports, null, 2)}</pre></details>
        <button className="button secondary" type="button" onClick={() => download({ format: 'tin-to-cellar/feedback-summary', totals, reports }, 'tin-to-cellar-feedback-summary.json')}>Download feedback summary</button>
      </>}
    </details>
  </section>
}
