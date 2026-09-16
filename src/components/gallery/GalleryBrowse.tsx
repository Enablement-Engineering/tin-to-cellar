import { useCallback, useEffect, useRef, useState } from 'react'
import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { GalleryBlendSearch, type GalleryBlendIdentity } from './GalleryBlendSearch'
import { GalleryThumbnail } from './GalleryThumbnail'
import { searchLabels } from './search-labels'
import { API, errorText, useConfig } from './client'
import { SelectionSummary } from '../SelectionSummary'
import '../../styles/gallery-workflow.css'

function CreationReview({ identity, query, onCreate, onClose }: {
  identity: GalleryBlendIdentity | null; query: string
  onCreate: (identity: GalleryBlendIdentity) => void | Promise<void>; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const [maker, setMaker] = useState(identity?.maker ?? '')
  const [blend, setBlend] = useState(identity?.blend ?? query.trim())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const modal = dialog.current!
    const previous = document.activeElement as HTMLElement | null
    modal.showModal(); title.current?.focus()
    return () => { modal.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={dialog} className="gallery-creation-dialog" aria-labelledby="gallery-creation-title" aria-describedby="gallery-creation-description" onCancel={event => { event.preventDefault(); if (!saving) onClose() }}>
    <form onSubmit={async event => {
      event.preventDefault(); if (saving || !blend.trim()) return
      setSaving(true); setError('')
      try { await onCreate(identity ?? { catalogId: null, maker: maker.trim(), blend: blend.trim() }); onClose() }
      catch (failure) { setError(errorText(failure)); setSaving(false) }
    }}>
      <h2 ref={title} tabIndex={-1} id="gallery-creation-title">Choose a blend for new artwork</h2>
      <p id="gallery-creation-description">Confirm the blend for your AI request. You will review its design notes and copy the instructions next.</p>
      {identity ? <p className="gallery-confirmed-blend"><strong>{identity.blend}</strong><span>{identity.maker}</span></p> : <>
        <p className="field-hint">Enter the blend name and its maker, if known. This will be saved as a custom blend.</p>
        <label className="field"><span>Maker <em>optional</em></span><input value={maker} maxLength={120} disabled={saving} onChange={event => setMaker(event.target.value)} /></label>
        <label className="field"><span>Blend name</span><input value={blend} required maxLength={120} disabled={saving} onChange={event => setBlend(event.target.value)} /></label>
      </>}
      {error && <p role="alert">{error} Your reviewed blend is still here. Try again.</p>}
      <div className="gallery-creation-actions"><button className="button primary" type="submit" disabled={saving || !blend.trim()}>{saving ? 'Saving…' : 'Add to creation request'}</button><button className="button quiet" type="button" disabled={saving} onClick={onClose}>Cancel</button></div>
    </form>
  </dialog>
}

export function GalleryBrowse({ onAdd, selectedIds = [], readyCount = selectedIds.length, selectedCount = readyCount, onView, onPrint, onCreate, getActionLabel, busy: saving = false }: {
  onAdd: (label: GalleryPublicLabel) => Promise<void>; selectedIds?: string[]; readyCount?: number; selectedCount?: number
  onView?: () => void; onPrint?: () => void; onCreate?: (identity: GalleryBlendIdentity) => void | Promise<void>
  getActionLabel?: (label: GalleryPublicLabel) => string; busy?: boolean
}) {
  const { config, error: configError } = useConfig()
  const [labels, setLabels] = useState<GalleryPublicLabel[]>([]), [filter, setFilter] = useState<{ ids: string[] | null; typing: boolean }>({ ids: null, typing: false })
  const [cursor, setCursor] = useState<string | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState<string | null>(null), [addError, setAddError] = useState('')
  const [identity, setIdentity] = useState<GalleryBlendIdentity | null>(null)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const requestVersion = useRef(0), controller = useRef<AbortController | null>(null)
  const loading = useRef(false)
  const load = useCallback(async (next?: string) => {
    if (next && loading.current) return
    loading.current = true
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
    finally { if (version === requestVersion.current) { loading.current = false; setBusy(false) } }
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
  const creationRoute = onCreate && <section className="gallery-create-route" aria-labelledby="gallery-create-heading"><div><h2 id="gallery-create-heading">Want a different design?</h2>{identity && <p>Create new artwork for {identity.maker} {identity.blend}, or keep browsing.</p>}</div><button className="button secondary" type="button" disabled={saving || adding !== null} onClick={() => setCreating(true)}>Choose artwork to create</button></section>
  return <section className="gallery-page screen-only" aria-labelledby="gallery-title">
    <header className="page-heading gallery-heading"><h1 id="gallery-title" tabIndex={-1}>Browse label designs</h1><p>Find your blends, compare the artwork, and add the designs you want to print. Community designs are ready to use without an AI chat.</p></header>
    {configError && <p role="alert">{configError}</p>}
    {!config && !configError && <p role="status">Loading community designs…</p>}
    {config && !config.serving && <p>Community designs are unavailable for now. You can still print saved labels, import a label ZIP, or create new artwork in your AI chat.</p>}
    {selectedCount > 0 && <SelectionSummary selectedCount={selectedCount} readyCount={readyCount} onView={onView} onPrint={onPrint} busy={saving || adding !== null} />}
    {config?.serving && <>
      <section className="gallery-browser" aria-labelledby="gallery-browser-title"><div className="gallery-browser-heading"><h2 id="gallery-browser-title">Find a label</h2><p className="gallery-format">2.5-inch round labels for jar lids</p></div><GalleryBlendSearch onChange={changeFilter} onIdentityChange={setIdentity} onQueryChange={setQuery} /></section>
      {!labels.length && <p role="status" aria-atomic="true">{busy ? 'Loading labels…' : error || cursor ? '' : 'No labels match your search. Try another maker or blend, or create your own design.'}</p>}
      {error && !cursor && <p role="alert">{error}</p>}
      {error && !cursor && <button className="button secondary" type="button" disabled={busy} onClick={() => void load()}>Retry loading designs</button>}
      {!onCreate && !busy && !error && !labels.length && <a className="button secondary" href="/labels/create">Choose labels to create</a>}
      {addError && <p role="alert">{addError} Your existing labels are unchanged. Try adding the design again.</p>}
      <div className="gallery-grid" role="region" aria-label="Label results" aria-busy={busy}>{labels.map((label, index) => <article className="gallery-card" key={label.id} aria-labelledby={`gallery-blend-${label.id} gallery-maker-${label.id}`}>
        <a href={`${API}/labels/${label.id}/artwork`} target="_blank" rel="noreferrer" className="gallery-artwork-link" aria-label={`View full-resolution ${label.blend} by ${label.maker} artwork (opens in a new tab)`}><GalleryThumbnail src={`${API}/labels/${label.id}/thumbnail`} alt={label.altText || `${label.maker} ${label.blend} artwork`} eager={index < 4} /></a>
        <header className="gallery-card-heading"><h2 id={`gallery-blend-${label.id}`}>{label.blend}</h2><p id={`gallery-maker-${label.id}`} className="gallery-card-maker">{label.maker}</p></header>
        <div className="gallery-actions"><button type="button" className="button primary" aria-describedby={`gallery-blend-${label.id} gallery-maker-${label.id}`} disabled={saving || adding !== null || selectedIds.includes(label.id)} onClick={() => void add(label)}>{selectedIds.includes(label.id) ? 'Added to your labels' : adding === label.id ? 'Adding design…' : getActionLabel?.(label) ?? 'Add to your labels'}</button></div>
      </article>)}</div>
      {adding && <p role="status">Downloading and checking the selected design…</p>}
      <div className="gallery-pagination">
        <p role="status" aria-atomic="true">{labels.length > 0 && busy ? 'Loading more labels…' : ''}</p>
        {error && cursor && <p role="alert">{error}</p>}
        {cursor && <button type="button" className="button secondary" disabled={busy} onClick={() => void load(cursor)}>{busy ? 'Loading more labels…' : error ? 'Retry loading labels' : 'Show more labels'}</button>}
      </div>
      {creationRoute}
    </>}
    {!config?.serving && creationRoute}
    {creating && onCreate && <CreationReview identity={identity} query={query} onCreate={onCreate} onClose={() => setCreating(false)} />}
    <footer className="gallery-disclaimer"><p className="field-hint">Shared by community members for personal cellaring. Tin to Cellar is independent of tobacco brands.</p><p className="field-hint">Questions about a label or source link? <a href="mailto:dylan@enablement.engineering">Email Dylan</a> with a link and a short note.</p></footer>
  </section>
}
