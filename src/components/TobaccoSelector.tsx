import { useEffect, useId, useState, type RefObject } from 'react'
import { searchTobaccos, type TobaccoEntry } from '../lib/tobacco-catalog'

export type TobaccoIdentity = { catalogId: string | null; maker: string; blend: string }

export function TobaccoSelector({ value, onChange, onChoose, inputRef, disabled, label = 'Add a blend', hint, actionLabel, multilineHint = 'Choose one blend at a time here.' }: {
  value: string; onChange: (value: string) => void; onChoose: (identity: TobaccoIdentity) => void
  inputRef?: RefObject<HTMLInputElement | null>; disabled?: boolean; label?: string; hint: string; actionLabel?: string; multilineHint?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1), [error, setError] = useState('')
  const matches = searchTobaccos(value, 6), visible = !disabled && open && Boolean(value.trim())
  const selected = active >= 0 ? Math.min(active, matches.length) : matches.length === 1 ? 0 : -1
  useEffect(() => { if (visible && selected >= 0) document.getElementById(`${id}-${selected}`)?.scrollIntoView?.({ block: 'nearest' }) }, [visible, selected, id])
  const choose = (entry?: TobaccoEntry) => {
    if (disabled || !value.trim()) return
    setError(''); setOpen(false); setActive(-1)
    onChoose(entry ? { catalogId: entry.id, maker: entry.maker, blend: entry.blend } : { catalogId: null, maker: '', blend: value.trim() })
  }
  const submit = () => {
    if (disabled) return
    if (selected >= 0) choose(matches[selected])
    else if (!matches.length) choose()
    else { setOpen(true); setError('Choose a catalog match below, or use this name without a catalog match.') }
  }
  return <div className="field tobacco-picker">
    <label htmlFor={id}>{label}</label>
    <p id={`${id}-hint`} className="field-hint">{hint}</p>
    <div className="preparation-add-line"><div className="tobacco-editor">
      <input id={id} ref={inputRef} type="text" role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible ? `${id}-options` : undefined} aria-activedescendant={visible && selected >= 0 ? `${id}-${selected}` : undefined} aria-describedby={`${id}-hint`} autoComplete="off" value={value} readOnly={disabled} placeholder="Search or type a blend…" onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1) }} onChange={event => { onChange(event.target.value); setError(''); setOpen(true); setActive(-1) }} onKeyDown={event => {
        if (event.nativeEvent.isComposing || disabled) return
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && value.trim()) { event.preventDefault(); setOpen(true); setActive(current => event.key === 'ArrowDown' ? Math.min(current + 1, matches.length) : current < 0 ? matches.length : Math.max(0, current - 1)) }
        else if (event.key === 'Escape' && visible) { event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1) }
        else if (event.key === 'Enter') { event.preventDefault(); if (value.trim()) submit() }
      }} onPaste={event => {
        if (disabled) { event.preventDefault(); return }
        if (!/[\r\n]/.test(event.clipboardData.getData('text'))) return
        event.preventDefault(); setError(multilineHint)
      }} />
      {visible && <ul id={`${id}-options`} className="tobacco-suggestions" role="listbox" aria-label="Blend suggestions">
        {matches.map((entry, index) => <li id={`${id}-${index}`} key={entry.id} role="option" aria-selected={selected === index} aria-label={`${entry.blend} by ${entry.maker}`} onMouseDown={event => event.preventDefault()} onClick={() => choose(entry)}><strong>{entry.blend}</strong><span>{entry.maker}</span></li>)}
        <li id={`${id}-${matches.length}`} role="option" aria-selected={selected === matches.length} onMouseDown={event => event.preventDefault()} onClick={() => choose()}>Use “{value.trim()}” without a catalog match</li>
      </ul>}
    </div>{actionLabel && <button type="button" className="button secondary" disabled={disabled || !value.trim()} onMouseDown={event => event.preventDefault()} onClick={submit}>{actionLabel}</button>}</div>
    {error && <p role="alert">{error}</p>}
  </div>
}
