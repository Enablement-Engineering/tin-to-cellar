import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatTobacco, searchTobaccos } from '../../lib/tobacco-catalog'
import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { blendKey, searchScore } from './browse-model'

export type GalleryBlendIdentity = { catalogId: string | null; maker: string; blend: string }

export function GalleryBlendSearch({ labels, loaded, query, onChange, onIdentityChange, onQueryChange }: {
  labels: GalleryPublicLabel[]; loaded: boolean; query: string
  onChange: (blend: string | null) => void
  onIdentityChange: (identity: GalleryBlendIdentity | null) => void
  onQueryChange: (query: string) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const matches = useMemo(() => {
    if (!query.trim()) return []
    const groups = new Map<string, { key: string; identity: GalleryBlendIdentity; count: number; score: number }>()
    for (const label of labels) {
      const key = blendKey(label), existing = groups.get(key)
      const score = searchScore(label, query)
      if (existing) { existing.count++; existing.score = Math.min(existing.score, score) }
      else groups.set(key, { key, identity: label, count: 1, score })
    }
    const available = [...groups.values()].filter(group => Number.isFinite(group.score))
      .sort((a, b) => a.score - b.score || a.identity.blend.localeCompare(b.identity.blend))
    const known = searchTobaccos(query, 8).filter(entry => !available.some(group => group.key === entry.id)).map(entry => ({ key: entry.id, identity: { catalogId: entry.id, maker: entry.maker, blend: entry.blend }, count: groups.get(entry.id)?.count ?? 0 }))
    return [...available, ...known].slice(0, 8)
  }, [labels, query])
  const showOptions = open && Boolean(query.trim()) && matches.length > 0
  useEffect(() => {
    if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, id])
  const publish = (value: string) => { onQueryChange(value); onIdentityChange(null); onChange(null) }
  const choose = (entry: typeof matches[number]) => {
    setOpen(false); setActive(-1); onQueryChange(formatTobacco(entry.identity)); onChange(entry.key)
    onIdentityChange({ catalogId: entry.identity.catalogId, maker: entry.identity.maker, blend: entry.identity.blend })
  }
  return <div className="field tobacco-picker gallery-blend-search">
    <label htmlFor={id}>Maker or blend</label>
    <div className="tobacco-editor">
      <input ref={input} type="text" id={id} role="combobox" aria-autocomplete="list" aria-expanded={showOptions} aria-controls={showOptions ? `${id}-options` : undefined} aria-activedescendant={showOptions && active >= 0 ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-hint`} autoComplete="off" placeholder="Try Nightcap, Peterson, or C&D…" value={draft ?? query}
        onChange={event => { setOpen(true); setActive(-1); if (composing.current) setDraft(event.target.value); else publish(event.target.value) }}
        onCompositionStart={() => { composing.current = true; setDraft(query) }}
        onCompositionEnd={event => { composing.current = false; setDraft(null); publish(event.currentTarget.value) }}
        onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true)
            setActive(current => event.key === 'ArrowDown' ? Math.min(current + 1, matches.length - 1) : current < 0 ? matches.length - 1 : Math.max(0, current - 1))
          } else if (event.key === 'Escape') { setOpen(false); setActive(-1) }
          else if (event.key === 'Enter' && showOptions) { event.preventDefault(); if (active >= 0 && matches[active]) choose(matches[active]) }
        }} />
      {showOptions && <ul className="tobacco-suggestions" id={`${id}-options`} role="listbox" aria-label="Blend suggestions">
        {matches.map((entry, index) => <li key={entry.key} id={`${id}-option-${index}`} role="option" aria-selected={active === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(entry)}><strong>{entry.identity.blend}</strong><span>{entry.identity.maker}</span><span className="gallery-suggestion-count">{!loaded ? 'Checking designs…' : entry.count ? `${entry.count} ${entry.count === 1 ? 'design' : 'designs'} available` : 'No artwork yet'}</span></li>)}
      </ul>}
    </div>
    <span className="field-hint" id={`${id}-hint`}>Search all community designs. Choose a suggestion to see one blend.</span>
    {query && <button className="gallery-search-clear" type="button" onMouseDown={event => event.preventDefault()} onClick={() => { publish(''); setOpen(false); setActive(-1); input.current?.focus() }}>Clear search</button>}
  </div>
}
