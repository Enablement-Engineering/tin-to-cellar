import { useEffect, useRef, useState } from 'react'
import type { GalleryReviewRecord } from '../../lib/gallery/types'
import { errorText, request } from './client'
import { ReviewArtwork } from './ReviewArtwork'
import { ReviewEvidence } from './ReviewEvidence'
import { approvalBlocker, decisionBody, reviewName } from './review-model'

type Entry = { id: string; record?: GalleryReviewRecord; error?: string; done?: string; imageReady: boolean }
export function BatchReview({ ids, onClose, onResult, onFinished, onBusy }: {
  ids: string[]; onClose: () => void; onResult: (record: GalleryReviewRecord) => void; onFinished: () => Promise<void>; onBusy: (busy: boolean) => void
}) {
  const [entries, setEntries] = useState<Entry[]>(() => ids.map(id => ({ id, imageReady: false })))
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [reason, setReason] = useState('unsuitable')
  const [status, setStatus] = useState('')
  const [reload, setReload] = useState(0)
  const activeIds = useRef(ids)
  const inFlight = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' }) }, [])
  useEffect(() => { if (!busy && /^\d+ of /.test(status)) heading.current?.focus({ preventScroll: true }) }, [busy, status])
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all(activeIds.current.map(async id => {
      try { return { id, record: await request<GalleryReviewRecord>(`/admin/submissions/${id}`, { signal: controller.signal }), imageReady: false } }
      catch (cause) { return { id, error: errorText(cause), imageReady: false } }
    })).then(result => { if (!controller.signal.aborted) { setEntries(result); setLoading(false) } })
    return () => controller.abort()
  }, [reload])
  const pending = entries.filter(entry => !entry.done)
  const labelCount = `${pending.length} ${pending.length === 1 ? 'label' : 'labels'}`
  const ready = pending.length > 0 && pending.every(entry => entry.record?.state === 'pending' && !entry.error && !approvalBlocker(entry.record, entry.record.metadata, entry.imageReady))
  const rejectable = pending.length > 0 && pending.every(entry => entry.record?.state === 'pending' && !entry.error)
  const remove = (id: string) => { setEntries(old => old.filter(entry => entry.id !== id)); activeIds.current = activeIds.current.filter(item => item !== id); setReviewed(false) }
  const run = async (kind: 'approve' | 'reject') => {
    if (inFlight.current || loading || (kind === 'approve' ? !ready || !reviewed : !rejectable)) return
    inFlight.current = true; setBusy(true); onBusy(true); setReviewed(false)
    let succeeded = 0
    for (const [index, entry] of pending.entries()) {
      const record = entry.record!
      setStatus(`${kind === 'approve' ? 'Publishing' : 'Rejecting'} ${index + 1} of ${pending.length}: ${reviewName(record)}`)
      let result: GalleryReviewRecord | undefined
      let failure = ''
      let refreshed = false
      try { result = await request<GalleryReviewRecord>(`/admin/submissions/${record.id}/${kind}`, { method: 'POST', body: decisionBody(record, kind, reason) }) }
      catch (cause) {
        failure = errorText(cause)
        // A lost response may follow a successful write. Read its state before offering retry.
        try { result = await request<GalleryReviewRecord>(`/admin/submissions/${record.id}`); refreshed = true } catch { /* Keep the original error and require reload. */ }
      }
      const completed = result && (result.state === (kind === 'approve' ? 'published' : 'rejected'))
      if (result) onResult(result)
      if (completed) succeeded++
      setEntries(old => old.map(item => item.id !== entry.id ? item : {
        ...item, record: result ?? item.record, imageReady: false,
        done: completed ? `${kind === 'approve' ? 'Published' : 'Rejected'}${refreshed ? ' · status refreshed' : ''}` : undefined,
        error: completed ? undefined : failure || `Status is now ${result?.state ?? 'unknown'}. Reload before deciding again.`,
      }))
    }
    setStatus(`${succeeded} of ${pending.length} ${kind === 'approve' ? 'published' : 'rejected'}.${succeeded < pending.length ? ' Review the remaining results before retrying.' : ''}`)
    try { await onFinished() } finally { inFlight.current = false; setBusy(false); onBusy(false) }
  }
  return <section className="batch-review" aria-label="Batch review" aria-busy={busy || loading}>
    <header className="review-heading"><div><h2 ref={heading} tabIndex={-1}>Review selected labels</h2><p>{pending.length} awaiting a decision. Inspect the artwork, tobacco match, and blank writing area for each label.</p></div><a className="button quiet review-decision-jump" href="#batch-decision">Go to batch decision</a><button className="button secondary" disabled={busy} onClick={onClose}>Back to queue</button></header>
    <div className="batch-grid">{entries.map(entry => <article className="batch-card" key={entry.id}>
      <h3>{entry.record ? reviewName(entry.record) : 'Loading label…'}</h3>
      {entry.done ? <p className="batch-done">{entry.done}</p> : <>
        {entry.record && <><p>{entry.record.metadata?.edition ? `${entry.record.metadata.edition} · ` : ""}{entry.record.state}</p>
          {entry.record.metadata && <ReviewArtwork key={`${entry.id}:${entry.record.version}:${reload}`} id={entry.id} alt={entry.record.metadata.altText || `${reviewName(entry.record)} artwork`} onReady={imageReady => setEntries(old => old.map(item => item.id === entry.id ? { ...item, imageReady } : item))} />}
          {entry.record.state !== 'pending' ? <p>This label is no longer pending. Remove it from this batch.</p> : approvalBlocker(entry.record, entry.record.metadata, entry.imageReady) && <p className="field-hint">{approvalBlocker(entry.record, entry.record.metadata, entry.imageReady)}</p>}
        </>}
        {entry.record && <ReviewEvidence key={`evidence:${entry.id}:${entry.record.version}`} record={entry.record} compact />}
        {entry.error && <p role="alert">{entry.error}</p>}
        <button className="button quiet" disabled={busy || loading} onClick={() => remove(entry.id)}>Remove {entry.record ? reviewName(entry.record) : 'label'} from batch</button>
      </>}
    </article>)}</div>
    <div id="batch-decision" tabIndex={-1} className="review-decision-bar">
      <p role="status" aria-atomic="true">{loading ? 'Loading selected labels…' : status || `${pending.length} labels in this batch`}</p>
      {pending.length > 0 && <>
        <label className="gallery-check"><input type="checkbox" checked={reviewed} disabled={busy || loading || !ready} onChange={event => setReviewed(event.target.checked)} />I reviewed all {pending.length} labels shown here, including their tobacco matches and blank writing areas.</label>
        {!ready && !busy && !loading && <p className="field-hint">Approval becomes available when every remaining label is ready. Remove labels that need corrections and review them individually.</p>}
        <div className="gallery-actions">
          <button className="button primary" disabled={busy || loading || !ready || !reviewed} onClick={() => void run('approve')}>{`Approve and publish ${labelCount}`}</button>
          <label>Batch rejection reason<select disabled={busy} value={reason} onChange={event => setReason(event.target.value)}>{['unsuitable', 'rights-concern', 'duplicate', 'other'].map(value => <option key={value}>{value}</option>)}</select></label>
          <button className="button secondary" disabled={busy || loading || !rejectable} onClick={() => void run('reject')}>{`Reject ${labelCount}`}</button>
          <button className="button quiet" disabled={busy || loading} onClick={() => { activeIds.current = pending.map(entry => entry.id); setLoading(true); setReviewed(false); setStatus(''); setReload(value => value + 1) }}>{`Reload remaining ${pending.length === 1 ? 'label' : 'labels'}`}</button>
        </div>
      </>}
    </div>
  </section>
}
