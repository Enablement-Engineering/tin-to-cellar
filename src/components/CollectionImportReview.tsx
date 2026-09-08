import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Collection, ImportDecisions, ImportPlan } from '../lib/collection'

export function CollectionImportReview({ collection, plan, decisions, onChange, onAccept, onCancel, onReplace, children, error, busy, invalidated = false, onRefresh, unresolvedRequests = [] }: {
  collection: Collection; plan: ImportPlan; decisions: ImportDecisions; onChange: (next: ImportDecisions) => void; onAccept: () => void; onCancel: () => void; busy: boolean;
  invalidated?: boolean; onRefresh?: () => void; onReplace?: () => void; children?: ReactNode; error?: string; unresolvedRequests?: string[];
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [previewError, setPreviewError] = useState(false)
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [showNew, setShowNew] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const allocated: string[] = []
    try {
      const previews = new Map(plan.candidate.designs.map(design => [design.id, design]))
      for (const entry of plan.entries) {
        if (entry.kind !== 'choice') continue
        for (const rowId of entry.matchRowIds) {
          const designId = collection.rows.find(row => row.id === rowId)?.designId
          if (designId && collection.designs[designId]) previews.set(designId, collection.designs[designId])
        }
      }
      const next = Object.fromEntries([...previews.values()].map(design => {
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
  }, [plan.candidate, plan.entries, collection.rows, collection.designs, previewAttempt])
  useEffect(() => {
    const modal = dialog.current!
    const previous = document.activeElement as HTMLElement | null
    modal.showModal()
    title.current?.focus()
    return () => { modal.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  const newCount = plan.entries.filter(entry => entry.kind === 'add').length
  const fillCount = plan.entries.filter(entry => entry.kind === 'fill').length
  const duplicateCount = plan.entries.filter(entry => entry.kind === 'duplicate').length
  const attentionCount = plan.entries.length - newCount - fillCount - duplicateCount
  const added = plan.entries.filter(entry => entry.kind !== 'duplicate' && decisions[entry.designId] && decisions[entry.designId].action !== 'skip').length
  const updating = plan.entries.some(entry => entry.kind === 'choice' && decisions[entry.designId]?.action === 'replace')
  return <dialog ref={dialog} className="import-review-dialog" aria-labelledby="import-review-title" aria-describedby="import-review-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    <header className="import-review-header">
    <h2 ref={title} tabIndex={-1} id="import-review-title">Add your new labels</h2>
    <p id="import-review-description">New blends will be added to your labels. If you already have artwork for a blend, choose which design to keep.</p>
    <p className="import-review-summary">{newCount} new {newCount === 1 ? 'design' : 'designs'}{fillCount > 0 ? ` · ${fillCount} ${fillCount === 1 ? 'request' : 'requests'} ready` : ''}{attentionCount > 0 ? ` · ${attentionCount} ${attentionCount === 1 ? 'blend' : 'blends'} to review` : ''}{duplicateCount > 0 ? ` · ${duplicateCount} already saved` : ''}. Your quantities stay the same.</p>
    </header>
    <div className="import-review-body">
    {unresolvedRequests.length > 0 && <p className="import-request-coverage">New artwork will still be needed for: {unresolvedRequests.join(', ')}. These requests will stay in your labels.</p>}
    {error && <p role="alert">{error}</p>}
    {children && <details className="import-validation"><summary>Validation checks</summary>{children}</details>}
    {newCount > 0 && <button type="button" className="button quiet" aria-expanded={showNew} onClick={() => setShowNew(value => !value)}>{showNew ? 'Hide new designs' : `Review ${newCount} new ${newCount === 1 ? 'design' : 'designs'}`}</button>}
    {duplicateCount > 0 && <button type="button" className="button quiet" aria-expanded={showDuplicates} onClick={() => setShowDuplicates(value => !value)}>{showDuplicates ? 'Hide already saved designs' : `Show ${duplicateCount} already saved ${duplicateCount === 1 ? 'design' : 'designs'}`}</button>}
    {previewError && <div role="alert"><p>Artwork previews could not be opened. Your import and choices are still available.</p><button type="button" className="button secondary" disabled={busy} onClick={event => {
      if (document.activeElement === event.currentTarget) title.current?.focus()
      setPreviewAttempt(value => value + 1)
    }}>Retry previews</button></div>}
    {invalidated && <div role="alert"><p>Your saved labels changed while you were reviewing this ZIP. Check the updated choices before adding anything.</p><button type="button" className="button secondary" onClick={onRefresh} disabled={busy}>Review updated choices</button></div>}
    <div className="import-review-grid">{plan.entries.map((entry, index) => {
      const design = plan.candidate.designs.find(item => item.id === entry.designId)!
      const decision = decisions[entry.designId] ?? { action: 'skip' }
      return <article key={`${entry.designId}-${index}`} className="import-review-label" hidden={entry.kind === 'add' && !showNew || entry.kind === 'duplicate' && !showDuplicates}>
        <div className="import-artwork-previews">
          {entry.kind === 'choice' && entry.matchRowIds.map(rowId => {
            const row = collection.rows.find(row => row.id === rowId)!
            return row.designId && urls[row.designId] ? <figure key={rowId}><img src={urls[row.designId]} alt={`${row.maker} ${row.blend} current artwork`} width={120} height={120} /><figcaption>Current{entry.matchRowIds.length > 1 ? ` · label ${collection.rows.indexOf(row) + 1}` : ''}</figcaption></figure> : null
          })}
          {urls[entry.designId] && <figure><img src={urls[entry.designId]} alt={`${design.item.label.maker} ${design.item.label.blend} returned artwork`} width={120} height={120} /><figcaption>{entry.kind === 'choice' ? 'Imported' : 'New artwork'}</figcaption></figure>}
        </div>
        <h3>{design.item.label.maker} {design.item.label.blend}</h3>
        {entry.kind === 'duplicate' ? <p>Already in your labels. No extra copy will be added.</p> : entry.kind !== 'choice' ? <label className="import-simple-choice">
          <input type="checkbox" checked={decision.action !== 'skip'} disabled={busy || invalidated} onChange={event => onChange({ ...decisions, [entry.designId]: !event.target.checked ? { action: 'skip' } : entry.kind === 'fill' ? { action: 'replace', rowId: entry.matchRowIds[0] } : { action: 'add' } })} />
          {entry.kind === 'fill' ? 'Use artwork for this requested blend' : 'Add this label'}
        </label> : <fieldset className="import-design-choices" disabled={busy || invalidated}>
          <legend>Which artwork do you want?</legend>
          <label><input type="radio" name={`import-choice-${index}`} checked={decision.action === 'skip'} onChange={() => onChange({ ...decisions, [entry.designId]: { action: 'skip' } })} />Keep current</label>
          {entry.matchRowIds.map(rowId => {
            const row = collection.rows.find(row => row.id === rowId)!
            return <label key={rowId}><input type="radio" name={`import-choice-${index}`} checked={decision.action === 'replace' && decision.rowId === rowId} onChange={() => onChange({ ...decisions, [entry.designId]: { action: 'replace', rowId } })} />{row.designId ? 'Use imported artwork' : 'Use for requested label'}{entry.matchRowIds.length > 1 ? ` · label ${collection.rows.indexOf(row) + 1}${row.edition ? ` (${row.edition})` : ''}` : ''}</label>
          })}
          <label><input type="radio" name={`import-choice-${index}`} checked={decision.action === 'add'} onChange={() => onChange({ ...decisions, [entry.designId]: { action: 'add' } })} />Keep both</label>
          <p className="field-hint">{decision.action === 'skip' ? 'Your current artwork stays unchanged.' : decision.action === 'add' ? 'Add the imported artwork as a separate label, with quantity 1.' : 'Change only the artwork. Keep your quantity.'}</p>
        </fieldset>}
      </article>
    })}</div>
    {onReplace && collection.rows.length > 0 && plan.candidate.designs.length > 0 && <details className="import-replace-option"><summary>Start over with this pack instead</summary>
      <button type="button" className="button secondary" disabled={busy || invalidated} onClick={() => {
        const count = plan.candidate.designs.length
        if (window.confirm(`Replace all saved labels and requests with the ${count} checked ${count === 1 ? 'design' : 'designs'} in this pack? Quantities and print settings will reset. Import reports will stay. Download your current labels first if you want to keep their artwork. This cannot be undone.`)) onReplace()
      }}>Replace saved labels with this pack</button>
      <p className="field-hint">Start with only this pack’s checked artwork, one of each design. Your current labels and requests will be removed; import reports will stay.</p>
    </details>}
    </div>
    <footer className="import-review-actions"><button type="button" className="button primary" disabled={busy || invalidated} onClick={onAccept}>{added ? updating ? 'Apply changes' : `Add ${added} ${added === 1 ? 'label' : 'labels'}` : 'Keep current labels'}</button><button type="button" className="button quiet" disabled={busy} onClick={onCancel}>Cancel import</button></footer>
  </dialog>
}
