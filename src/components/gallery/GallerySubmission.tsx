import { useCallback, useEffect, useRef, useState } from 'react'
import { useRecoveryBlocker } from '../../hooks/useAppRecovery'
import type { ImportedCellarLabel } from '../../lib/cellarpack/types'
import type { GalleryReceipt } from '../../lib/gallery/types'
import { MAX_SUBMISSION_LABELS } from '../../lib/gallery/schema'
import { API, GalleryRequestError, GalleryUploadError, uploadFailure, errorText, request, useConfig } from './client'
import { Artwork } from './Artwork'
import { SHARING_NOTICE, ACKNOWLEDGEMENT, buildDraft, hex, references, initial, type Choice, type Attempt } from './draft'
import { Turnstile } from './Turnstile'

export function GallerySubmission({ labels }: { labels: ImportedCellarLabel[] }) {
  const { config, error: configError } = useConfig()
  const [selected, setSelected] = useState<string[]>(() => labels.length === 1 ? [labels[0].id] : []), [choices, setChoices] = useState<Record<string, Choice>>({})
  const [accepted, setAccepted] = useState(false), [attempts, setAttempts] = useState<Attempt[]>([]), [active, setActive] = useState<number | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [challenge, setChallenge] = useState(0)
  const [verification, setVerification] = useState<number[] | null>(null)
  const remainingLabels = labels.filter(item => !attempts.some(attempt => attempt.receipt && !attempt.error && attempt.label.id === item.id && attempt.draft.image.sha256 === item.artwork.asset.sha256))
  const panel = useRef<HTMLElement>(null), results = useRef<HTMLElement>(null), focusResults = useRef(false)
  useEffect(() => {
    if (busy || active !== null || !focusResults.current) return
    focusResults.current = false
    if (document.activeElement === document.body || panel.current?.contains(document.activeElement)) results.current?.focus()
  }, [busy, active])
  const hasDraft = selected.length > 0 && (labels.length > 1 || accepted || Object.keys(choices).length > 0)
  useRecoveryBlocker(busy || active !== null ? 'Wait for your gallery submission to finish before updating.' : hasDraft || attempts.some(attempt => attempt.error) ? 'Finish your gallery submission, or leave this page, before updating.' : null)
  const inFlight = useRef(false)
  const [previousLabels, setPreviousLabels] = useState(labels)
  if (previousLabels !== labels) { setPreviousLabels(labels); setSelected(labels.length === 1 && remainingLabels.length === 1 ? [labels[0].id] : []); setChoices({}); setAccepted(false) }
  const change = (item: ImportedCellarLabel, update: Partial<Choice>) => setChoices(old => ({ ...old, [item.id]: { ...(old[item.id] ?? initial(item)), ...update } }))
  const start = async () => {
    if (!accepted || !selected.length || inFlight.current || active !== null) return
    inFlight.current = true
    setError(''); setBusy(true)
    try {
      const result: Attempt[] = []
      const key = hex(crypto.getRandomValues(new Uint8Array(32)).buffer)
      for (const item of remainingLabels.filter(item => selected.includes(item.id))) result.push({ label: item, draft: await buildDraft(item, choices[item.id] ?? initial(item), crypto.randomUUID()), key })
      if (!result.length) return
      setAttempts(old => [...old, ...result]); setActive(attempts.length); setVerification(result.map((_, index) => attempts.length + index)); setChallenge(value => value + 1)
    } catch (e) { setError(errorText(e) === 'invalid_metadata' ? 'Sharing needs a square PNG, 825–2048 pixels per side, no larger than 8 MiB, with the supported 2.5-inch circle and blank writing area. Check the metadata shown above. You can still print locally.' : errorText(e)) }
    finally { inFlight.current = false; setBusy(false) }
  }
  const submit = useCallback(async (indices: number[], token?: string) => {
    if (!indices.length || inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    setActive(indices[0]); setVerification(null)
    const fail = (index: number, e: unknown) => setAttempts(old => old.map((entry, i) => i === index ? { ...entry, error: errorText(e), retryable: !(e instanceof GalleryUploadError) || e.retryable } : entry))
    try {
      const pending = indices.filter(index => !attempts[index].reservation)
      const reservations = new Map(indices.map(index => [index, attempts[index].reservation]))
      if (pending.length) {
        const headers = token ? { 'X-Turnstile-Token': token } : undefined
        const drafts = pending.map(index => attempts[index].draft)
        const key = attempts[pending[0]].key
        const receipts = pending.length === 1
          ? [await request<GalleryReceipt>('/submissions', { method: 'POST', headers, body: JSON.stringify(drafts[0]) }, key)]
          : (await request<{ submissions: GalleryReceipt[] }>('/submissions/batch', { method: 'POST', headers, body: JSON.stringify({ submissions: drafts }) }, key)).submissions
        for (const index of pending) {
          const receipt = receipts.find(receipt => receipt.id === attempts[index].draft.submissionId)
          if (!receipt) throw new Error('Submission not confirmed. Retry to finish sharing this label.')
          reservations.set(index, receipt)
        }
        setAttempts(old => old.map((entry, index) => pending.includes(index) ? { ...entry, reservation: reservations.get(index), error: undefined } : entry))
      }
      for (const index of indices) {
        setActive(index)
        const attempt = attempts[index]
        try {
          let completed = reservations.get(index)!
          if (['reserved', 'uploading'].includes(completed.state)) {
            const response = await fetch(`${API}/submissions/${completed.id}/artwork`, { method: 'PUT', headers: { Authorization: `Bearer ${attempt.key}`, 'Content-Type': 'image/png' }, body: attempt.label.artwork.data, referrerPolicy: 'no-referrer' })
            if (!response.ok) throw await uploadFailure(response)
            completed = await response.json() as GalleryReceipt
          }
          if (['expired', 'deleting', 'deleted', 'withdrawn'].includes(completed.state)) throw new GalleryUploadError('This submission is no longer available. Use Submit for review to send the selected label again.', false)
          if (!['pending', 'published', 'unpublished', 'rejected'].includes(completed.state)) throw new GalleryUploadError('Submission not confirmed. Retry to finish sharing this label.', true)
          setAttempts(old => old.map((entry, i) => i === index ? { ...entry, receipt: completed, error: undefined } : entry))
          setSelected(old => old.filter(id => id !== attempt.label.id))
          setChoices(old => { const next = { ...old }; delete next[attempt.label.id]; return next })
          setAccepted(false)
          focusResults.current = true
        } catch (e) { fail(index, e) }
      }
      setActive(null)
    } catch (e) {
      // Reconcile an uncertain reservation before asking for another check.
      if (!token && e instanceof GalleryRequestError && e.status === 403) {
        setVerification(indices); setChallenge(value => value + 1)
      } else {
        indices.forEach(index => fail(index, e)); setActive(null)
      }
    } finally { inFlight.current = false; setBusy(false) }
  }, [attempts])
  const token = useCallback((value: string) => { if (value && verification) void submit(verification, value) }, [submit, verification])
  const verificationError = useCallback((value: string) => { if (!inFlight.current) { setError(value); setActive(null); setVerification(null) } }, [])
  if (configError) return <p className="field-hint">{configError}</p>
  if (!config) return null
  if (!config.intake) return <p className="field-hint">Community submissions are closed for now. Your labels are still available to print.</p>
  return <section ref={panel} className="panel gallery-submission screen-only" aria-labelledby="share-labels-title">
    <h2 id="share-labels-title">Share your labels</h2>
    {remainingLabels.length > 0 && <><p>{SHARING_NOTICE}</p>
    {labels.length > 1 && <p className="field-hint">Choose up to five designs to share.</p>}
    <div className="gallery-grid">{remainingLabels.map(item => { const choice = choices[item.id] ?? initial(item), checked = selected.includes(item.id); return <article className="gallery-card" key={item.id}>
      <Artwork data={item.artwork.data} alt={`${item.label.maker} ${item.label.blend} artwork`} />
      {labels.length === 1 ? <h3>{item.label.maker} · {item.label.blend}</h3> : <label className="gallery-check"><input type="checkbox" checked={checked} disabled={busy || active !== null || (!checked && selected.length >= MAX_SUBMISSION_LABELS)} onChange={() => setSelected(old => checked ? old.filter(id => id !== item.id) : [...old, item.id])} />Share {item.label.maker} {item.label.blend}</label>}
      {checked && <details className="gallery-submission-details"><summary>Edit details</summary><fieldset disabled={busy || active !== null}><legend>Information to share</legend>
        <label>Edition, if known<input maxLength={120} value={choice.edition} onChange={event => change(item, { edition: event.target.value })} /></label>
        <label>Artwork description, optional<input maxLength={320} value={choice.description} onChange={event => change(item, { description: event.target.value })} /></label>
        {references(item).length > 0 && <p className="field-hint">Include a public reference link (optional). Links do not grant reuse permission.</p>}
        {references(item).map(source => source.type === 'web' && <label className="gallery-check gallery-reference" key={source.id}><input type="checkbox" checked={choice.references.includes(source.url)} disabled={!choice.references.includes(source.url) && choice.references.length >= 3} onChange={() => change(item, { references: choice.references.includes(source.url) ? choice.references.filter(url => url !== source.url) : [...choice.references, source.url] })} />{source.url}</label>)}
        <p className="field-hint">{item.artwork.pixelWidth} × {item.artwork.pixelHeight} pixels · {item.label.surface.finishedSize.width} {item.label.surface.finishedSize.unit} {item.label.surface.shape}. Sharing requires a square PNG, 825–2048 pixels per side, up to 8 MiB, with a 2.5-inch circle and blank writing area.</p>
      </fieldset></details>}
    </article> })}</div>
    <label className="gallery-check"><input type="checkbox" checked={accepted} disabled={busy || active !== null} onChange={event => setAccepted(event.target.checked)} />{ACKNOWLEDGEMENT}</label>
    <details className="gallery-retention"><summary>How long submissions are kept</summary><p className="field-hint">Unreviewed submissions expire after 30 days. Rejected artwork is scheduled for deletion after 7 days. A limited review record stays for 90 days. Downloaded copies cannot be recalled.</p></details>
    <button className="button primary" disabled={!accepted || !selected.length || busy || active !== null} onClick={() => void start()}>{busy || active !== null ? 'Submitting…' : 'Submit for review'}</button></>}
    {active !== null && <><p role="status">{busy ? 'Uploading selected artwork…' : 'Verify your submission once for all selected labels.'}</p>{verification && !busy && <Turnstile key={challenge} siteKey={config.turnstileSiteKey} onToken={token} onError={verificationError} />}</>}
    {error && <p role="alert">{error}</p>}
    {attempts.length > 0 && <section ref={results} tabIndex={-1} className="gallery-submission-results" aria-label="Submission results">
      {attempts.map((a, index) => <article className="gallery-submission-result" key={a.draft.submissionId}><h3>{a.label.label.maker} {a.label.label.blend}</h3><p className="field-hint" role="status">{a.error ?? (a.receipt ? a.receipt.state === 'published' ? 'Your label is available in the gallery.' : a.receipt.state === 'rejected' ? 'Reviewed. This label was not approved for the gallery.' : a.receipt.state === 'unpublished' ? 'This label is no longer public in the gallery.' : 'Submitted for review. Your label will appear in the gallery once approved.' : active === index ? 'Submitting this label…' : active !== null && index > active ? 'Waiting to submit.' : 'Submission not confirmed. Retry to finish sharing this label.')}</p>{(!a.receipt || a.error) && a.retryable !== false && active === null && <button className="button quiet" disabled={busy} onClick={() => void submit([index])}>Retry this label</button>}</article>)}
    </section>}
  </section>
}
