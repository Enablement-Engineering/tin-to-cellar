import { useEffect, useId, useRef, useState } from 'react'
import { matchOrder, readOrderPdf, type OrderMatch } from '../lib/order-import'
import { Icon } from './Icons'
import { formatTobacco, searchTobaccos, TOBACCO_CATALOG } from '../lib/tobacco-catalog'
import type { PreparationIdentity, PreparationRow } from './PreparationWorkspace'

type OrderImporterProps = {
  onAdd: (identities: PreparationIdentity[]) => void | Promise<void>
  standalone?: boolean
  busy?: boolean
  rows?: PreparationRow[]
}

// Only an explicitly reviewed catalog suggestion carries a catalog identity.
function reviewedIdentities(matches: OrderMatch[], selected: string[]): PreparationIdentity[] {
  return [...new Set(selected.filter(Boolean))].map(name => {
    const wasSuggestion = matches.some(match => match.suggestions.includes(name))
    const entry = wasSuggestion ? TOBACCO_CATALOG.find(item => formatTobacco(item) === name) : undefined
    return entry ? { catalogId: entry.id, maker: entry.maker, blend: entry.blend } : { catalogId: null, maker: '', blend: name }
  })
}

export function OrderImporter({ onAdd, standalone = false, busy: externalBusy = false, rows = [] }: OrderImporterProps) {
  const panelId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const fileTrigger = useRef<HTMLButtonElement>(null)
  const manualInput = useRef<HTMLInputElement>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const focusReview = useRef(false)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [matches, setMatches] = useState<OrderMatch[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [reading, setReading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [message, setMessage] = useState('')
  const [filename, setFilename] = useState('')
  const [fileFailed, setFileFailed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [manual, setManual] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const request = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const busy = reading || adding || externalBusy
  const identities = reviewedIdentities(matches, selected)
  const existingCount = identities.filter(identity => rows.some(row => row.catalogId === identity.catalogId && row.maker === identity.maker && row.blend === identity.blend && !row.edition && !row.notes)).length
  const manualMatches = manual.trim() ? searchTobaccos(manual, 5) : []
  useEffect(() => () => { request.current++; controller.current?.abort() }, [])
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl) }, [sourceUrl])
  useEffect(() => {
    if (focusReview.current && matches.length > 0 && reviewHeading.current) {
      focusReview.current = false
      reviewHeading.current.focus()
      reviewHeading.current.scrollIntoView?.({ block: 'start' })
    }
  }, [matches])
  const cancel = () => { request.current++; controller.current?.abort(); setReading(false); setMessage('Import cancelled.') }
  const review = (value: string) => {
    const found = matchOrder(value)
    focusReview.current = standalone && found.length > 0
    setSourceText(value)
    setMatches(found); setSelected(found.map(match => match.suggestions.length === 1 ? match.suggestions[0] : ''))
    setAddError('')
    setMessage(found.length ? `${found.length} possible ${found.length === 1 ? 'match. Choose the blend' : 'matches. Choose the blends'} to add.` : 'No matching blends found. Paste a clearer product list or enter the names manually.')
  }
  const load = async (file: File) => {
    if (busy) return
    const ticket = ++request.current
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setReading(true); setFilename(file.name); setFileFailed(false); setMatches([]); setSelected([]); setText(''); setSourceText(''); setSourceUrl(''); setDragging(false); setAddError('')
    const timeout = window.setTimeout(() => abort.abort(), 90000)
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MB.')
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
      setMessage(isPdf ? 'Reading PDF on your device…' : 'Loading screenshot reader…')
      const value = isPdf ? await readOrderPdf(file, abort.signal) : await (await import('../lib/order-import/ocr')).readOrderImage(file, progress => { if (ticket === request.current) setMessage(`Reading screenshot… ${progress}%`) }, abort.signal)
      if (ticket !== request.current) return
      if (abort.signal.aborted) throw new Error('Reading timed out. Try a smaller image cropped to the product list.')
      review(value)
      setSourceUrl(standalone && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '')
    } catch (error) {
      if (ticket === request.current) {
        setFileFailed(true)
        setMessage(abort.signal.aborted ? 'Reading timed out. Try a smaller image cropped to the product list.' : error instanceof Error ? error.message : 'Could not read this file.')
      }
    } finally { clearTimeout(timeout); if (ticket === request.current) setReading(false) }
  }
  const addManual = (name: string, catalog: boolean) => {
    if (busy || !name.trim()) return
    if (matches.length >= 100) { setMessage('Review up to 100 blends at a time. Save these before adding more.'); return }
    setMatches(current => [...current, { source: name, suggestions: catalog ? [name] : [] }])
    setSelected(current => [...current, name])
    setManual(''); setAddError(''); setMessage(`${name} added to your review. Save when your list is complete.`)
    manualInput.current?.focus()
  }
  const clearReview = () => {
    setText(''); setSourceText(''); setSourceUrl(''); setMatches([]); setSelected([]); setMessage(''); setFilename(''); setFileFailed(false); setManual(''); setManualOpen(false); setAddError('')
  }
  const save = async () => {
    if (busy || !identities.length) return
    setAdding(true); setAddError('')
    try {
      const saved = onAdd(identities)
      if (saved) await saved
      clearReview(); setOpen(false); trigger.current?.focus()
    } catch (failure) { setAddError(failure instanceof Error ? failure.message : 'These blends could not be saved.') }
    finally { setAdding(false) }
  }
  const paste = <><label className="field"><span>Paste a blend list</span><textarea aria-label="Blend list" rows={4} maxLength={100000} value={text} disabled={busy} placeholder="Paste maker and blend names from an email, spreadsheet, or your notes…" onChange={event => { setText(event.target.value); setMatches([]); setSelected([]); setSourceText(''); setMessage(''); setAddError('') }} /></label>
    <button className="button secondary" type="button" disabled={busy || !text.trim()} onClick={() => { try { review(text); setFilename(''); setSourceUrl('') } catch (error) { setMessage((error as Error).message) } }}>Find blends</button></>
  return <div className={`order-import${standalone ? ' order-import-standalone' : ''}`}>
    {!standalone && <button type="button" className="order-import-trigger" ref={trigger} aria-controls={open ? panelId : undefined} aria-label={open ? 'Close blend import' : 'Add several blends'} aria-expanded={open} onClick={() => { if (reading) cancel(); setOpen(!open) }} disabled={adding || externalBusy}>
      <span className="order-import-symbol"><Icon name="upload" size={21} /></span>
      <span><strong>{open ? 'Close blend import' : 'Add several blends'}</strong><small>PDF, screenshot, or pasted text</small></span>
      <span className="order-import-toggle" aria-hidden="true">{open ? '−' : '+'}</span>
    </button>}
    {(standalone || open) && <div className="order-import-panel" id={panelId}>
      <div className="order-intake-source">
        {standalone && <h2>Use an image or PDF</h2>}
        <p className="order-upload-guidance" id={`${panelId}-upload-help`}>Use a screenshot of a recent order, a cellar inventory list, a receipt, or a packing slip. Make sure the maker and blend names are visible.</p>
        <input ref={input} className="visually-hidden" tabIndex={-1} aria-label="Blend list file" type="file" accept="application/pdf,.pdf,image/png,image/jpeg,image/webp" disabled={busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void load(file) }} />
        <button ref={fileTrigger} type="button" aria-describedby={`${panelId}-upload-help ${panelId}-upload-tip`} className={`order-file-drop${dragging ? ' is-dragging' : ''}`} disabled={busy} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); const files = event.dataTransfer.files; if (files.length !== 1) { setMessage('Choose one file at a time.'); return } void load(files[0]) }}>
          <Icon name="file" size={28} /><strong>{reading ? 'Reading your blends…' : 'Choose an image or PDF'}</strong><span className="order-drop-instruction">or drop it here</span><span>PDF · PNG · JPEG · WebP · up to 10 MB</span>
        </button>
        <p className="field-hint" id={`${panelId}-upload-tip`}>Capture the blend names. A shipping label showing only an address and barcode won’t identify your blends.</p>
        <p className="order-local-note"><Icon name="lock" size={13} /> Files are read on this device. Use a screenshot for scanned PDFs.</p>
        {filename && <p className="order-filename">{filename}</p>}
        <p role="status" className="field-hint">{message}</p>
        {reading && <button type="button" className="button quiet" onClick={() => { cancel(); (trigger.current ?? fileTrigger.current)?.focus() }}>Cancel reading</button>}
        {standalone ? <div className="order-paste">{paste}</div> : (!filename || fileFailed) && paste}
        {sourceUrl && <a className="order-original-source" href={sourceUrl} target="_blank" rel="noopener noreferrer">Open original file to check for missing blends</a>}
        {standalone && sourceText && <details className="order-source-reference"><summary>Check the text read from your file</summary><p className="field-hint">Compare with your original file for names the reader may have missed. This text stays here only while you review.</p><pre>{sourceText}</pre></details>}
        {standalone && !matches.length && <button type="button" className="button quiet" onClick={() => { setManualOpen(true); window.requestAnimationFrame(() => manualInput.current?.focus()) }}>Enter blends manually</button>}
      </div>
      {(matches.length > 0 || standalone && manualOpen) && <section className="order-review" aria-labelledby={standalone ? `${panelId}-review` : undefined}>
        {standalone && <><h2 ref={reviewHeading} tabIndex={-1} id={`${panelId}-review`}>Review your blends</h2><p className="field-hint">Check the matches and add anything missing. Quantities in your list do not set print quantities.</p></>}
        {matches.map((match, index) => <label className="field" key={`${index}-${match.source}`}><span>{match.source}</span><select aria-label={`Match for ${match.source}`} value={selected[index]} disabled={busy} onChange={event => setSelected(selected.map((value, i) => i === index ? event.target.value : value))}>
          <option value="">Skip this item</option>
          {match.suggestions.map(suggestion => <option key={suggestion} value={suggestion}>{suggestion}</option>)}
          <option value={match.source}>Use the name as written: {match.source}</option>
        </select></label>)}
        <div className="order-manual-entry">
          <label className="field"><span>Add a missing blend</span><input ref={manualInput} value={manual} maxLength={160} disabled={busy} placeholder="Search by maker or blend…" onChange={event => setManual(event.target.value)} /></label>
          {manual.trim() && <div className="order-manual-choices">{manualMatches.map(entry => <button className="button secondary" type="button" key={entry.id} disabled={busy} onClick={() => addManual(formatTobacco(entry), true)}>{formatTobacco(entry)}</button>)}<button className="button quiet" type="button" disabled={busy} onClick={() => addManual(manual.trim(), false)}>Use “{manual.trim()}” as a custom name</button></div>}
        </div>
        {addError && <p role="alert">{addError} Your reviewed choices are still here. Try saving them again.</p>}
        {standalone && identities.length > 0 && <p className="order-reviewed-count">{identities.length - existingCount} new {identities.length - existingCount === 1 ? 'blend' : 'blends'}{existingCount > 0 ? ` · ${existingCount} already saved` : ''}. Your existing artwork and print quantities stay.</p>}
        <div className="order-review-actions"><button className="button primary" type="button" disabled={busy || !identities.length} onClick={() => void save()}>{adding ? 'Saving…' : standalone ? `Save ${identities.length} ${identities.length === 1 ? 'blend' : 'blends'} and choose designs` : 'Add selected tobaccos'}</button>
          {standalone && <button className="button quiet" type="button" disabled={busy} onClick={() => { clearReview(); fileTrigger.current?.focus() }}>Cancel review</button>}
        </div>
      </section>}
    </div>}
  </div>
}
