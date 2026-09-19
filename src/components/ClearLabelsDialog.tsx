import { useEffect, useRef, useState } from 'react'
import { useDialogClose } from '../hooks/useDialogClose'

export function ClearLabelsDialog({ count, busy, onClear, onClose: dismiss, action = 'Clear' }: { action?: 'Clear' | 'Reset'; count: number; busy: boolean; onClear: () => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const onClose = useDialogClose(dialog, dismiss)
  const cancel = useRef<HTMLButtonElement>(null)
  const clearing = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const modal = dialog.current!
    modal.showModal()
    cancel.current?.focus()
    return () => {
      modal.close()
      const target = previous?.isConnected ? previous : document.getElementById('main-content')
      target?.focus({ preventScroll: true })
    }
  }, [])
  const clear = async () => {
    if (busy || clearing.current) return
    clearing.current = true
    setPending(true); setError('')
    try { await onClear(); onClose() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Your labels could not be cleared. Try again.') }
    finally { clearing.current = false; setPending(false) }
  }
  return <dialog ref={dialog} className="import-review-dialog clear-labels-dialog" aria-labelledby="clear-labels-title" aria-describedby="clear-labels-description" onCancel={event => { event.preventDefault(); if (!pending) onClose() }}>
    <div className="import-review-body">
      <h2 id="clear-labels-title">{action} {count === 1 ? '1 label' : `all ${count} labels`} and start over?</h2>
      <p id="clear-labels-description">This removes your saved labels, artwork, creation requests, print settings, and import history from this browser. Download your ready labels first. Downloaded ZIP files are unchanged. This cannot be undone.</p>
      {error && <p role="alert">{error}</p>}
    </div>
    <footer className="import-review-actions">
      <button ref={cancel} className="button secondary" type="button" disabled={pending} onClick={onClose}>Cancel</button>
      <button className="button primary" type="button" disabled={busy || pending} onClick={() => void clear()}>{pending ? (action === 'Reset' ? 'Resetting labels…' : 'Clearing labels…') : `${action} labels`}</button>
    </footer>
  </dialog>
}
