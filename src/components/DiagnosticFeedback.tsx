import { useMemo, useRef, useState } from 'react'
import { parseDiagnosticReport, summarizeReports, type DiagnosticReport } from '../lib/feedback'

const outcomeLabels: Record<DiagnosticReport['outcome'], string> = {
  complete: 'Completed', partial: 'Partly completed', failed: 'Failed', 'research-only': 'Research only',
}
const issueLabels: Record<string, string> = {
  'reference-unavailable': 'Reference image unavailable', 'variant-ambiguous': 'Unclear tobacco variant',
  'image-handoff-unavailable': 'Reference image could not reach the generator',
  'generation-unavailable': 'Image generator unavailable', 'generation-failed': 'Image generation failed',
  'artwork-fidelity': 'Artwork did not match the reference', 'text-legibility': 'Hard-to-read text',
  'write-area': 'Blank date area needed attention', geometry: 'Label dimensions needed attention',
  'proof-unavailable': 'Print proof unavailable', schema: 'Pack format needed attention',
  archive: 'ZIP needed attention', 'instructions-unclear': 'Unclear instructions',
  'instructions-conflicting': 'Conflicting instructions', other: 'Other issue',
  'protocol-unavailable': 'Instructions unavailable', 'protocol-incomplete': 'Incomplete instructions',
}
function readable(value: string) { return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('-', ' ') }

export function DiagnosticFeedback({ candidate, protocolContext }: { candidate: unknown; protocolContext?: { status: string; revision?: number | string } }) {
  const report = useMemo(() => parseDiagnosticReport(candidate), [candidate])
  const [saved, setSaved] = useState<DiagnosticReport[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
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
  return <section className="feedback-panel screen-only" aria-labelledby="feedback-title">
    <details>
      <summary className="feedback-toggle" id="feedback-title"><span>AI run details<small>Optional feedback and saved reports</small></span></summary>
      <div className="feedback-content">
        <p className="field-hint">This is the AI's account of the run. Use the ZIP checks and sheet preview to decide what to print.</p>
        {protocolContext?.status === 'conflict' && <p className="feedback-notice" role="status">The pack and its feedback refer to different instructions. This report is excluded from comparisons. Check the original chat before requesting repairs.</p>}
        {protocolContext?.status === 'invalid' && <p className="feedback-notice" role="status">We could not identify the instructions used for this pack. This report is excluded from comparisons. Use the original chat's instructions for repairs.</p>}
        {protocolContext?.status === 'unknown' && <p className="feedback-notice" role="status">We could not match this pack to known instructions. Keep the original chat's instructions for repairs.</p>}
        {candidate != null && !report && <p className="feedback-notice" role="status">The pack's feedback could not be read and was excluded. Labels that passed the ZIP checks can still be printed.</p>}
        {!report && <p>No readable feedback in this pack. You can open a separate report below.</p>}
        {report && <section className="feedback-run" aria-label="Current run">
          <div className="feedback-run-heading"><h3>This run</h3><span className="feedback-outcome">AI reported: {outcomeLabels[report.outcome]}</span></div>
          <p className="field-hint">{report.request.labelCount} {report.request.labelCount === 1 ? 'label' : 'labels'} requested</p>
          {report.issues.length > 0 ? <ul className="feedback-issues">{report.issues.map((issue, index) => <li key={index}><span>{issueLabels[issue.code] ?? readable(issue.code)}<small>{readable(issue.stage)}</small></span><span className="feedback-issue-status">{issue.resolved ? 'Resolved' : 'Unresolved'}</span></li>)}</ul> : <p className="field-hint">No issues reported by the AI.</p>}
          {report.steps.length > 0 && <details className="feedback-disclosure"><summary>Steps taken</summary><ul className="feedback-issues">{report.steps.map((step, index) => <li key={index}><span>{readable(step.stage)}<small>{step.attempts} {step.attempts === 1 ? 'attempt' : 'attempts'}</small></span><span>{readable(step.status)}</span></li>)}</ul></details>}
          <div className="feedback-actions"><button className="button secondary" type="button" onClick={() => download(report, 'tin-to-cellar-feedback.json')}>Download report</button></div>
          <details className="feedback-disclosure"><summary>View report JSON</summary><pre tabIndex={0} aria-label="Report JSON">{JSON.stringify(report, null, 2)}</pre></details>
        </section>}
        <details className="feedback-disclosure feedback-comparison">
          <summary>Open and compare saved reports</summary>
          <div className="feedback-content">
            <p className="field-hint">Open JSON reports from other runs to compare their outcomes. These files stay in this tab and replace any reports opened earlier.</p>
            <div className="feedback-actions">
              <input ref={fileInput} aria-label="Open saved feedback reports" type="file" hidden accept=".json,application/json" multiple disabled={busy} onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) void readFiles(files); event.target.value = '' }} />
              <button className="button secondary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? 'Opening reports…' : 'Choose reports'}</button>
              {saved.length > 0 && <button className="button quiet" type="button" onClick={() => { setSaved([]); setMessage('Saved reports cleared.'); }}>Clear saved reports</button>}
            </div>
            <p className="field-hint" role="status">{message}</p>
            {reports.length > 0 && <>
              <p className="field-hint">{totals.reports} distinct {totals.reports === 1 ? 'report' : 'reports'}, including this pack when eligible. Identical reports count once, even from separate runs.</p>
              <p className="field-hint">Reports are grouped by the instructions used to create the labels.</p>
              {totals.byRevision.map((group, index) => <section className="feedback-group" key={group.revisionLabel} aria-label={`Report group ${index + 1}`}>
                <h4>Report group {index + 1}</h4>
                <ul className="feedback-counts">{Object.entries(group.outcomes).filter(([, count]) => count > 0).map(([outcome, count]) => <li key={outcome}>{outcomeLabels[outcome as DiagnosticReport['outcome']]}: {count}</li>)}</ul>
                {Object.keys(group.issues).length > 0 && <><p className="field-hint">Reports mentioning each issue, including resolved issues</p><ul className="feedback-issues">{Object.entries(group.issues).map(([code, count]) => <li key={code}><span>{issueLabels[code] ?? readable(code)}</span><span>{count} {count === 1 ? 'report' : 'reports'}</span></li>)}</ul></>}
              </section>)}
              <div className="feedback-actions"><button className="button secondary" type="button" onClick={() => download({ format: 'tin-to-cellar/feedback-summary', totals, reports }, 'tin-to-cellar-feedback-summary.json')}>Download comparison</button></div>
              <details className="feedback-disclosure"><summary>View all reports JSON</summary><pre tabIndex={0} aria-label="All reports JSON">{JSON.stringify(reports, null, 2)}</pre></details>
            </>}
          </div>
        </details>
        <p className="field-hint">Importing a pack sends valid AI feedback to help improve the instructions. Your ZIP and artwork stay on this device. Reports opened here are not sent.</p>
      </div>
    </details>
  </section>
}
