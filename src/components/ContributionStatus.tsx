import { useEffect, useRef, useState } from 'react'
import type { Contribution } from '../lib/contributions'
import type { Retrospective } from '../lib/feedback/retrospective'

export function ContributionStatus({ contribution, retrospective = null, hidden = false }: { contribution: Contribution | null; retrospective?: Retrospective | null; hidden?: boolean }) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'sending' | 'collected' | 'failed' | 'partial'>('sending')
  const [notesStatus, setNotesStatus] = useState<'idle' | 'sending' | 'collected' | 'failed'>('idle')
  const dialog = useRef<HTMLDialogElement>(null)
  const notesController = useRef<AbortController | null>(null)
  useEffect(() => () => notesController.current?.abort(), [])
  useEffect(() => {
    if (!contribution) return
    const controller = new AbortController()
    void fetch('/api/labels/contributions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contribution),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    }).then(async response => {
      if (!response.ok) throw new Error('Unavailable')
      const result = await response.json() as { status?: string }
      if (!['collected', 'duplicate', 'partial'].includes(result.status ?? '')) throw new Error('Unexpected response')
      if (!controller.signal.aborted) setStatus(result.status === 'partial' ? 'partial' : 'collected')
    }).catch(() => { if (!controller.signal.aborted) setStatus('failed') })
    return () => controller.abort()
  }, [contribution, attempt])
  const share = async () => {
    if (!contribution || !retrospective || notesStatus === 'sending') return
    const controller = new AbortController()
    notesController.current = controller
    setNotesStatus('sending')
    try {
      const response = await fetch('/api/labels/process-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: contribution.submissionId, retrospective }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      const result = await response.json()
      if (!response.ok || !['collected', 'duplicate'].includes(result.status)) throw new Error('Unconfirmed')
      if (!controller.signal.aborted) setNotesStatus('collected')
    } catch { if (!controller.signal.aborted) setNotesStatus('failed') }
  }
  if (!contribution) return null
  return <section hidden={hidden} className="diagnostics-summary screen-only" aria-label="Shared diagnostics">
    {status !== 'collected' && <p className="field-hint" role="status">{status === 'sending' ? 'Sending AI feedback and package source observations…' : status === 'partial' ? 'AI feedback was received. Package source collection could not be confirmed. You can still print your labels.' : 'Feedback and source collection could not be confirmed. You can still print your labels.'}</p>}
    {(status === 'failed' || status === 'partial') && <button className="button quiet" type="button" onClick={() => { setStatus('sending'); setAttempt(value => value + 1) }}>Retry contribution</button>}
    <button className="button quiet" type="button" onClick={() => dialog.current?.showModal()}>View shared diagnostics</button>
    <dialog className="diagnostics-dialog" ref={dialog} aria-labelledby="shared-diagnostics-title">
      <h2 id="shared-diagnostics-title">Shared diagnostics</h2>
      <p>{status === 'collected' ? 'Receipt confirmed.' : status === 'partial' ? 'Feedback received; source receipt unconfirmed.' : 'Receipt has not been confirmed.'} Your ZIP and artwork stay on this device.</p>
      <p className="field-hint">These are the exact structured fields prepared for submission. AI feedback describes the AI’s account; validation describes website checks. Source links are agent-reported leads.</p>
      <pre tabIndex={0} aria-label="Structured submission">{JSON.stringify(contribution, null, 2)}</pre>
      {retrospective && <section aria-labelledby="process-notes-title"><h3 id="process-notes-title">Optional process notes</h3>
        <p>These AI-written notes stay in this tab until you share them. Read them for personal information before sharing. Shared notes are kept for 90 days.</p>
        <pre tabIndex={0} aria-label="Optional process notes">{JSON.stringify(retrospective, null, 2)}</pre>
        <button className="button secondary" type="button" disabled={!['collected', 'partial'].includes(status) || ['sending', 'collected'].includes(notesStatus)} onClick={() => void share()}>{notesStatus === 'collected' ? 'Process notes shared' : notesStatus === 'sending' ? 'Sharing…' : notesStatus === 'failed' ? 'Retry sharing process notes' : 'Share process notes'}</button>
        {notesStatus === 'failed' && <p role="status">Sharing could not be confirmed. Your labels are still available.</p>}
      </section>}
      <form method="dialog"><button className="button secondary" autoFocus>Close</button></form>
    </dialog>
  </section>
}
