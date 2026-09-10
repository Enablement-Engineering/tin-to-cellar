import { useEffect, useRef, useState } from 'react'
import type { GalleryLabelDraft, GalleryReviewRecord } from '../../lib/gallery/types'
import { errorText, request, GalleryRequestError } from './client'
import { PrivateImage } from './PrivateImage'
import { ReviewArtwork } from './ReviewArtwork'
import { ReviewEditor } from './ReviewEditor'
import { ReviewEvidence } from './ReviewEvidence'
import { BatchReview } from './BatchReview'
import { AdminOperations } from './AdminOperations'
import { AgentGrants } from './AgentGrants'
import { CuratedIntake } from './CuratedIntake'
import { approvalBlocker, decisionBody, initialFilters, matchesReview, MAX_REVIEW_BATCH, reviewName, reviewQuery, type ReviewAction } from './review-model'
import '../../styles/gallery-admin.css'

type QueueCounts = { pending: number; reservedBytes: number; oldestPendingAt: string | null }
type Queue = { submissions: GalleryReviewRecord[]; nextCursor: string | null; counts?: QueueCounts }
type SavedDraft = { version: number; draft: GalleryLabelDraft }

export function GalleryAdmin() {
  const [tab, setTab] = useState<'review' | 'operations' | 'agents'>('review')
  const [filters, setFilters] = useState(initialFilters)
  const applied = useRef(initialFilters)
  const [items, setItems] = useState<GalleryReviewRecord[]>([])
  const [counts, setCounts] = useState<QueueCounts | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [batch, setBatch] = useState<string[] | null>(null)
  const [current, setCurrent] = useState<GalleryReviewRecord | null>(null)
  const [draft, setDraftValue] = useState<GalleryLabelDraft | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [imageReady, setImageReady] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [reason, setReason] = useState('unsuitable')
  const [detailLoading, setDetailLoading] = useState(false)
  const [artworkAttempt, setArtworkAttempt] = useState(0)
  const selectedId = useRef<string | null>(null)
  const [drafts, setDrafts] = useState(() => new Map<string, SavedDraft>())
  const queueRequest = useRef<AbortController | null>(null)
  const detailRequest = useRef<AbortController | null>(null)
  const countsRequest = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const queueHeading = useRef<HTMLHeadingElement>(null)
  const queueButtons = useRef(new Map<string, HTMLButtonElement>())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController(); queueRequest.current = controller
    void request<Queue>(`/admin/submissions?${reviewQuery(initialFilters)}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setItems(result.submissions); setCursor(result.nextCursor); setCounts(result.counts ?? null) }
    }).catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { mounted.current = false; queueRequest.current?.abort(); detailRequest.current?.abort(); countsRequest.current?.abort() }
  }, [])
  useEffect(() => { reviewHeading.current?.focus({ preventScroll: true }); reviewHeading.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' }) }, [current?.id, current?.version])

  const forgetDraft = (id: string) => setDrafts(old => { const next = new Map(old); next.delete(id); return next })
  const updateDraft = (value: GalleryLabelDraft) => {
    if (!current) return
    setDraftValue(value); setReviewed(false); setSelected(old => old.filter(id => id !== current.id))
    if (JSON.stringify(value) === JSON.stringify(current.metadata)) forgetDraft(current.id)
    else setDrafts(old => new Map(old).set(current.id, { version: current.version, draft: value }))
  }
  const returnToQueue = () => {
    const id = selectedId.current
    detailRequest.current?.abort(); selectedId.current = null
    setCurrent(null); setDraftValue(null); setDetailLoading(false); setReviewed(false); setBatch(null)
    requestAnimationFrame(() => { (id ? queueButtons.current.get(id) : null)?.focus(); if (!id) queueHeading.current?.focus() })
  }
  const loadQueue = async (next?: string) => {
    if (inFlight.current) return
    queueRequest.current?.abort(); countsRequest.current?.abort()
    const controller = new AbortController(); queueRequest.current = controller
    if (!next) { applied.current = { ...filters, search: filters.search.trim() }; setSelected([]); setItems([]); setCursor(null); returnToQueue() }
    setLoading(true); setError('')
    try {
      const result = await request<Queue>(`/admin/submissions?${reviewQuery(applied.current, next)}`, { signal: controller.signal })
      if (!controller.signal.aborted) { setItems(old => next ? [...old, ...result.submissions.filter(item => !old.some(existing => existing.id === item.id))] : result.submissions); setCursor(result.nextCursor); setCounts(result.counts ?? null) }
    } catch (cause) { if (!controller.signal.aborted) setError(errorText(cause)) }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }
  const refreshCounts = async () => {
    countsRequest.current?.abort()
    const controller = new AbortController(); countsRequest.current = controller
    try {
      const result = await request<Queue>(`/admin/submissions?${reviewQuery(applied.current)}`, { signal: controller.signal })
      if (!controller.signal.aborted && mounted.current) setCounts(result.counts ?? null)
    } catch { if (!controller.signal.aborted && mounted.current) setError('The decision was recorded, but queue counts could not refresh. Refresh the queue to update them.') }
  }
  const open = async (id: string, discard = false) => {
    if (inFlight.current) return
    if (discard) forgetDraft(id)
    detailRequest.current?.abort()
    const controller = new AbortController(); detailRequest.current = controller
    selectedId.current = id
    setCurrent(null); setDraftValue(null); setDetailLoading(true); setReviewed(false); setImageReady(false); setConflict(false); setError(''); setReason('unsuitable')
    setArtworkAttempt(value => value + 1)
    try {
      const record = await request<GalleryReviewRecord>(`/admin/submissions/${id}`, { signal: controller.signal })
      if (!controller.signal.aborted) {
        const stored = discard ? undefined : drafts.get(id)
        const saved = stored && JSON.stringify(stored.draft) !== JSON.stringify(record.metadata) ? stored : undefined
        if (stored && !saved) forgetDraft(id)
        setCurrent(record); setDraftValue(saved?.draft ?? record.metadata)
        setConflict(Boolean(saved && saved.version !== record.version))
        if (saved) setStatus(saved.version !== record.version ? 'The saved submission changed. Your corrections are retained; discard them to review the latest version.' : 'Your unsaved corrections have been restored.')
      }
    } catch (cause) { if (!controller.signal.aborted) setError(errorText(cause)) }
    finally { if (!controller.signal.aborted) setDetailLoading(false) }
  }
  const reconcile = (record: GalleryReviewRecord) => {
    setItems(old => old.flatMap(item => item.id !== record.id ? [item] : matchesReview(record, applied.current) ? [record] : []))
    setSelected(old => old.filter(id => id !== record.id))
  }
  const action = async (kind: ReviewAction, next = false) => {
    if (!current || conflict || inFlight.current) return
    const record = current
    const following = items.slice(items.findIndex(item => item.id === record.id) + 1).find(item => item.state === 'pending') ?? items.find(item => item.id !== record.id && item.state === 'pending')
    inFlight.current = true; setBusy(true); setReviewed(false); setError(''); setStatus('Saving decision…')
    let succeeded = false
    try {
      const result = await request<GalleryReviewRecord>(`/admin/submissions/${record.id}${kind === 'save' ? '' : `/${kind}`}`, { method: kind === 'save' ? 'PATCH' : 'POST', body: decisionBody(record, kind, reason, draft) })
      if (!mounted.current) return
      forgetDraft(record.id); reconcile(result)
      if (selectedId.current === record.id) { setCurrent(result); setDraftValue(result.metadata); setImageReady(false) }
      setStatus(kind === 'save' ? 'Corrections saved. Review this version before approving.' : `${reviewName(result)}: ${result.state}.`)
      succeeded = true
      await refreshCounts()
    } catch (cause) {
      if (mounted.current) { const uncertain = !(cause instanceof GalleryRequestError) || cause.status === 409 || cause.status >= 500; setError(errorText(cause)); setConflict(uncertain); setStatus(uncertain ? 'The result could not be confirmed. Reload the submission before another decision.' : 'The request was not accepted. Your corrections are still here.') }
    } finally { inFlight.current = false; if (mounted.current) setBusy(false) }
    if (succeeded && next && mounted.current && selectedId.current === record.id) {
      if (following) await open(following.id)
      else { returnToQueue(); setStatus('No more pending labels are loaded. Load more submissions or refresh the queue.') }
    }
  }
  const dirty = Boolean(current && JSON.stringify(draft) !== JSON.stringify(current.metadata))
  const blocker = current ? approvalBlocker(current, draft, imageReady, conflict) : ''
  const selectable = items.filter(item => item.state === 'pending' && !drafts.has(item.id))
  const locked = busy || loading || detailLoading
  const setBatchBusy = (value: boolean) => { inFlight.current = value; setBusy(value) }
  const position = current ? items.findIndex(item => item.id === current.id) : -1

  return <section className="gallery-page gallery-admin screen-only">
    <header className="review-heading"><div><h1>Review community labels</h1><p>Check the artwork and tobacco match, then publish or reject.</p></div></header>
    <nav className="gallery-admin-tabs" aria-label="Administration">{(['review', 'operations', 'agents'] as const).map(value => <button key={value} className="button secondary" disabled={busy} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'review' ? 'Review queue' : value === 'operations' ? 'Operations' : 'Agent permissions'}</button>)}</nav>
    {tab === 'operations' && <AdminOperations />}{tab === 'agents' && <AgentGrants />}
    {tab === 'review' && <>
      {batch ? <BatchReview ids={batch} onClose={returnToQueue} onResult={reconcile} onFinished={refreshCounts} onBusy={setBatchBusy} /> : <>
        <div className={current || detailLoading ? 'review-queue-tools review-mobile-hidden' : 'review-queue-tools'}>
          <form className="gallery-filters" onSubmit={event => { event.preventDefault(); void loadQueue() }}>
            <label>Submission status<select disabled={busy} value={filters.state} onChange={event => setFilters({ ...filters, state: event.target.value })}>{['pending', 'published', 'unpublished', 'rejected', 'reserved', 'expired', 'deleting', 'deleted'].map(value => <option key={value}>{value}</option>)}</select></label>
            <label>Maker or blend<input maxLength={160} disabled={busy} value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} /></label>
            <label className="gallery-check"><input type="checkbox" disabled={busy} checked={filters.mappingNeeded} onChange={event => setFilters({ ...filters, mappingNeeded: event.target.checked })} />Needs catalog mapping</label>
            <button className="button secondary" disabled={busy}>Apply filters / refresh</button>
          </form>
          {counts && <p>{counts.pending} awaiting review{counts.oldestPendingAt ? ` · Oldest: ${new Date(counts.oldestPendingAt).toLocaleDateString()}` : ''}</p>}
          <div className="review-batch-toolbar">
            <label className="gallery-check"><input type="checkbox" disabled={locked || !selectable.length} checked={selectable.length > 0 && selectable.slice(0, MAX_REVIEW_BATCH).every(item => selected.includes(item.id))} onChange={event => setSelected(event.target.checked ? selectable.slice(0, MAX_REVIEW_BATCH).map(item => item.id) : [])} />Select loaded labels, up to {MAX_REVIEW_BATCH}</label>
            <span>{selected.length} selected</span><button className="button primary" disabled={locked || !selected.length} onClick={() => { setBatch([...selected]); setError('') }}>Review selected ({selected.length})</button>
            {selected.length > 0 && <button className="button quiet" disabled={locked} onClick={() => setSelected([])}>Clear selection</button>}
          </div>
        </div>
        <div className={`gallery-admin-layout ${current || detailLoading ? 'review-has-detail' : ''}`}>
          <section className="review-queue" aria-label="Review queue" aria-busy={loading}>
            <h2 ref={queueHeading} tabIndex={-1}>Submissions</h2>
            {items.map(item => <div className="review-queue-row" key={item.id}>
              {item.state === 'pending' && <input aria-label={`Select ${reviewName(item)}`} type="checkbox" checked={selected.includes(item.id)} disabled={locked || drafts.has(item.id) || (!selected.includes(item.id) && selected.length >= MAX_REVIEW_BATCH)} onChange={event => setSelected(old => event.target.checked ? [...old, item.id] : old.filter(id => id !== item.id))} />}
              <button ref={element => { if (element) queueButtons.current.set(item.id, element); else queueButtons.current.delete(item.id) }} className="gallery-queue-item" aria-label={`${reviewName(item)}, ${item.state}${item.mappingNeeded ? ", needs mapping" : ""}${drafts.has(item.id) ? ", unsaved corrections" : ""}`} disabled={busy} aria-current={current?.id === item.id ? 'true' : undefined} onClick={() => void open(item.id)}>
                <PrivateImage id={item.id} alt="" /><span><strong>{reviewName(item)}</strong><span>{item.state}{item.mappingNeeded ? ' · Needs mapping' : ''}{drafts.has(item.id) ? ' · Unsaved corrections' : ''}</span>{item.metadata?.edition && <span>{item.metadata.edition}</span>}</span>
              </button>
            </div>)}
            {!items.length && !loading && <p>No submissions match these filters.</p>}
            {cursor && <button className="button secondary" disabled={locked} onClick={() => void loadQueue(cursor)}>More submissions</button>}
          </section>
          <div className="review-detail">
            {detailLoading && <p role="status">Loading submission…</p>}
            {!current && !detailLoading && <p className="review-empty">Choose a label to inspect, or select a group for batch review.</p>}
            {current && <article aria-label="Selected submission">
              <header className="review-heading"><div><h2 ref={reviewHeading} tabIndex={-1}>{reviewName(current)}</h2><p>{current.state}{draft?.edition ? ` · ${draft.edition}` : ''}</p></div><button className="button secondary" disabled={busy} onClick={returnToQueue}>Back to queue</button></header>
              <div className="admin-review-navigation"><a className="button quiet review-decision-jump" href="#label-decision">Go to decision</a><button className="button quiet" disabled={busy || position <= 0} onClick={() => void open(items[position - 1].id)}>Previous</button><button className="button quiet" disabled={busy || position < 0 || position >= items.length - 1} onClick={() => void open(items[position + 1].id)}>Next</button><button className="button quiet" disabled={busy} onClick={() => void open(current.id)}>Reload submission</button></div>
              {draft ? <>
                <ReviewArtwork key={`${current.id}:${current.version}:${artworkAttempt}`} id={current.id} alt={draft.altText || `${reviewName(current)} artwork`} onReady={setImageReady} />
                <ReviewEditor key={`editor:${current.id}:${current.version}`} draft={draft} onChange={updateDraft} onSave={() => void action('save')} onDiscard={() => { if (conflict) void open(current.id, true); else { forgetDraft(current.id); setDraftValue(current.metadata); setReviewed(false) } }} dirty={dirty} disabled={busy || conflict || current.state !== 'pending'} />
                {conflict && dirty && <button className="button secondary" disabled={busy} onClick={() => void open(current.id, true)}>Discard corrections and reload</button>}
                <ReviewEvidence key={`evidence:${current.id}:${current.version}`} record={current} />
              </> : <p>Artwork and metadata are no longer available for review.</p>}
              <div id="label-decision" tabIndex={-1} className="review-decision-bar" aria-label="Review decision">
                <p role="status" aria-atomic="true">{status}</p>{error && <p role="alert">{error}</p>}
                {blocker && ['pending', 'unpublished'].includes(current.state) && <p id="approval-blocker">{blocker}</p>}
                {draft && ['pending', 'unpublished'].includes(current.state) && <label className="gallery-check"><input type="checkbox" checked={reviewed} disabled={busy || Boolean(blocker)} onChange={event => setReviewed(event.target.checked)} />I reviewed this artwork and the saved details, including its blank writing area.</label>}
                <div className="gallery-actions">
                  {current.state === 'pending' && <><button className="button primary" disabled={busy || Boolean(blocker) || !reviewed} onClick={() => void action('approve', true)}>Approve and next</button><button className="button secondary" disabled={busy || Boolean(blocker) || !reviewed} onClick={() => void action('approve')}>Approve and publish</button><label>Rejection reason<select disabled={busy} value={reason} onChange={event => setReason(event.target.value)}>{['unsuitable', 'rights-concern', 'duplicate', 'other'].map(value => <option key={value}>{value}</option>)}</select></label><button className="button secondary" disabled={busy || conflict} onClick={() => void action('reject', true)}>Reject and next</button></>}
                  {current.state === 'unpublished' && <button className="button primary" disabled={busy || Boolean(blocker) || !reviewed} onClick={() => void action('republish')}>Republish reviewed version</button>}
                  {current.state === 'published' && <><button className="button secondary" disabled={busy || conflict} onClick={() => void action('unpublish')}>Unpublish now</button><button className="button quiet" disabled={busy || conflict} onClick={() => void action('refresh')}>Refresh public identity and pack</button></>}
                </div>
                {current.deletionDue && <p>Scheduled deletion: {new Date(current.deletionDue).toLocaleString()}</p>}
              </div>
            </article>}
          </div>
        </div>
        {!current && <div className="review-status"><p role="status">{loading ? 'Loading submissions…' : status}</p>{error && <p role="alert">{error}</p>}</div>}
        <CuratedIntake />
      </>}
    </>}
  </section>
}
