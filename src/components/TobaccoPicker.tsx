import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { formatTobacco, searchTobaccos } from '../lib/tobacco-catalog'

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>()
  return names.map((name) => name.trim()).filter((name) => {
    const key = name.toLocaleLowerCase()
    if (!name || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
function fromValue(value: string) {
  return { source: value, names: uniqueNames(value.split(/\r?\n/)), draft: '' }
}

export function TobaccoPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [editor, setEditor] = useState(() => fromValue(value))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  // Reconcile external replacements; ordinary edits publish the same source in the same event.
  if (editor.source !== value) setEditor(fromValue(value))
  const { names, draft } = editor
  const matches = searchTobaccos(draft, 8)
  const showOptions = open && Boolean(draft.trim())
  const options = [...matches.map(formatTobacco), draft.trim()]
  useEffect(() => {
    if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active, id])
  const publish = (nextNames: string[], nextDraft: string) => {
    const names = uniqueNames(nextNames)
    const source = uniqueNames([...names, nextDraft]).join('\n')
    setEditor({ source, names, draft: nextDraft })
    onChange(source)
  }
  const choose = (name: string) => {
    publish([...names, name], '')
    setActive(-1)
    setOpen(false)
    input.current?.focus()
  }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && draft.trim()) {
      event.preventDefault()
      setOpen(true)
      setActive((current) => Math.min(current + 1, options.length - 1))
    } else if (event.key === 'ArrowUp' && draft.trim()) {
      event.preventDefault()
      setOpen(true)
      setActive((current) => current < 0 ? options.length - 1 : Math.max(0, current - 1))
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    } else if (event.key === 'Enter' && draft.trim()) {
      event.preventDefault()
      choose(showOptions && active >= 0 ? options[active] : draft)
    }
  }
  return <div className="field field-wide tobacco-picker">
    <label htmlFor={id}>Tobaccos <em>optional</em></label>
    <span className="field-hint" id={`${id}-hint`}>Search by maker or blend, type your own, or paste one blend per line. You can also choose blends later in your AI chat.</span>
    <div className="tobacco-editor">
      <input id={id} ref={input} type="text" role="combobox" aria-label="Tobaccos" aria-autocomplete="list" aria-controls={showOptions ? `${id}-options` : undefined} aria-expanded={showOptions} aria-activedescendant={showOptions && active >= 0 ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-hint`} autoComplete="off" value={draft} placeholder={names.length ? 'Add another tobacco…' : 'Search or type a tobacco…'} onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1) }} onKeyDown={keyDown} onChange={(event) => { publish(names, event.target.value); setActive(-1); setOpen(true) }} onPaste={(event) => {
        const text = event.clipboardData.getData('text')
        if (!/[\r\n]/.test(text)) return
        event.preventDefault()
        const start = event.currentTarget.selectionStart ?? draft.length
        const end = event.currentTarget.selectionEnd ?? draft.length
        const pasted = `${draft.slice(0, start)}${text}${draft.slice(end)}`
        publish([...names, ...pasted.split(/\r?\n/)], '')
        setOpen(false)
        setActive(-1)
      }} />
    {showOptions && <ul className="tobacco-suggestions" id={`${id}-options`} role="listbox" aria-label="Tobacco suggestions">
      {matches.map((entry, index) => <li key={entry.id} id={`${id}-option-${index}`} role="option" aria-label={`${entry.blend} by ${entry.maker}`} aria-selected={index === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(formatTobacco(entry))}><strong>{entry.blend}</strong><span>{entry.maker}</span></li>)}
      <li id={`${id}-option-${matches.length}`} role="option" aria-selected={active === matches.length} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(draft)}>Use "{draft.trim()}"</li>
    </ul>}
    </div>
    {names.length > 0 && <ul className="tobacco-chips" aria-label="Selected tobaccos">{names.map((name) => <li key={name}><span>{name}</span><button type="button" aria-label={`Remove ${name}`} onClick={() => { publish(names.filter((item) => item !== name), draft); input.current?.focus() }}>×</button></li>)}</ul>}
    <span className="visually-hidden" aria-live="polite">{showOptions ? `${matches.length} catalog ${matches.length === 1 ? 'suggestion' : 'suggestions'}.` : ''}</span>
    <button className="clear-tobaccos" style={{ visibility: names.length > 0 || draft ? 'visible' : 'hidden' }} type="button" onClick={() => { publish([], ''); setOpen(false); setActive(-1); input.current?.focus() }}>Clear tobaccos</button>
  </div>
}
