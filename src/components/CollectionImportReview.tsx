import { useEffect, useRef, useState } from 'react'
import type { Collection, ImportDecisions, ImportPlan } from '../lib/collection'

export function CollectionImportReview({ collection, plan, decisions, onChange, onAccept, onCancel, busy, invalidated = false, onRefresh }: {
  collection: Collection; plan: ImportPlan; decisions: ImportDecisions; onChange: (next: ImportDecisions) => void; onAccept: () => void; onCancel: () => void; busy: boolean;
  invalidated?: boolean; onRefresh?: () => void;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const next = Object.fromEntries(plan.candidate.designs.map(design => [design.id, URL.createObjectURL(new Blob([design.item.artwork.data], { type: design.item.artwork.mediaType }))]))
    // Object URLs are browser resources with an explicit effect lifetime.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls(next)
    return () => Object.values(next).forEach(url => URL.revokeObjectURL(url))
  }, [plan.candidate])
  useEffect(() => { title.current?.focus() }, [plan.candidate.receipt.id])
  const added = Object.values(decisions).filter(decision => decision.action !== 'skip').length
  return <section className="panel import-review" aria-labelledby="import-review-title">
    <h2 ref={title} tabIndex={-1} id="import-review-title">Add your new labels</h2>
    <p>Review {plan.candidate.receipt.title}. Your existing labels and quantities stay unless you choose a replacement.</p>
    {invalidated && <div role="alert"><p>Your saved labels changed while you were reviewing this ZIP. Check the updated choices before adding anything.</p><button type="button" className="button secondary" onClick={onRefresh} disabled={busy}>Review updated choices</button></div>}
    <div className="import-review-grid">{plan.entries.map((entry, index) => {
      const design = plan.candidate.designs.find(item => item.id === entry.designId)!
      const decision = decisions[entry.designId] ?? { action: 'skip' }
      return <article key={`${entry.designId}-${index}`} className="import-review-label">
        <img src={urls[entry.designId]} alt={`${design.item.label.maker} ${design.item.label.blend} returned artwork`} width={160} height={160} />
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
    <div className="handoff-actions">
      <button type="button" className="button primary" disabled={busy || invalidated} onClick={onAccept}>{busy ? 'Saving labels…' : added ? `Add ${added} ${added === 1 ? 'label' : 'labels'}` : 'Keep current labels'}</button>
      <button type="button" className="button quiet" disabled={busy} onClick={onCancel}>Cancel import</button>
    </div>
  </section>
}
