import { useCallback, useEffect, useRef, useState } from 'react'
import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { GalleryBlendSearch } from './GalleryBlendSearch'
import { GalleryThumbnail } from './GalleryThumbnail'
import { searchLabels } from './search-labels'
import { API, errorText, useConfig } from './client'

export function GalleryBrowse({ onAdd, selectedIds = [], onPrint }: { onAdd: (label: GalleryPublicLabel) => Promise<void>; selectedIds?: string[]; onPrint?: () => void }) {
  const { config, error: configError } = useConfig()
  const [labels, setLabels] = useState<GalleryPublicLabel[]>([]), [filter, setFilter] = useState<{ ids: string[] | null; typing: boolean }>({ ids: null, typing: false })
  const [cursor, setCursor] = useState<string | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState<string | null>(null), [addError, setAddError] = useState('')
  const requestVersion = useRef(0), controller = useRef<AbortController | null>(null)
  const load = useCallback(async (next?: string) => {
    const version = ++requestVersion.current
    controller.current?.abort()
    const current = new AbortController(); controller.current = current
    setBusy(true); setError('')
    if (!next) { setLabels([]); setCursor(null) }
    try {
      const result = await searchLabels(filter.ids, next, current.signal)
      if (version !== requestVersion.current) return
      setLabels(old => next ? [...old, ...result.labels] : result.labels); setCursor(result.nextCursor)
    } catch (failure) { if (version === requestVersion.current) setError(errorText(failure)) }
    finally { if (version === requestVersion.current) setBusy(false) }
  }, [filter])
  useEffect(() => {
    const version = requestVersion, requests = controller
    const timer = config?.serving ? setTimeout(() => void load(), filter.typing ? 100 : 0) : undefined
    return () => { clearTimeout(timer); version.current++; requests.current?.abort() }
  }, [config?.serving, filter.typing, load])
  const changeFilter = (ids: string[] | null, typing: boolean) => {
    requestVersion.current++; controller.current?.abort(); setBusy(true); setError(''); setLabels([]); setCursor(null); setFilter({ ids, typing })
  }
  const add = async (label: GalleryPublicLabel) => {
    setAdding(label.id); setAddError('')
    try { await onAdd(label) } catch (failure) { setAddError(errorText(failure)) } finally { setAdding(null) }
  }
  return <section className="gallery-page screen-only" aria-labelledby="gallery-title">
    <header className="page-heading gallery-heading"><h1 id="gallery-title" tabIndex={-1}>Community labels</h1><p>Choose designs shared by the community. Add them to your labels and print them alongside your own artwork.</p></header>
    {(configError || error) && <p role="alert">{configError || error}</p>}
    {!config && !configError && <p role="status">Loading library…</p>}
    {config && !config.serving && <p>The community library is closed for now. You can still create your own designs or import and print a label ZIP.</p>}
    {selectedIds.length > 0 && <div className="preparation-summary"><p role="status">{selectedIds.length} community {selectedIds.length === 1 ? 'design' : 'designs'} in your labels</p>{onPrint && <button className="button primary" type="button" onClick={onPrint}>View your labels</button>}</div>}
    {config?.serving && <>
      <section className="gallery-browser" aria-labelledby="gallery-browser-title"><div className="gallery-browser-heading"><div><h2 id="gallery-browser-title">Find a label</h2><p>Search by maker or blend, or browse everything below.</p></div><p className="gallery-format"><span>Available format</span><strong>2.5-inch circle</strong></p></div><GalleryBlendSearch onChange={changeFilter} /></section>
      <p className="gallery-result-count" role="status" aria-atomic="true">{busy ? 'Loading labels…' : error ? '' : !labels.length ? 'No labels match your search. Try another maker or blend, or create your own design.' : `Showing ${labels.length} ${labels.length === 1 ? 'label' : 'labels'}${cursor ? '. More are available.' : '.'}`}</p>
      {!busy && !error && !labels.length && <a className="button secondary" href="/labels/create">Choose labels to create</a>}
      {addError && <p role="alert">{addError} Your existing labels are unchanged. Try adding the design again.</p>}
      <div className="gallery-grid" role="region" aria-label="Label results" aria-busy={busy}>{labels.map((label, index) => <article className="gallery-card" key={label.id}>
        <a href={`${API}/labels/${label.id}/artwork`} target="_blank" rel="noreferrer" aria-label={`View full-resolution ${label.blend} artwork`}><GalleryThumbnail src={`${API}/labels/${label.id}/thumbnail`} alt={label.description} eager={index === 0} /></a>
        <h2>{label.maker} · {label.blend}</h2><p>{label.edition ? `${label.edition} · ` : ''}2.5-inch circle</p><p>{label.description}</p>
        <div className="gallery-actions"><button type="button" className="button primary" disabled={adding !== null || selectedIds.includes(label.id)} onClick={() => void add(label)}>{selectedIds.includes(label.id) ? 'Added to your labels' : adding === label.id ? 'Adding design…' : 'Add to your labels'}</button></div>
      </article>)}</div>
      {adding && <p role="status">Downloading and checking the selected design…</p>}
      {cursor && <button type="button" className="button secondary" disabled={busy} onClick={() => void load(cursor)}>Show more labels</button>}
    </>}
    <footer className="gallery-disclaimer"><p className="field-hint">Shared by community members for personal cellaring. Tin to Cellar is independent of tobacco brands.</p><p className="field-hint">Questions about a label or source link? <a href="mailto:dylan@enablement.engineering">Email this address</a> with a link and a short note.</p></footer>
  </section>
}
