import { useCallback, useRef, useState } from 'react'
import type { ImportedCellarLabel } from '../../lib/cellarpack/types'
import type { GalleryReceipt } from '../../lib/gallery/types'
import { API, GalleryUploadError, uploadFailure, errorText, request, useConfig } from './client'
import { Artwork } from './Artwork'
import { SHARING_NOTICE, ACKNOWLEDGEMENT, buildDraft, hex, references, initial, type Choice, type Attempt } from './draft'
import { Turnstile } from './Turnstile'

export function GallerySubmission({ labels }: { labels: ImportedCellarLabel[] }) {
  const { config, error: configError } = useConfig()
  const [selected, setSelected] = useState<string[]>([]), [choices, setChoices] = useState<Record<string, Choice>>({})
  const [accepted, setAccepted] = useState(false), [attempts, setAttempts] = useState<Attempt[]>([]), [active, setActive] = useState<number | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [challenge, setChallenge] = useState(0)
  const inFlight = useRef(false)
  const [previousLabels, setPreviousLabels] = useState(labels)
  if (previousLabels !== labels) { setPreviousLabels(labels); setSelected([]); setChoices({}); setAccepted(false) }
  const change = (item: ImportedCellarLabel, update: Partial<Choice>) => setChoices(old => ({ ...old, [item.id]: { ...(old[item.id] ?? initial(item)), ...update } }))
  const start = async () => {
    setError(''); setBusy(true)
    try {
      const result: Attempt[] = []
      for (const item of labels.filter(item => selected.includes(item.id))) result.push({ label: item, draft: await buildDraft(item, choices[item.id] ?? initial(item), crypto.randomUUID()), key: hex(crypto.getRandomValues(new Uint8Array(32)).buffer) })
      setAttempts(old => [...old, ...result]); setActive(attempts.length); setChallenge(value => value + 1)
    } catch (e) { setError(errorText(e) === 'invalid_metadata' ? 'Sharing needs a square PNG, 825–2048 pixels per side, no larger than 8 MiB, with the supported 2.5-inch circle and blank writing area. Check the metadata shown above. You can still print locally.' : errorText(e)) }
    finally { setBusy(false) }
  }
  const submit = useCallback(async (token: string) => {
    if (!token || active === null || inFlight.current) return
    const attempt = attempts[active]; if (!attempt) return
    inFlight.current = true; setBusy(true); setError('')
    try {
      const receipt = await request<GalleryReceipt>('/submissions', { method: 'POST', headers: { 'X-Turnstile-Token': token }, body: JSON.stringify(attempt.draft) }, attempt.key)
      let completed = receipt
      if (['reserved', 'uploading'].includes(receipt.state)) {
        const response = await fetch(`${API}/submissions/${receipt.id}/artwork`, { method: 'PUT', headers: { Authorization: `Bearer ${attempt.key}`, 'Content-Type': 'image/png' }, body: attempt.label.artwork.data, referrerPolicy: 'no-referrer' })
        if (!response.ok) throw await uploadFailure(response)
        completed = await response.json() as GalleryReceipt
      }
      if (['expired', 'deleting', 'deleted', 'withdrawn'].includes(completed.state)) throw new GalleryUploadError('This submission is no longer available. Use Submit for review to send the selected label again.', false)
      if (!['pending', 'published', 'unpublished', 'rejected'].includes(completed.state)) throw new GalleryUploadError('Submission not confirmed. Retry to finish sharing this label.', true)
      setAttempts(old => old.map((entry, index) => index === active ? { ...entry, receipt: completed, error: undefined } : entry))
      setSelected(old => old.filter(id => id !== attempt.label.id))
    } catch (e) { setAttempts(old => old.map((entry, index) => index === active ? { ...entry, error: errorText(e), retryable: !(e instanceof GalleryUploadError) || e.retryable } : entry)) }
    finally { inFlight.current = false; setBusy(false); const next = attempts.findIndex((entry, index) => index > active && !entry.receipt && !entry.error); setActive(next >= 0 ? next : null); setChallenge(value => value + 1) }
  }, [active, attempts])
  const token = useCallback((value: string) => { void submit(value) }, [submit])
  const verificationError = useCallback((value: string) => { setError(value); setActive(null) }, [])
  if (configError) return <p className="field-hint">{configError}</p>
  if (!config) return null
  if (!config.intake) return <p className="field-hint">Community submissions are closed for now. Your labels are still available to print.</p>
  return <section className="panel gallery-submission screen-only" aria-labelledby="share-labels-title">
    <h2 id="share-labels-title">Share your labels</h2><p>{SHARING_NOTICE}</p>
    <p className="field-hint">Choose up to five designs. Sharing supports square PNG artwork, 825–2048 pixels per side, up to 8 MiB, for 2.5-inch circles. Your writing area stays part of the artwork.</p>
    <div className="gallery-grid">{labels.map(item => { const choice = choices[item.id] ?? initial(item), checked = selected.includes(item.id); return <article className="gallery-card" key={item.id}>
      <Artwork data={item.artwork.data} alt={`${item.label.maker} ${item.label.blend} artwork`} />
      <label className="gallery-check"><input type="checkbox" checked={checked} disabled={busy || active !== null || (!checked && selected.length >= 5)} onChange={() => setSelected(old => checked ? old.filter(id => id !== item.id) : [...old, item.id])} />Share {item.label.maker} {item.label.blend}</label>
      {checked && <fieldset disabled={busy || active !== null}><legend>Information to share</legend><p>{item.label.maker} · {item.label.blend}</p><p>{item.artwork.pixelWidth} × {item.artwork.pixelHeight} pixels · {item.label.surface.finishedSize.width} {item.label.surface.finishedSize.unit} {item.label.surface.shape}</p>
        <label>Package<select value={choice.package} onChange={event => change(item, { package: event.target.value as Choice['package'] })}>{['unknown','tin','pouch','box','bulk','other'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Variant<select value={choice.variant} onChange={event => change(item, { variant: event.target.value as Choice['variant'] })}>{['unknown','current','historical','special'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Edition, if known<input maxLength={120} value={choice.edition} onChange={event => change(item, { edition: event.target.value })} /></label>
        <label>Artwork description<input maxLength={320} value={choice.description} onChange={event => change(item, { description: event.target.value })} /></label>
        <p>Reference links are optional. Select only public product pages you want to share. A link does not grant reuse permission.</p>
        {references(item).map(source => source.type === 'web' && <label className="gallery-check gallery-reference" key={source.id}><input type="checkbox" checked={choice.references.includes(source.url)} disabled={!choice.references.includes(source.url) && choice.references.length >= 3} onChange={() => change(item, { references: choice.references.includes(source.url) ? choice.references.filter(url => url !== source.url) : [...choice.references, source.url] })} />{source.url}</label>)}
        <p className="field-hint">Your ZIP, private notes, and other research are excluded.</p>
      </fieldset>}
    </article> })}</div>
    <label className="gallery-check"><input type="checkbox" checked={accepted} disabled={busy || active !== null} onChange={event => setAccepted(event.target.checked)} />{ACKNOWLEDGEMENT}</label>
    <details className="gallery-retention"><summary>How long submissions are kept</summary><p className="field-hint">Unreviewed submissions expire after 30 days. Rejected artwork is scheduled for deletion after 7 days. A limited review record stays for 90 days. Downloaded copies cannot be recalled.</p></details>
    <button className="button primary" disabled={!accepted || !selected.length || busy || active !== null} onClick={() => void start()}>{busy || active !== null ? 'Submitting…' : attempts.length > 0 && !selected.length && attempts.every(a => a.receipt && !a.error) ? 'Submitted' : 'Submit for review'}</button>
    {active !== null && <><p role="status">{busy ? 'Uploading selected artwork…' : `Verify submission ${active + 1} of ${attempts.length}`}</p><Turnstile key={challenge} siteKey={config.turnstileSiteKey} onToken={token} onError={verificationError} /></>}
    {error && <p role="alert">{error}</p>}
    {attempts.length > 0 && <section className="gallery-submission-results" aria-label="Submission results">
      {attempts.map((a, index) => <article className="gallery-submission-result" key={a.draft.submissionId}><h3>{a.label.label.maker} {a.label.label.blend}</h3><p className="field-hint" role="status">{a.error ?? (a.receipt ? a.receipt.state === 'published' ? 'Your label is available in the gallery.' : a.receipt.state === 'rejected' ? 'Reviewed. This label was not approved for the gallery.' : a.receipt.state === 'unpublished' ? 'This label is no longer public in the gallery.' : 'Submitted for review. Your label will appear in the gallery once approved.' : active === index ? 'Submitting this label…' : active !== null && index > active ? 'Waiting to submit.' : 'Submission not confirmed. Retry to finish sharing this label.')}</p>{(!a.receipt || a.error) && a.retryable !== false && active === null && <button className="button quiet" disabled={busy} onClick={() => { setActive(index); setChallenge(value => value + 1); setError('') }}>Retry this label</button>}</article>)}
    </section>}
  </section>
}
