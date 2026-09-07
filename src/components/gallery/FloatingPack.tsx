import { createPortal } from 'react-dom'
import { useRef, useState } from 'react'
import { MAX_PACK_LABELS, type PackChoice } from './pack-selection'
export function FloatingPack({ selected, busy, assembling, onRemove, onClear, onCreate }: {
  selected: PackChoice[]; busy: boolean; assembling: boolean
  onRemove: (id: string) => void; onClear: () => void; onCreate: (print: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const expanded = open && selected.length > 0
  const close = () => { setOpen(false); toggle.current?.focus({ preventScroll: true }) }
  return createPortal(<section className="gallery-pack-floating screen-only" aria-label="Your pack" onKeyDown={event => {
    if (event.key === 'Escape' && expanded) { event.stopPropagation(); close() }
  }}>
    <button ref={toggle} className="button primary gallery-pack-toggle" aria-expanded={expanded} aria-controls="gallery-pack-panel" onClick={() => setOpen(!expanded)}>
      <span aria-live="polite">Your pack · {selected.length} {selected.length === 1 ? 'label' : 'labels'}</span><span aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    <div id="gallery-pack-panel" className="gallery-pack-tray" hidden={!expanded}>
      <div className="gallery-pack-heading"><h2>Selected labels</h2><button className="button quiet" disabled={assembling} onClick={() => { onClear(); close() }}>Clear pack</button></div>
      <ul className="gallery-pack-items">{selected.map(label => <li key={label.id}><span>{label.maker} · {label.blend}</span><button className="button quiet" disabled={assembling} aria-label={`Remove ${label.maker} ${label.blend} from pack`} onClick={() => { onRemove(label.id); toggle.current?.focus({ preventScroll: true }) }}>Remove</button></li>)}</ul>
      <div className="gallery-actions"><button className="button primary" disabled={busy || assembling} onClick={() => onCreate(true)}>Print selected labels</button><button className="button secondary" disabled={busy || assembling} onClick={() => onCreate(false)}>Download pack</button></div>
      <p className="field-hint">Choose quantities on the print screen. Up to {MAX_PACK_LABELS} designs per pack.</p>
      {assembling && <p role="status">Preparing your pack…</p>}
    </div>

  </section>, document.body)
}
