import { useRef, useState } from 'react'
import { collectionFeedback, type Contribution } from '../lib/contributions'
import { ContributionStatus } from './ContributionStatus'
import { parseRetrospective, type Retrospective } from '../lib/feedback/retrospective'

export function StandaloneFeedback() {
  const [prepared, setPrepared] = useState<Contribution | null>(null)
  const [notes, setNotes] = useState<Retrospective | null>(null)
  const [shared, setShared] = useState(false)
  const [message, setMessage] = useState('')
  const sequence = useRef(0)
  const open = async (file?: File) => {
    if (!file) return
    const token = ++sequence.current
    setPrepared(null); setNotes(null); setShared(false); setMessage('Opening report…')
    try {
      if (file.size > 32768) throw new Error('Too large')
      const raw = JSON.parse(await file.text())
      // Accept the strict feedback report, or a separate feedback/retrospective envelope.
      const envelope = raw && typeof raw === 'object' && Object.keys(raw).sort().join() === 'feedback,retrospective'
      const feedback = collectionFeedback(envelope ? raw.feedback : raw)
      if (!feedback) throw new Error('Invalid')
      if (token !== sequence.current) return
      const retrospective = envelope ? parseRetrospective(raw.retrospective) : null
      setNotes(retrospective && 'protocolRevision' in feedback && retrospective.protocolRevision === feedback.protocolRevision ? retrospective : null)
      const id = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
      setPrepared({ version: 2, submissionId: id, origin: 'standalone', feedback, validation: null, sources: [] })
      setMessage('Opened locally. Nothing has been sent.')
    } catch { if (token === sequence.current) setMessage('This file is not a supported feedback report. No data was sent.') }
  }
  return <details className="screen-only diagnostics-summary"><summary>Report a failed AI run</summary>
    <p className="field-hint">If the AI could not create a ZIP, open its feedback JSON. Review the fields before sharing.</p>
    <label>Open failure report <input type="file" accept=".json,application/json" onChange={event => { void open(event.target.files?.[0]); event.target.value = '' }} /></label>
    <p className="field-hint" role="status">{message}</p>
    {prepared && !shared && <><pre className="standalone-preview" tabIndex={0} aria-label="Failure report submission">{JSON.stringify(prepared, null, 2)}</pre><button className="button secondary" type="button" onClick={() => setShared(true)}>Share failure report</button></>}
    {prepared && shared && <ContributionStatus key={prepared.submissionId} contribution={prepared} retrospective={notes} autoSend />}
  </details>
}
