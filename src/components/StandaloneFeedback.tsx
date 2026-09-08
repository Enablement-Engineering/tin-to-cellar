import { useEffect, useRef, useState } from 'react'
import { collectionFeedback, type Contribution } from '../lib/contributions'
import { ContributionStatus } from './ContributionStatus'
import { parseRetrospective, type Retrospective } from '../lib/feedback/retrospective'
import { Icon } from './Icons'
import '../styles/standalone-feedback.css'

export function StandaloneFeedback() {
  const [prepared, setPrepared] = useState<Contribution | null>(null)
  const [notes, setNotes] = useState<Retrospective | null>(null)
  const [shared, setShared] = useState(false)
  const [message, setMessage] = useState('')
  const sequence = useRef(0)
  const receipt = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const restoreShareFocus = useRef(false)
  useEffect(() => {
    if (shared && restoreShareFocus.current) {
      restoreShareFocus.current = false
      receipt.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }
  }, [shared])
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
  return <details className="screen-only standalone-feedback"><summary>
    <span><strong>Report a failed AI run</strong><span className="field-hint">Help improve the label-making process.</span></span>
    <span className="standalone-feedback-toggle" aria-hidden="true" />
  </summary>
    <div className="standalone-feedback-content">
    <p>If your AI could not create a ZIP, choose the feedback JSON it provided. You can review the report before sharing it.</p>
    <div className="standalone-feedback-picker">
      <input ref={fileInput} className="visually-hidden" tabIndex={-1} aria-label="Open failure report" type="file" accept=".json,application/json" onChange={event => { void open(event.target.files?.[0]); event.target.value = '' }} />
      <button className="button secondary" type="button" onClick={() => fileInput.current?.click()}><Icon name="upload" size={18} />Choose report</button>
      <span className="field-hint">JSON file · Up to 32 KB</span>
    </div>
    <p className="field-hint standalone-feedback-status" role="status">{message || 'Choosing a file does not send it.'}</p>
    {prepared && !shared && <><pre className="standalone-preview" tabIndex={0} aria-label="Failure report submission">{JSON.stringify(prepared, null, 2)}</pre><button className="button secondary" type="button" onClick={event => { restoreShareFocus.current = document.activeElement === event.currentTarget; setShared(true) }}>Share failure report</button></>}
    {prepared && shared && <div ref={receipt}><ContributionStatus key={prepared.submissionId} contribution={prepared} retrospective={notes} autoSend /></div>}
    </div>
  </details>
}
