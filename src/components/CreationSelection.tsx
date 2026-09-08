import { useEffect, useRef, useState } from 'react'
import type { PreparationRow } from './PreparationWorkspace'

export function CreationSelection({ rows, busy, onSave, onClose }: {
  rows: PreparationRow[]; busy?: boolean; onSave: (ids: string[]) => Promise<void>; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [selected, setSelected] = useState(() => rows.filter(row => row.createRequested || !row.artwork).map(row => row.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const modal = dialog.current!
    modal.showModal(); heading.current?.focus()
    return () => { modal.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  const save = async () => {
    setSaving(true); setError('')
    try { await onSave(selected); onClose() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Your choices could not be saved. Try again.') }
    finally { setSaving(false) }
  }
  return <dialog ref={dialog} className="import-review-dialog creation-selection" aria-labelledby="creation-selection-title" aria-describedby="creation-selection-description" onCancel={event => { event.preventDefault(); if (!busy && !saving) onClose() }}>
    <header className="import-review-header"><h2 id="creation-selection-title" ref={heading} tabIndex={-1}>Choose artwork to create</h2><p id="creation-selection-description">Choose the labels to include in your AI request. Selecting a label with artwork leaves its current design off the print sheet. You can restore it later.</p></header>
    <div className="import-review-body">
      <p className="field-hint">Labels without artwork are checked to start. Uncheck any you want to find in the community instead.</p>
      <div className="creation-targets">{rows.map(row => <label key={row.id}><input type="checkbox" checked={selected.includes(row.id)} disabled={busy || saving} onChange={event => setSelected(ids => event.target.checked ? [...ids, row.id] : ids.filter(id => id !== row.id))} /><span><strong>{row.blend}</strong><small>{row.maker}{row.maker ? ' · ' : ''}{row.artwork ? 'Replace this design; save it for restoring' : row.previousDesignId ? 'Previous design saved; uncheck to restore' : 'Needs artwork'}</small></span></label>)}</div>
      {error && <p role="alert">{error}</p>}
    </div>
    <footer className="import-review-actions"><button className="button primary" disabled={busy || saving} type="button" onClick={() => void save()}>{saving ? 'Saving choices…' : selected.length ? `Continue with ${selected.length} ${selected.length === 1 ? 'label' : 'labels'}` : 'Clear creation request'}</button><button className="button quiet" type="button" disabled={busy || saving} onClick={onClose}>Cancel</button></footer>
  </dialog>
}
