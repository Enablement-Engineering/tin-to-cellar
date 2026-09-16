import { useEffect, useId, useRef, useState } from 'react'

type ThemePreference = 'system' | 'light' | 'dark'
const storageKey = 'tin-to-cellar:theme'
const choices = { system: 'System', light: 'Light', dark: 'Dark' } as const
function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* The theme still works when browser storage is unavailable. */ }
  return 'system'
}

export function ThemeControl() {
  const [preference, setPreference] = useState(readPreference)
  const [open, setOpen] = useState(false)
  const control = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference
      document.documentElement.dataset.theme = theme
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#24231f' : '#f5f0e8')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) setPreference(readPreference())
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    if (!open) return
    control.current?.querySelector<HTMLInputElement>('input:checked')?.focus()
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !control.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  function choose(next: ThemePreference) {
    setPreference(next)
    try {
      if (next === 'system') localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, next)
    } catch { /* Keep the selection for this visit if storage is blocked. */ }
  }

  return <div className="theme-control" ref={control} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus() }
  }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <button className="theme-trigger" type="button" ref={trigger} aria-label={`Theme: ${choices[preference]}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" /></svg>
      <span>Theme</span>
    </button>
    <div id={panelId} className="theme-panel" hidden={!open}>
      <fieldset>
        <legend>Appearance</legend>
        {Object.entries(choices).map(([value, label]) => <label key={value}>
          <input type="radio" name={panelId} value={value} checked={preference === value} onChange={() => choose(value as ThemePreference)} />
          <span>{label}</span>
        </label>)}
      </fieldset>
      <p>System follows your device setting.</p>
    </div>
  </div>
}
