import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CreationSelection } from './CreationSelection'
import { RowNotes, type PreparationRow } from './PreparationWorkspace'
import '../styles/artwork-creation.css'

export function ArtworkCreationFlow({ rows, allRows, requestKey, copied, generic, busy, handoff, intake, onBack, onEdit, onNotes, onCancel }: {
  rows: PreparationRow[]; allRows: PreparationRow[]; requestKey: string; copied: boolean; generic: boolean; busy: boolean
  handoff: ReactNode; intake: ReactNode; onBack: () => void
  onEdit: (ids: string[]) => Promise<void>; onNotes: (id: string, notes: string) => Promise<void>; onCancel: (id: string) => Promise<void>
}) {
  const [reviewedKey, setReviewedKey] = useState<string | null>(null)
  const [editingRequest, setEditingRequest] = useState(false)
  const [editing, setEditing] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [error, setError] = useState('')
  const copyStep = useRef<HTMLDivElement>(null)
  const returnHeading = useRef<HTMLHeadingElement>(null)
  const focusCopy = useRef(false)
  const reviewed = !editingRequest && (copied || reviewedKey === requestKey)
  // Remember review when a restored copied handoff is replaced with updated instructions.
  if (copied && reviewedKey !== requestKey) setReviewedKey(requestKey)
  useEffect(() => {
    if (reviewed && focusCopy.current) {
      const heading = copyStep.current?.querySelector<HTMLElement>('h2')
      if (heading) { focusCopy.current = false; heading.focus(); heading.scrollIntoView({ block: 'start' }) }
    }
  }, [reviewed, handoff])
  const openReturn = () => { setImportOpen(true); returnHeading.current?.focus(); returnHeading.current?.scrollIntoView({ block: 'start' }) }
  const cancel = async (id: string) => {
    setError('')
    try { await onCancel(id) } catch (failure) { setError(failure instanceof Error ? failure.message : 'Your selection could not be saved. Try again.') }
  }
  return <section className="artwork-creation-page screen-only" aria-labelledby="creation-flow-title">
    <button type="button" className="button quiet creation-back" onClick={onBack}>Back to your labels</button>
    <header className="page-heading"><h1 id="creation-flow-title">Create artwork</h1><p>Prepare instructions for your AI chat to adapt the packaging you want. Return with the finished label ZIP to print it here.</p></header>
    {!rows.length && !generic ? <div className="panel"><h2>Choose labels for new artwork</h2><p>Go to your labels and choose which blends need new designs.</p><button className="button primary" onClick={onBack}>Go to your labels</button></div> : <>
      <section className="panel creation-review" aria-labelledby="creation-review-title">
        <div className="creation-step-heading"><span className="creation-step-number" aria-hidden="true">1</span><h2 id="creation-review-title">Review your request</h2></div>
        {reviewed ? <><p>{rows.length ? `${rows.length} ${rows.length === 1 ? 'label' : 'labels'} in this request: ${rows.map(row => row.blend).join(', ')}.` : 'Choose your blends in the AI chat.'}</p><button className="button quiet" onClick={() => setEditingRequest(true)} disabled={busy}>Edit request</button></> : <>
          <p>{generic ? 'Tell your AI which blends to make after pasting the instructions.' : 'Check the blend names. Use Design notes to request a particular edition or detail from the packaging.'}</p>
          <ul className="creation-review-list" aria-label="Requested artwork">{rows.map(row => <li key={row.id}>
            <div className="creation-request-row"><div><strong>{row.blend}</strong><span>{row.maker}</span>{row.previousDesignId && <small>Previous design saved · left off the print sheet</small>}</div><button className="button quiet" disabled={busy} onClick={() => void cancel(row.id)}>{row.previousDesignId ? 'Use previous design' : 'Cancel new artwork request'}</button></div>
            <details className="creation-notes"><summary>Design notes{row.notes ? ' · added' : ' · optional'}</summary><RowNotes row={row} onNotes={onNotes} /></details>
          </li>)}</ul>
          <div className="creation-review-actions"><button className="button primary" disabled={busy} onClick={() => { focusCopy.current = true; setEditingRequest(false); setReviewedKey(requestKey) }}>{rows.length ? `Continue with ${rows.length} ${rows.length === 1 ? 'label' : 'labels'}` : 'Continue to instructions'}</button>{rows.length > 0 && <button className="button quiet" disabled={busy} onClick={() => setEditing(true)}>Edit creation list</button>}</div>
        </>}
        {error && <p role="alert">{error}</p>}
      </section>
      <div ref={copyStep} className="creation-copy-step">{reviewed ? handoff : <section className="creation-upcoming" aria-labelledby="creation-copy-title"><div className="creation-step-heading"><span className="creation-step-number" aria-hidden="true">2</span><h2 id="creation-copy-title">Create in your AI chat</h2></div><p>Review your request above to get the instructions.</p></section>}</div>
    </>}
    <section className="panel creation-return" aria-labelledby="creation-return-title">
      <div className="creation-step-heading"><span className="creation-step-number" aria-hidden="true">3</span><h2 ref={returnHeading} tabIndex={-1} id="creation-return-title">Bring back your artwork</h2></div>
      <p>Download the label ZIP from your chat and import it here. Review each design before adding it to your saved labels.</p>
      {importOpen || copied ? intake : <button className="button secondary" onClick={openReturn}>I already have a finished ZIP</button>}
    </section>
    {editing && <CreationSelection rows={allRows} busy={busy} onSave={async ids => { await onEdit(ids); setReviewedKey(null) }} onClose={() => setEditing(false)} />}
  </section>
}
