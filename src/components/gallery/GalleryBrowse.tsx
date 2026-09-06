import { useEffect, useState } from 'react'
import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { TOBACCO_CATALOG } from '../../lib/tobacco-catalog'
import { API, errorText, request, useConfig } from './client'
export function GalleryBrowse({ onUse }: { onUse: (file: File) => Promise<void> }) {
  const { config, error: configError } = useConfig()
  const [labels, setLabels] = useState<GalleryPublicLabel[]>([]), [catalogId, setCatalogId] = useState(''), [edition, setEdition] = useState('')
  const [cursor, setCursor] = useState<string | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const load = async (next?: string) => {
    setBusy(true); setError('')
    try { const params = new URLSearchParams({ geometry: 'circle-2.5', ...(catalogId ? { catalogId } : {}), ...(edition ? { edition } : {}), ...(next ? { cursor: next } : {}) }); const result = await request<{ labels: GalleryPublicLabel[]; nextCursor: string | null }>(`/labels?${params}`); setLabels(old => next ? [...old, ...result.labels] : result.labels); setCursor(result.nextCursor) } catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  useEffect(() => { if (!config?.serving) return; let active = true; void request<{ labels: GalleryPublicLabel[]; nextCursor: string | null }>('/labels?geometry=circle-2.5').then(result => { if (active) { setLabels(result.labels); setCursor(result.nextCursor) } }).catch(e => { if (active) setError(errorText(e)) }); return () => { active = false } }, [config?.serving])
  const openLabel = async (id: string) => { setBusy(true); setError(''); try { const response = await fetch(`${API}/labels/${id}/pack`, { cache: 'no-store' }); if (!response.ok) throw new Error('This design is no longer available. Refresh the library.'); await onUse(new File([await response.blob()], 'community-label.cellarpack.zip', { type: 'application/zip' })) } catch (e) { setError(errorText(e)) } finally { setBusy(false) } }
  return <section className="gallery-page screen-only" aria-labelledby="gallery-title"><header className="page-heading"><h1 id="gallery-title">Community labels</h1><p>Find a design, choose your quantities, and print for personal cellaring.</p></header>
    <p className="field-hint">Contributor designs reviewed for this library. Tin to Cellar is independent of tobacco brands; review does not grant rights to the original artwork.</p>
    <p className="field-hint">Concerned about artwork or a source link? <a href="mailto:dylan@enablement.engineering">Contact Dylan Isaac</a> with the label or page link and a short explanation.</p>
    {(configError || error) && <p role="alert">{configError || error}</p>}
    {!config && !configError && <p role="status">Loading library…</p>}
    {config && !config.serving && <p>The community library is closed for now. You can still import and print your own label pack.</p>}
    {config?.serving && <><form className="gallery-filters" onSubmit={event => { event.preventDefault(); void load() }}><label>Blend<select value={catalogId} onChange={event => setCatalogId(event.target.value)}><option value="">All blends</option>{TOBACCO_CATALOG.map(entry => <option value={entry.id} key={entry.id}>{entry.maker} · {entry.blend}</option>)}</select></label><label>Edition<input value={edition} maxLength={120} onChange={event => setEdition(event.target.value)} /></label><label>Label shape<select aria-label="Label shape" defaultValue="circle-2.5"><option value="circle-2.5">2.5-inch circle</option></select></label><button className="button secondary" disabled={busy}>Search</button></form>
    {busy && <p role="status">Loading…</p>}{!busy && !labels.length && !error && <p>No labels match yet. Try another blend or edition.</p>}
    <div className="gallery-grid">{labels.map(label => <article className="gallery-card" key={label.id}><a href={`${API}/labels/${label.id}/artwork`} target="_blank" rel="noreferrer" aria-label={`View full-resolution ${label.blend} artwork`}><img src={`${API}/labels/${label.id}/thumbnail`} alt={label.description} loading="lazy" /></a><h2>{label.maker} · {label.blend}</h2><p>{label.edition || 'Edition not specified'} · 2.5-inch circle</p><p>{label.description}</p><div className="gallery-actions"><button className="button primary" disabled={busy} onClick={() => void openLabel(label.id)}>Use label</button><a className="button secondary" href={`${API}/labels/${label.id}/pack`} download>Download ZIP</a></div></article>)}</div>
    {cursor && <button className="button secondary" disabled={busy} onClick={() => void load(cursor)}>More labels</button>}</>}
  </section>
}
