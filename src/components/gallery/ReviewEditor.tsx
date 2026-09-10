import { useState } from 'react'
import type { GalleryLabelDraft } from '../../lib/gallery/types'
import { galleryCatalogId, publicReference } from '../../lib/gallery/schema'
import { TOBACCO_CATALOG, searchTobaccos } from '../../lib/tobacco-catalog'

export function ReviewEditor({ draft, onChange, onSave, onDiscard, dirty, disabled }: {
  draft: GalleryLabelDraft; onChange: (value: GalleryLabelDraft) => void; onSave: () => void; onDiscard: () => void; dirty: boolean; disabled: boolean
}) {
  const [search, setSearch] = useState('')
  const catalogId = galleryCatalogId(draft)
  const matches = search ? searchTobaccos(search, 30) : TOBACCO_CATALOG
  const chosen = TOBACCO_CATALOG.find(item => item.id === catalogId)
  const options = chosen && !matches.includes(chosen) ? [chosen, ...matches] : matches
  const sources = draft.evidence?.references ?? []
  const setText = (key: 'edition' | 'altText', value: string) => { const next = { ...draft }; if (value.trim()) next[key] = value; else delete next[key]; onChange(next) }
  const setSources = (references: typeof sources) => onChange({ ...draft, evidence: { ...draft.evidence, references } })
  return <details className="review-details">
    <summary>Edit details{dirty ? ' · Unsaved corrections' : ''}</summary>
    <fieldset disabled={disabled}>
      <legend>Label details</legend>
      <label>Search catalog<input maxLength={160} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label>Tobacco match<select value={catalogId ?? ''} onChange={event => { if (event.target.value) onChange({ ...draft, tobacco: { catalogId: event.target.value } }) }}>
        <option value="">Choose a catalog match</option>{options.map(item => <option key={item.id} value={item.id}>{item.maker} · {item.blend}</option>)}
      </select></label>
      {!catalogId && <p>A catalog match is required for publication. New blends can be added through catalog maintenance.</p>}
      <label>Edition, optional<input maxLength={120} value={draft.edition ?? ''} onChange={event => setText('edition', event.target.value)} /></label>
      <label>Artwork description, optional<input maxLength={320} value={draft.altText ?? ''} onChange={event => setText('altText', event.target.value)} /></label>
      <p className="field-hint">Used as alternative text for the artwork. The blend name is used when this is empty.</p>
      <details><summary>Source links ({sources.length})</summary>
        {sources.map((source, index) => <div className="review-source" key={index}>
          <label>Reference {index + 1}<input value={source.url} maxLength={1500} onChange={event => setSources(sources.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} /></label>
          <label>Reference role {index + 1}<select value={source.role} onChange={event => setSources(sources.map((item, i) => i === index ? { ...item, role: event.target.value as typeof source.role } : item))}><option value="package-appearance">Package appearance</option><option value="variant-identification">Variant identification</option></select></label>
          {publicReference(source.url) && <a href={source.url} target="_blank" rel="noreferrer">Open reference {index + 1}</a>}
          <button type="button" className="button quiet" onClick={() => setSources(sources.filter((_, i) => i !== index))}>Remove reference {index + 1}</button>
        </div>)}
        {sources.length < 3 && <button type="button" className="button quiet" onClick={() => setSources([...sources, { url: '', role: 'package-appearance' }])}>Add public reference</button>}
      </details>
      <div className="gallery-actions"><button type="button" className="button secondary" disabled={!dirty} onClick={onSave}>Save corrections</button><button type="button" className="button quiet" disabled={!dirty} onClick={onDiscard}>Discard corrections</button></div>
    </fieldset>
  </details>
}
