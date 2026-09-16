import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { GalleryBlendSearch, type GalleryBlendIdentity } from './GalleryBlendSearch'
import { GalleryThumbnail } from './GalleryThumbnail'
import { blendKey, browseResults, loadBrowseLabels, shuffleIds, type BrowseOrder } from './browse-model'
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
  const [labels, setLabels] = useState<GalleryPublicLabel[]>([])
  const [error, setError] = useState(''), [busy, setBusy] = useState(true)
  const [adding, setAdding] = useState<string | null>(null), [addError, setAddError] = useState('')
  const [identity, setIdentity] = useState<GalleryBlendIdentity | null>(null)
  const [query, setQuery] = useState(''), [maker, setMaker] = useState(''), [blend, setBlend] = useState<string | null>(null)
  const [order, setOrder] = useState<BrowseOrder>('shuffle'), [shuffled, setShuffled] = useState<string[]>([])
  const [visible, setVisible] = useState(24), [creating, setCreating] = useState(false)
  const resultCount = useRef<HTMLParagraphElement>(null), focusResults = useRef(false)
  const requestVersion = useRef(0), controller = useRef<AbortController | null>(null)
  const load = useCallback(async () => {
    const version = ++requestVersion.current
    controller.current?.abort()
    const current = new AbortController(); controller.current = current
    setBusy(true); setError('')
    try {
      const result = await loadBrowseLabels(current.signal)
      if (version === requestVersion.current) { setLabels(result); setShuffled(shuffleIds(result)) }
    } catch (failure) { if (version === requestVersion.current) setError(errorText(failure)) }
    finally { if (version === requestVersion.current) setBusy(false) }
  }, [])
  useEffect(() => {
    const version = requestVersion, requests = controller
    const timer = config?.serving ? setTimeout(() => void load(), 0) : undefined
    return () => { clearTimeout(timer); version.current++; requests.current?.abort() }
  }, [config?.serving, load])
  const makers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const label of labels) counts.set(label.maker, (counts.get(label.maker) ?? 0) + 1)
    return [...counts].sort(([a, aCount], [b, bCount]) => bCount - aCount || a.localeCompare(b))
  }, [labels])
  const alternatives = useMemo(() => {
    const counts = new Map<string, number>()
    for (const label of labels) counts.set(blendKey(label), (counts.get(blendKey(label)) ?? 0) + 1)
    return counts
  }, [labels])
  const results = useMemo(() => browseResults(labels, query, maker, blend, order, shuffled), [labels, query, maker, blend, order, shuffled])
  const shown = results.slice(0, visible)
  const variantText = (label: GalleryPublicLabel) => {
    if (label.edition && !/^\d{4}-\d{2}-\d{2}$/.test(label.edition)) return label.edition
    const variants = labels.filter(other => blendKey(other) === blendKey(label)).map(other => other.id).sort()
    return variants.length > 1 ? `Design ${variants.indexOf(label.id) + 1} of ${variants.length}` : ''
  }
  useEffect(() => {
    if (!focusResults.current) return
    focusResults.current = false
    resultCount.current?.focus({ preventScroll: true }); resultCount.current?.scrollIntoView?.({ block: 'start' })
  }, [blend, query, maker])
  const changeQuery = (value: string) => { setQuery(value); setVisible(24); if (order !== 'shuffle') setOrder(value.trim() ? 'best' : 'shuffle') }
  const clearFilters = () => { setQuery(''); setMaker(''); setBlend(null); setIdentity(null); setVisible(24); setOrder('shuffle') }
  const chooseBlend = (label: GalleryPublicLabel) => {
    focusResults.current = true
    setQuery(`${label.maker} — ${label.blend}`); setBlend(blendKey(label)); setMaker(''); setIdentity({ catalogId: label.catalogId, maker: label.maker, blend: label.blend }); setVisible(24)
  }
  const add = async (label: GalleryPublicLabel) => {
    setAdding(label.id); setAddError('')
    try { await onAdd(label) } catch (failure) { setAddError(errorText(failure)) } finally { setAdding(null) }
  }
  const creationRoute = onCreate && <section className="gallery-create-route" aria-labelledby="gallery-create-heading"><div><h2 id="gallery-create-heading">{identity && !busy && !error && !results.length && !maker ? `Create artwork for ${identity.blend}` : 'Want a different design?'}</h2>{identity && <p>Create new artwork for {identity.maker} {identity.blend}, or keep browsing.</p>}</div><button className="button secondary" type="button" disabled={saving || adding !== null} onClick={() => setCreating(true)}>Choose artwork to create</button></section>
  return <section className="gallery-page screen-only" aria-labelledby="gallery-title">
    <header className="page-heading gallery-heading"><h1 id="gallery-title" tabIndex={-1}>Browse label designs</h1><p>Find your blends, compare the artwork, and add the designs you want to print. Community designs are ready to use without an AI chat.</p></header>
    {configError && <p role="alert">{configError}</p>}
    {!config && !configError && <p role="status">Loading community designs…</p>}
    {config && !config.serving && <p>Community designs are unavailable for now. You can still print saved labels, import a label ZIP, or create new artwork in your AI chat.</p>}
    {selectedCount > 0 && <SelectionSummary selectedCount={selectedCount} readyCount={readyCount} onView={onView} onPrint={onPrint} busy={saving || adding !== null} />}
    {config?.serving && <>
      <section className="gallery-browser" aria-labelledby="gallery-browser-title">
        <div className="gallery-browser-heading"><h2 id="gallery-browser-title">Find a label</h2><p className="gallery-format">2.5-inch round labels for jar lids</p></div>
        <div className="gallery-browse-controls">
          <GalleryBlendSearch labels={labels} loaded={!busy && !error} query={query} onChange={value => { setBlend(value); setVisible(24); if (value) setMaker('') }} onIdentityChange={setIdentity} onQueryChange={changeQuery} />
          <label className="field"><span>Maker</span><select value={maker} disabled={busy || !!error} onChange={event => { setMaker(event.target.value); setVisible(24) }}><option value="">All makers</option>{makers.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}</select></label>
          <label className="field"><span>Order</span><select value={order} onChange={event => { setOrder(event.target.value as BrowseOrder); setVisible(24) }}><option value="shuffle">Shuffled</option><option value="recent">Recently added</option><option value="best" disabled={!query.trim()}>Best match</option><option value="az">Blend A–Z</option></select></label>
        </div>
        {(query || maker) && <div className="gallery-browse-actions"><button className="button quiet" type="button" onClick={clearFilters}>Clear filters</button></div>}
      </section>
      <p ref={resultCount} tabIndex={-1} className="gallery-result-count" role="status" aria-atomic="true">{busy ? 'Loading community designs…' : error ? '' : `${results.length} ${results.length === 1 ? 'design' : 'designs'}${maker ? ` by ${maker}` : ''}${query ? ` matching “${query}”` : ''}${results.length ? ` · Showing ${shown.length}` : ''}`}</p>
      {!busy && !error && !results.length && <div className="gallery-empty"><h2>{identity && !maker ? 'No community artwork for this blend yet' : labels.length ? 'No designs match these filters' : 'No community designs yet'}</h2><p>{identity && !maker ? `${identity.maker} ${identity.blend} is selected. You can create its artwork, or clear the search to keep browsing.` : 'Try a shorter name, choose a suggested blend, or clear the filters. You can also create artwork for a blend of your own.'}</p></div>}
      {error && <p role="alert">{error}</p>}
      {error && <button className="button secondary" type="button" disabled={busy} onClick={() => void load()}>Retry loading designs</button>}
      {!onCreate && !busy && !error && !results.length && <a className="button secondary" href="/labels/create">Choose labels to create</a>}
      {addError && <p role="alert">{addError} Your existing labels are unchanged. Try adding the design again.</p>}
      <div className="gallery-grid" role="region" aria-label="Label results" aria-busy={busy}>{shown.map((label, index) => <article className="gallery-card" key={label.id} aria-labelledby={`gallery-blend-${label.id} gallery-maker-${label.id}`}>
        <a href={`${API}/labels/${label.id}/artwork`} target="_blank" rel="noreferrer" className="gallery-artwork-link" aria-label={`View full-resolution ${label.blend} by ${label.maker} artwork (opens in a new tab)`}><GalleryThumbnail src={`${API}/labels/${label.id}/thumbnail`} alt={label.altText || `${label.maker} ${label.blend} artwork`} eager={index < 4} /></a>
        <header className="gallery-card-heading"><h2 id={`gallery-blend-${label.id}`}>{label.blend}</h2><p id={`gallery-maker-${label.id}`} className="gallery-card-maker">{label.maker}</p></header>
        {variantText(label) && <p id={`gallery-variant-${label.id}`} className="gallery-edition">{variantText(label)}</p>}
        {blend !== blendKey(label) && (alternatives.get(blendKey(label)) ?? 0) > 1 && <button className="gallery-alternatives" type="button" aria-label={`View all ${alternatives.get(blendKey(label))} designs for ${label.blend} by ${label.maker}`} onClick={() => chooseBlend(label)}>{alternatives.get(blendKey(label))} designs for this blend</button>}
        <div className="gallery-actions"><button type="button" className="button primary" aria-describedby={`gallery-blend-${label.id} gallery-maker-${label.id}${variantText(label) ? ` gallery-variant-${label.id}` : ''}`} disabled={saving || adding !== null || selectedIds.includes(label.id)} onClick={() => void add(label)}>{selectedIds.includes(label.id) ? 'Added to your labels' : adding === label.id ? 'Adding design…' : getActionLabel?.(label) ?? 'Add to your labels'}</button></div>
      </article>)}</div>
      {adding && <p role="status">Downloading and checking the selected design…</p>}
      {shown.length < results.length && <div className="gallery-pagination"><button type="button" className="button secondary" onClick={() => setVisible(value => value + 24)}>Show more labels</button></div>}
      {creationRoute}
    </>}
    {!config?.serving && creationRoute}
    {creating && onCreate && <CreationReview identity={identity} query={query} onCreate={onCreate} onClose={() => setCreating(false)} />}
    <footer className="gallery-disclaimer"><p className="field-hint">Shared by community members for personal cellaring. Tin to Cellar is independent of tobacco brands.</p><p className="field-hint">Questions about a label or source link? <a href="mailto:dylan@enablement.engineering">Email Dylan</a> with a link and a short note.</p></footer>
  </section>
}
