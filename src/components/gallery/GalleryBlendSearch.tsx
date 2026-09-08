import { useEffect, useId, useRef, useState } from 'react'
import { formatTobacco, searchTobaccos, type TobaccoEntry } from '../../lib/tobacco-catalog'

export type GalleryBlendIdentity = { catalogId: string | null; maker: string; blend: string }

export function GalleryBlendSearch({ onChange, onIdentityChange, onQueryChange }: {
  onChange: (catalogIds: string[] | null, typing: boolean) => void
  onIdentityChange?: (identity: GalleryBlendIdentity | null) => void
  onQueryChange?: (query: string) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const matches = searchTobaccos(query, 8)
  const showOptions = open && Boolean(query.trim())
  useEffect(() => {
    if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, id])
  const publishQuery = (value: string) => onChange(value.trim() ? searchTobaccos(value, 8).map(entry => entry.id) : null, Boolean(value.trim()))
  const choose = (entry: TobaccoEntry) => {
    setQuery(formatTobacco(entry)); setOpen(false); setActive(-1); onChange([entry.id], false)
    onQueryChange?.(formatTobacco(entry)); onIdentityChange?.({ catalogId: entry.id, maker: entry.maker, blend: entry.blend })
  }
  return <div className="field tobacco-picker gallery-blend-search">
    <label htmlFor={id}>Maker or blend</label>
    <div className="tobacco-editor">
      <input ref={input} type="text" id={id} role="combobox" aria-autocomplete="list" aria-expanded={showOptions} aria-controls={showOptions ? `${id}-options` : undefined} aria-activedescendant={showOptions && active >= 0 ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-hint`} autoComplete="off" placeholder="Search by maker or blend…" value={query}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); onQueryChange?.(event.target.value); onIdentityChange?.(null); if (!composing.current) publishQuery(event.target.value) }}
        onCompositionStart={() => { composing.current = true }}
        onCompositionEnd={event => { composing.current = false; publishQuery(event.currentTarget.value) }}
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
        {matches.map((entry, index) => <li key={entry.id} id={`${id}-option-${index}`} role="option" aria-label={`${entry.blend} by ${entry.maker}`} aria-selected={active === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(entry)}><strong>{entry.blend}</strong><span>{entry.maker}</span></li>)}
      </ul>}
    </div>
    <span className="field-hint" id={`${id}-hint`}>Results update as you type. Clear the search to browse everything.</span>
    <span className="field-hint" role="status">{showOptions && !matches.length ? 'No matching blends. Try another name.' : ''}</span>
    {query && <button className="gallery-search-clear" type="button" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(''); setOpen(false); setActive(-1); onQueryChange?.(''); onIdentityChange?.(null); onChange(null, false); input.current?.focus() }}>Clear search</button>}
  </div>
}
