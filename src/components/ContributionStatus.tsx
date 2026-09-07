import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { toSharedContribution, type Contribution } from '../lib/contributions'
import type { Retrospective } from '../lib/feedback/retrospective'

function usePause() {
  const [resetAt, setResetAt] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (resetAt === null) return
    const delay = Math.max(0, resetAt - Date.now())
    // Server allowances reset within a day; avoid overflowing the browser timer.
    if (delay > 2147483647) return
    const timer = setTimeout(() => setReady(true), delay)
    return () => clearTimeout(timer)
  }, [resetAt])
  const pause = useCallback((value: unknown) => {
    const timestamp = typeof value === 'string' ? Date.parse(value) : NaN
    // A manual pause has no reset time. Allow a deliberate check without polling.
    setReady(!Number.isFinite(timestamp) || timestamp <= Date.now())
    setResetAt(Number.isFinite(timestamp) ? timestamp : null)
  }, [])
  return { ready, resetAt, pause }
}

function pauseMessage(resetAt: number | null) {
  return `Diagnostic sharing is paused. Your labels remain available locally, including printing.${resetAt === null ? ' Try again after collection resumes.' : ` You can retry after ${new Date(resetAt).toLocaleString()}.`}`
}

export function ContributionStatus({ contribution, retrospective = null, hidden = false, autoSend = false, delivery = 'pending', onDelivery }: { contribution: Contribution | null; retrospective?: Retrospective | null; hidden?: boolean; autoSend?: boolean; delivery?: 'none' | 'pending' | 'sent' | 'failed'; onDelivery?: (delivery: 'sent' | 'failed') => void }) {
  const titleId = useId(), notesId = useId()
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'sending' | 'collected' | 'failed' | 'partial' | 'unavailable' | 'paused' | 'ineligible'>(delivery === 'sent' ? 'collected' : autoSend ? 'sending' : 'failed')
  const collectionPause = usePause(), notesPause = usePause()
  const pauseCollection = collectionPause.pause
  const contributionRef = useRef(contribution)
  const deliveryCallback = useRef(onDelivery)
  useEffect(() => { contributionRef.current = contribution; deliveryCallback.current = onDelivery }, [contribution, onDelivery])
  const submissionId = contribution?.submissionId
  const [notesStatus, setNotesStatus] = useState<'idle' | 'sending' | 'collected' | 'failed' | 'paused'>('idle')
  const receiptButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const notesController = useRef<AbortController | null>(null)
  useEffect(() => () => notesController.current?.abort(), [])
  useEffect(() => {
    if (!contributionRef.current || (!autoSend && attempt === 0)) return
    const payload = toSharedContribution(contributionRef.current)
    if (!payload) { setStatus('ineligible'); deliveryCallback.current?.('failed'); return }
    setStatus('sending')
    const controller = new AbortController()
    void fetch('/api/labels/contributions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    }).then(async response => {
      const result = await response.json() as { status?: string; code?: string; resetAt?: string }
      if ([429, 503].includes(response.status) && result.code === 'collection_paused') {
        if (!controller.signal.aborted) { pauseCollection(result.resetAt); setStatus('paused'); deliveryCallback.current?.('failed') }
        return
      }
      if (response.status === 503 && result.code === 'collection_unconfigured') {
        if (!controller.signal.aborted) { setStatus('unavailable'); deliveryCallback.current?.('failed') }
        return
      }
      if (!response.ok) throw new Error('Unavailable')
      if (!['collected', 'duplicate', 'partial'].includes(result.status ?? '')) throw new Error('Unexpected response')
      if (!controller.signal.aborted) { setStatus(result.status === 'partial' ? 'partial' : 'collected'); deliveryCallback.current?.(result.status === 'partial' ? 'failed' : 'sent') }
    }).catch(() => { if (!controller.signal.aborted) { setStatus('failed'); deliveryCallback.current?.('failed') } })
    return () => controller.abort()
  }, [submissionId, attempt, autoSend, pauseCollection])
  const share = async () => {
    if (!contribution || !retrospective || notesStatus === 'sending') return
    const controller = new AbortController()
    notesController.current = controller
    setNotesStatus('sending')
    try {
      const response = await fetch('/api/labels/process-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: contribution.submissionId, retrospective }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      const result = await response.json()
      if ([429, 503].includes(response.status) && result.code === 'collection_paused') {
        if (!controller.signal.aborted) { notesPause.pause(result.resetAt); setNotesStatus('paused') }
        return
      }
      if (!response.ok || !['collected', 'duplicate'].includes(result.status)) throw new Error('Unconfirmed')
      if (!controller.signal.aborted) setNotesStatus('collected')
    } catch { if (!controller.signal.aborted) setNotesStatus('failed') }
  }
  if (!contribution) return null
  const sharedContribution = toSharedContribution(contribution)
  const prepared = status === 'unavailable' || status === 'paused' || status === 'ineligible'
  return <section hidden={hidden} className="diagnostics-summary screen-only" aria-label={prepared ? 'Prepared diagnostics' : 'Shared diagnostics'}>
    {status !== 'collected' && <p className="field-hint" role="status">{status === 'ineligible' ? 'No catalog sources are eligible for sharing. Your labels remain available locally, including printing.' : status === 'paused' ? pauseMessage(collectionPause.resetAt) : status === 'sending' ? 'Sending AI feedback and package source observations…' : status === 'unavailable' ? 'Automatic feedback collection is unavailable on this site. This does not affect printing or label submissions.' : status === 'partial' ? 'AI feedback was received. Package source collection could not be confirmed. You can still print your labels.' : 'Feedback and source collection could not be confirmed. You can still print your labels.'}</p>}
    {(status === 'failed' || status === 'partial' || status === 'paused') && <button className="button quiet" type="button" disabled={status === 'paused' && !collectionPause.ready} onClick={event => { if (document.activeElement === event.currentTarget) receiptButton.current?.focus(); setStatus('sending'); setAttempt(value => value + 1) }}>Retry contribution</button>}
    <button ref={receiptButton} className="button quiet" type="button" onClick={() => dialog.current?.showModal()}>{prepared ? 'View prepared diagnostics' : 'View shared diagnostics'}</button>
    <dialog className="diagnostics-dialog" ref={dialog} aria-labelledby={titleId}>
      <h2 id={titleId}>{prepared ? 'Prepared diagnostics' : 'Shared diagnostics'}</h2>
      <p>{status === 'paused' ? 'Collection is paused; receipt has not been confirmed.' : status === 'unavailable' ? 'Collection is unavailable on this site; these diagnostics have not been shared.' : status === 'collected' ? 'Receipt confirmed.' : status === 'partial' ? 'Feedback received; source receipt unconfirmed.' : 'Receipt has not been confirmed.'} This diagnostics submission does not upload your ZIP or artwork.</p>
      <p className="field-hint">These are the exact structured fields prepared for submission. AI feedback describes the AI’s account; validation describes website checks. Source links are agent-reported leads.</p>
      {sharedContribution && <pre tabIndex={0} aria-label="Structured submission">{JSON.stringify(sharedContribution, null, 2)}</pre>}
      {retrospective && <section aria-labelledby={notesId}><h3 id={notesId}>Optional process notes</h3>
        <p>These AI-written notes stay in this tab until you share them. Read them for personal information before sharing. Shared notes are kept for 90 days.</p>
        <pre tabIndex={0} aria-label="Optional process notes">{JSON.stringify(retrospective, null, 2)}</pre>
        <button className="button secondary" type="button" disabled={!['collected', 'partial'].includes(status) || ['sending', 'collected'].includes(notesStatus) || (notesStatus === 'paused' && !notesPause.ready)} onClick={event => { if (document.activeElement === event.currentTarget) closeButton.current?.focus(); void share() }}>{notesStatus === 'collected' ? 'Process notes shared' : notesStatus === 'sending' ? 'Sharing…' : notesStatus === 'failed' || notesStatus === 'paused' ? 'Retry sharing process notes' : 'Share process notes'}</button>
        {notesStatus === 'paused' && <p role="status">{pauseMessage(notesPause.resetAt)} Process note receipt has not been confirmed.</p>}
        {notesStatus === 'failed' && <p role="status">Sharing could not be confirmed. Your labels are still available.</p>}
      </section>}
      <form method="dialog"><button ref={closeButton} className="button secondary" autoFocus>Close</button></form>
    </dialog>
  </section>
}
