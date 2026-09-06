import { useEffect, useRef, useState } from 'react'
import { matchOrder, readOrderPdf, type OrderMatch } from '../lib/order-import'
import { Icon } from './Icons'

export function OrderImporter({ onAdd }: { onAdd: (names: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [matches, setMatches] = useState<OrderMatch[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [filename, setFilename] = useState('')
  const [dragging, setDragging] = useState(false)
  const request = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => () => { request.current++; controller.current?.abort() }, [])
  const cancel = () => { request.current++; controller.current?.abort(); setBusy(false); setMessage('Import cancelled.') }
  const review = (value: string) => {
    const found = matchOrder(value)
    setMatches(found); setSelected(found.map((match) => match.suggestions.length === 1 ? match.suggestions[0] : ''))
    setMessage(found.length ? `${found.length} possible ${found.length === 1 ? 'match. Choose the tobacco' : 'matches. Choose the tobaccos'} to add.` : 'No catalog matches found. Try a clearer file or type names in the tobacco field.')
  }
  const load = async (file: File) => {
    if (busy) return
    const ticket = ++request.current
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setBusy(true); setFilename(file.name); setMatches([]); setSelected([]); setText(''); setDragging(false)
    const timeout = window.setTimeout(() => abort.abort(), 90000)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MB.')
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      setMessage(isPdf ? 'Reading PDF on your device…' : 'Loading screenshot reader…')
      const value = isPdf ? await readOrderPdf(file) : await (await import('../lib/order-import/ocr')).readOrderImage(file, (progress) => { if (ticket === request.current) setMessage(`Reading screenshot… ${progress}%`) }, abort.signal)
      if (ticket !== request.current) return
      if (abort.signal.aborted) throw new Error('Reading timed out. Try a smaller image cropped to the product list.')
      review(value)
    } catch (error) {
      if (ticket === request.current) setMessage(abort.signal.aborted ? 'Reading timed out. Try a smaller image cropped to the product list.' : error instanceof Error ? error.message : 'Could not read this file.')
    } finally { clearTimeout(timeout); if (ticket === request.current) setBusy(false) }
  }
  return <div className="order-import">
    <button type="button" className="order-import-trigger" aria-label={open ? 'Close order import' : 'Import order'} aria-expanded={open} onClick={() => { if (busy) cancel(); setOpen(!open) }}>
      <span className="order-import-symbol"><Icon name="upload" size={21} /></span>
      <span><strong>{open ? 'Close order import' : 'Import order'}</strong><small>PDF, screenshot, or pasted text</small></span>
      <span className="order-import-toggle" aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="order-import-panel" aria-busy={busy}>
      <input ref={input} className="visually-hidden" tabIndex={-1} aria-label="Order file" type="file" accept="application/pdf,.pdf,image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void load(file) }} />
      <button type="button" className={`order-file-drop${dragging ? ' is-dragging' : ''}`} disabled={busy} onClick={() => input.current?.click()} onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const files = event.dataTransfer.files; if (files.length !== 1) { setMessage('Choose one order file at a time.'); return } void load(files[0]) }}>
        <Icon name="file" size={28} /><strong>{busy ? 'Reading your order…' : 'Choose a file or drop it here'}</strong><span>PDF · PNG · JPEG · WebP · up to 10 MB</span>
      </button>
      <p className="order-local-note"><Icon name="lock" size={13} /> Files stay on your device. Screenshot reading may take a moment.</p>
      {filename && <p className="order-filename">{filename}</p>}
      <p role="status" className="field-hint">{message}</p>
      {busy && <button type="button" className="button quiet" onClick={cancel}>Cancel reading</button>}
      {!filename && <><label className="field"><span>Or paste your order</span><textarea aria-label="Order text" rows={3} maxLength={100000} value={text} disabled={busy} placeholder="Paste the product list from your order email…" onChange={(event) => { setText(event.target.value); setMatches([]); setSelected([]); setMessage('') }} /></label>
      <button className="button secondary" type="button" disabled={busy || !text.trim()} onClick={() => { try { review(text) } catch (error) { setMessage((error as Error).message) } }}>Find tobaccos</button></>}
      {matches.length > 0 && <div className="order-review">{matches.map((match, index) => <label className="field" key={`${index}-${match.source}`}><span>{match.source}</span><select aria-label={`Match for ${match.source}`} value={selected[index]} onChange={(event) => setSelected(selected.map((value, i) => i === index ? event.target.value : value))}>
        <option value="">Skip / choose a match</option>
        {match.suggestions.map((suggestion) => <option key={suggestion} value={suggestion}>{suggestion}</option>)}
        <option value={match.source}>Keep original: {match.source}</option>
      </select></label>)}</div>}
      {matches.length > 0 && <button className="button primary" type="button" disabled={!selected.some(Boolean)} onClick={() => { onAdd([...new Set(selected.filter(Boolean))]); setOpen(false); setText(''); setMatches([]); setSelected([]); setMessage(''); setFilename('') }}>Add selected tobaccos</button>}
    </div>}
  </div>
}
