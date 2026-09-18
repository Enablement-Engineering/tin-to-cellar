import { useEffect, useRef } from 'react'
import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { API } from './client'
import { GalleryImage } from './GalleryImage'
import '../../styles/gallery-artwork-preview.css'

export function GalleryArtworkPreview({ label, onClose }: { label: GalleryPublicLabel; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const pressedOutside = useRef(false)
  const artwork = `${API}/labels/${label.id}/artwork`
  const isOutside = (x: number, y: number) => {
    const bounds = dialog.current!.getBoundingClientRect()
    return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom
  }
  useEffect(() => {
    const modal = dialog.current!
    const previous = document.activeElement as HTMLElement | null
    modal.showModal()
    closeButton.current?.focus()
    return () => { modal.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])

  return <dialog ref={dialog} className="gallery-artwork-dialog" aria-labelledby="gallery-artwork-title" onPointerDown={event => { pressedOutside.current = isOutside(event.clientX, event.clientY) }} onClick={event => {
    if (pressedOutside.current && isOutside(event.clientX, event.clientY)) onClose()
    pressedOutside.current = false
  }} onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const controls = event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }}>
    <header className="gallery-artwork-heading">
      <div><h2 id="gallery-artwork-title">{label.blend}</h2><p>{label.maker}</p></div>
      <button ref={closeButton} type="button" className="gallery-artwork-close" aria-label="Close preview" onClick={onClose}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
    </header>
    <GalleryImage className="gallery-artwork-original" src={artwork} preview={`${API}/labels/${label.id}/thumbnail`} alt={label.altText || `${label.maker} ${label.blend} artwork`} errorMessage="The image could not load. Try opening the direct image link." />
    <footer className="gallery-artwork-footer"><a href={artwork} target="_blank" rel="noreferrer">Open original image <span className="gallery-artwork-new-tab">(new tab)</span><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6m0-6L10 14M10 4H4v16h16v-6" /></svg></a></footer>
  </dialog>
}
