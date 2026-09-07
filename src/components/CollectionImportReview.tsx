import { useEffect, useRef, useState } from 'react'
import type { Collection, ImportDecisions, ImportPlan } from '../lib/collection'

export function CollectionImportReview({ collection, plan, decisions, onChange, onAccept, onCancel, onReplace, busy, invalidated = false, onRefresh }: {
  collection: Collection; plan: ImportPlan; decisions: ImportDecisions; onChange: (next: ImportDecisions) => void; onAccept: () => void; onCancel: () => void; busy: boolean;
  invalidated?: boolean; onRefresh?: () => void; onReplace?: () => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [previewError, setPreviewError] = useState(false)
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [showNew, setShowNew] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const allocated: string[] = []
    try {
      const next = Object.fromEntries(plan.candidate.designs.map(design => {
        const url = URL.createObjectURL(new Blob([design.item.artwork.data], { type: design.item.artwork.mediaType }))
        allocated.push(url)
        return [design.id, url]
      }))
      // Browser resource allocation belongs to the effect lifetime.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrls(next)
      setPreviewError(false)
    } catch {
      allocated.forEach(url => URL.revokeObjectURL(url))
      allocated.length = 0
      setUrls({})
      setPreviewError(true)
    }
    return () => allocated.forEach(url => URL.revokeObjectURL(url))
  }, [plan.candidate, previewAttempt])
  useEffect(() => { title.current?.focus() }, [plan.candidate.receipt.id])
  const newCount = plan.entries.filter(entry => entry.kind === 'add').length
  const attentionCount = plan.entries.length - newCount
  const added = Object.values(decisions).filter(decision => decision.action !== 'skip').length
  return <section className="panel import-review" aria-labelledby="import-review-title">
    <h2 ref={title} tabIndex={-1} id="import-review-title">Add your new labels</h2>
    <p>Review {plan.candidate.receipt.title}. Your existing labels and quantities stay unless you choose a replacement.</p>
    <p className="import-review-summary">{newCount} new {newCount === 1 ? 'design' : 'designs'}{attentionCount > 0 ? ` · ${attentionCount} ${attentionCount === 1 ? 'match' : 'matches'} to review` : ''}. Additions will appear in your print sheet.</p>
    <div className="import-review-actions"><button type="button" className="button primary" disabled={busy || invalidated} onClick={onAccept}>{added ? `Add ${added} ${added === 1 ? 'label' : 'labels'}` : 'Keep current labels'}</button><button type="button" className="button quiet" disabled={busy} onClick={onCancel}>Cancel import</button></div>
    {onReplace && collection.rows.length > 0 && plan.candidate.designs.length > 0 && <div className="import-replace-option">
      <button type="button" className="button secondary" disabled={busy || invalidated} onClick={() => {
        const count = plan.candidate.designs.length
        if (window.confirm(`Replace all saved labels and requests with the ${count} checked ${count === 1 ? 'design' : 'designs'} in this pack? Quantities and print settings will reset. Import reports will stay. Download your current labels first if you want to keep their artwork. This cannot be undone.`)) onReplace()
      }}>Replace saved labels with this pack</button>
      <p className="field-hint">Start with only this pack’s checked artwork, one of each design. Your current labels and requests will be removed; import reports will stay.</p>
    </div>}
    {newCount > 0 && <button type="button" className="button quiet" aria-expanded={showNew} onClick={() => setShowNew(value => !value)}>{showNew ? 'Hide new designs' : `Review ${newCount} new ${newCount === 1 ? 'design' : 'designs'}`}</button>}
    {previewError && <div role="alert"><p>Artwork previews could not be opened. Your import and choices are still available.</p><button type="button" className="button secondary" disabled={busy} onClick={event => {
      if (document.activeElement === event.currentTarget) title.current?.focus()
      setPreviewAttempt(value => value + 1)
    }}>Retry previews</button></div>}
    {invalidated && <div role="alert"><p>Your saved labels changed while you were reviewing this ZIP. Check the updated choices before adding anything.</p><button type="button" className="button secondary" onClick={onRefresh} disabled={busy}>Review updated choices</button></div>}
    <div className="import-review-grid">{plan.entries.map((entry, index) => {
      const design = plan.candidate.designs.find(item => item.id === entry.designId)!
      const decision = decisions[entry.designId] ?? { action: 'skip' }
      return <article key={`${entry.designId}-${index}`} className="import-review-label" hidden={entry.kind === 'add' && !showNew}>
        {urls[entry.designId] && <img src={urls[entry.designId]} alt={`${design.item.label.maker} ${design.item.label.blend} returned artwork`} width={160} height={160} />}
        <h3>{design.item.label.maker} {design.item.label.blend}</h3>
        {entry.kind === 'duplicate' ? <p>Already in your labels. No extra copy will be added.</p> : <>
          <label htmlFor={`import-choice-${index}`}>How to add this design</label>
          <select id={`import-choice-${index}`} value={decision.action === 'replace' ? `replace:${decision.rowId}` : decision.action} disabled={busy || invalidated} onChange={event => {
            const value = event.target.value
            onChange({ ...decisions, [entry.designId]: value.startsWith('replace:') ? { action: 'replace', rowId: value.slice(8) } : { action: value as 'add' | 'skip' } })
          }}>
            <option value="skip">{entry.matchRowIds.length ? 'Keep current / skip new design' : 'Skip'}</option>
            <option value="add">{entry.matchRowIds.length ? 'Keep both as separate labels' : 'Add as another label'}</option>
            {collection.rows.map((row, rowIndex) => <option key={row.id} value={`replace:${row.id}`}>{row.designId ? 'Use new for' : 'Use for'} {row.maker} {row.blend}{row.edition ? ` (${row.edition})` : ''} · label {rowIndex + 1}</option>)}
          </select>
        </>}
      </article>
    })}</div>

  </section>
}
