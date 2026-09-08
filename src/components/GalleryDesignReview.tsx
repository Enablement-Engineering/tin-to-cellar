import { useEffect, useRef, useState } from 'react'
import type { CollectionDesign } from '../lib/collection'
import type { PrintLabel } from './ui-model'
import { LabelArtwork } from './LabelArtwork'

export function GalleryDesignReview({ current, incoming, busy, invalidated, error, onReplace, onAdd, onCancel }: {
  current: PrintLabel; incoming: CollectionDesign; busy: boolean; invalidated?: boolean; error: string
  onReplace: () => void; onAdd: () => void; onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null)
  const [url, setUrl] = useState('')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, modal = dialog.current!
    modal.showModal(); heading.current?.focus()
    return () => { modal.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    let imageUrl = ''
    try {
      imageUrl = URL.createObjectURL(new Blob([incoming.item.artwork.data], { type: incoming.item.artwork.mediaType }))
      // Display the browser resource allocated for this effect's lifetime.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(imageUrl)
    }
    catch { setUrl('') }
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl) }
  }, [incoming])
  return <dialog ref={dialog} className="import-review-dialog gallery-design-review" aria-labelledby="gallery-design-review-title" aria-describedby="gallery-design-review-description" onCancel={event => { event.preventDefault(); if (!busy) onCancel() }}>
    <header className="import-review-header"><h2 ref={heading} tabIndex={-1} id="gallery-design-review-title">Choose a design for {current.blend}</h2><p id="gallery-design-review-description">Replace your current artwork and keep its quantity, or add the new design as a separate label.</p></header>
    <div className="import-review-body"><div className="gallery-design-comparison"><figure><div className="label-thumbnail"><LabelArtwork label={current} /></div><figcaption>Current design</figcaption></figure><figure>{url ? <img src={url} alt={`${incoming.item.label.blend} selected artwork`} /> : <p>Preview unavailable</p>}<figcaption>Selected design</figcaption></figure></div>{error && <p role="alert">{error}</p>}</div>
    <footer className="import-review-actions"><button type="button" className="button primary" disabled={busy || invalidated} onClick={onReplace}>Replace design</button><button type="button" className="button secondary" disabled={busy || invalidated} onClick={onAdd}>Add separately</button><button type="button" className="button quiet" disabled={busy} onClick={onCancel}>Cancel</button></footer>
  </dialog>
}
