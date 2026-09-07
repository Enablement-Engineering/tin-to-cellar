import { useCallback, useEffect, useRef, useState } from 'react'
import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { MAX_PACK_LABELS, validChoice, type PackChoice } from './pack-selection'
import { FloatingPack } from './FloatingPack'
import { GalleryBlendSearch } from './GalleryBlendSearch'
import { GalleryThumbnail } from './GalleryThumbnail'
import { searchLabels } from './search-labels'
import { API, errorText, useConfig } from './client'
export function GalleryBrowse({ onUse }: { onUse: (file: File) => Promise<void> }) {
  const { config, error: configError } = useConfig()
  const [selected, setSelected] = useState<PackChoice[]>(() => {
    try { const saved: unknown = JSON.parse(sessionStorage.getItem('gallery-pack-selection') ?? '[]'); return Array.isArray(saved) ? saved.filter(validChoice).filter((entry, index, all) => all.findIndex(other => other.id === entry.id) === index).slice(0, MAX_PACK_LABELS) : [] } catch { return [] }
  })
  useEffect(() => { try { sessionStorage.setItem('gallery-pack-selection', JSON.stringify(selected)) } catch { /* Selection still works in memory when storage is unavailable. */ } }, [selected])
  const [assembling, setAssembling] = useState(false)
  const createPack = async (print: boolean) => {
    setAssembling(true); setError('')
    try {
      const { buildSelectedPack } = await import('./pack-builder')
      const file = await buildSelectedPack(selected)
      if (print) await onUse(file)
      else {
        const url = URL.createObjectURL(file), link = document.createElement('a')
        link.href = url; link.download = file.name; document.body.append(link); link.click(); link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 30000)
      }
    } catch (error) { setError(errorText(error)) } finally { setAssembling(false) }
  }
  const [labels, setLabels] = useState<GalleryPublicLabel[]>([]), [filter, setFilter] = useState<{ ids: string[] | null; typing: boolean }>({ ids: null, typing: false })
  const [cursor, setCursor] = useState<string | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const requestVersion = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const load = useCallback(async (next?: string) => {
    const version = ++requestVersion.current
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setBusy(true); setError('')
    if (!next) { setLabels([]); setCursor(null) }
    try {
      const result = await searchLabels(filter.ids, next, current.signal)
      if (version !== requestVersion.current) return
      setLabels(old => next ? [...old, ...result.labels] : result.labels); setCursor(result.nextCursor)
    } catch (e) { if (version === requestVersion.current) setError(errorText(e)) }
    finally { if (version === requestVersion.current) setBusy(false) }
  }, [filter])
  useEffect(() => {
    const version = requestVersion
    const requests = controller
    const timer = config?.serving ? setTimeout(() => void load(), filter.typing ? 100 : 0) : undefined
    return () => { clearTimeout(timer); version.current++; requests.current?.abort() }
  }, [config?.serving, filter.typing, load])
  const changeFilter = (ids: string[] | null, typing: boolean) => {
    requestVersion.current++; controller.current?.abort()
    setBusy(true); setError(''); setLabels([]); setCursor(null)
    setFilter({ ids, typing })
  }
  const openLabel = async (id: string) => { setBusy(true); setError(''); try { const response = await fetch(`${API}/labels/${id}/pack`, { cache: 'no-store' }); if (!response.ok) throw new Error('This design is no longer available. Refresh the library.'); await onUse(new File([await response.blob()], 'community-label.cellarpack.zip', { type: 'application/zip' })) } catch (e) { setError(errorText(e)) } finally { setBusy(false) } }
  return <section className="gallery-page screen-only" aria-labelledby="gallery-title"><header className="page-heading gallery-heading"><h1 id="gallery-title" tabIndex={-1}>Community labels</h1><p>Browse labels shared by the community. Add several to a pack, or print one right away.</p></header>
    {(configError || error) && <p role="alert">{configError || error}</p>}
    {!config && !configError && <p role="status">Loading library…</p>}
    {config && !config.serving && <p>The community library is closed for now. You can still import and print your own label pack.</p>}
    {config?.serving && <><section className="gallery-browser" aria-labelledby="gallery-browser-title"><div className="gallery-browser-heading"><div><h2 id="gallery-browser-title">Find a label</h2><p>Search by maker or blend, or browse everything below.</p></div><p className="gallery-format"><span>Available format</span><strong>2.5-inch circle</strong></p></div><GalleryBlendSearch onChange={changeFilter} /></section>
    <p className="gallery-result-count" role="status" aria-atomic="true">{busy ? 'Loading labels…' : error ? '' : !labels.length ? 'No labels match your search. Try another maker or blend.' : `Showing ${labels.length} ${labels.length === 1 ? 'label' : 'labels'}${cursor ? '. More are available.' : '.'}`}</p>
    <FloatingPack selected={selected} busy={busy} assembling={assembling} onRemove={id => setSelected(old => old.filter(item => item.id !== id))} onClear={() => setSelected([])} onCreate={print => void createPack(print)} />
    <div className="gallery-grid" role="region" aria-label="Label results" aria-busy={busy}>{labels.map((label, index) => <article className="gallery-card" key={label.id}><a href={`${API}/labels/${label.id}/artwork`} target="_blank" rel="noreferrer" aria-label={`View full-resolution ${label.blend} artwork`}><GalleryThumbnail src={`${API}/labels/${label.id}/thumbnail`} alt={label.description} eager={index === 0} /></a><h2>{label.maker} · {label.blend}</h2><p>{label.edition ? `${label.edition} · ` : ''}2.5-inch circle</p><p>{label.description}</p><div className="gallery-actions"><button className="button primary" disabled={assembling || selected.some(item => item.id === label.id) || selected.length >= MAX_PACK_LABELS} onClick={() => setSelected(old => old.some(item => item.id === label.id) ? old : [...old, { id: label.id, maker: label.maker, blend: label.blend }])}>{selected.some(item => item.id === label.id) ? 'Added to pack' : 'Add to pack'}</button><button className="button secondary" disabled={busy || assembling} onClick={() => void openLabel(label.id)}>Print this label</button></div></article>)}</div>
    {cursor && <button className="button secondary" disabled={busy} onClick={() => void load(cursor)}>Show more labels</button>}</>}
    <footer className="gallery-disclaimer">
      <p className="field-hint">Shared by community members for personal cellaring. Tin to Cellar is independent of tobacco brands.</p>
      <p className="field-hint">Questions about a label or source link? <a href="mailto:dylan@enablement.engineering">Email this address</a> with a link and a short note.</p>
    </footer>
  </section>
}
