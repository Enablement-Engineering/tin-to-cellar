import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { formatTobacco, searchTobaccos, type TobaccoEntry } from '../lib/tobacco-catalog'
import type { GalleryPublicLabel } from '../lib/gallery/types'
import type { PrintLabel } from './ui-model'
import { OrderImporter } from './OrderImporter'
import { LabelArtwork } from './LabelArtwork'
import { GalleryThumbnail } from './gallery/GalleryThumbnail'
import { API, errorText } from './gallery/client'
import { searchExactLabels } from './gallery/search-labels'

export type PreparationIdentity = { catalogId: string | null; maker: string; blend: string }
export type PreparationRow = PreparationIdentity & { id: string; edition?: string; notes?: string; createRequested: boolean; artwork?: PrintLabel }
export type PreparationWorkspaceProps = {
  rows: PreparationRow[]; busy?: boolean
  onAdd: (identities: PreparationIdentity[]) => void | Promise<void>
  onRemove: (rowId: string) => void
  onCreate: (rowId: string, requested: boolean) => void
  onNotes?: (rowId: string, notes: string) => void | Promise<void>
  onResolve?: (rowId: string, identity: PreparationIdentity) => void
  onChooseCommunity: (rowId: string, label: GalleryPublicLabel) => Promise<void>
  onPrint: () => void; onBrowse: () => void; onImport: () => void; onGenericChat: () => void
  handoff?: ReactNode
}
const identity = (entry: TobaccoEntry): PreparationIdentity => ({ catalogId: entry.id, maker: entry.maker, blend: entry.blend })

function BlendIntake({ busy, onAdd }: Pick<PreparationWorkspaceProps, 'busy' | 'onAdd'>) {
  const id = useId(), input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(''), [open, setOpen] = useState(false), [active, setActive] = useState(-1)
  const [adding, setAdding] = useState(false), [addError, setAddError] = useState('')
  const [retryIdentities, setRetryIdentities] = useState<PreparationIdentity[] | null>(null)
  const matches = searchTobaccos(draft, 6), visible = open && Boolean(draft.trim())
  useEffect(() => { if (visible && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: 'nearest' }) }, [visible, active, id])
  const addIdentities = async (identities: PreparationIdentity[]) => {
    if (busy || adding) return
    setAdding(true); setAddError('')
    setRetryIdentities(identities)
    try {
      const saved = onAdd(identities)
      if (saved) await saved
      setDraft(''); setRetryIdentities(null); setOpen(false); setActive(-1); input.current?.focus()
    } catch (failure) { setAddError(errorText(failure)) }
    finally { setAdding(false) }
  }
  const add = (entry?: TobaccoEntry) => {
    if (busy || adding) return
    if (!entry && !draft.trim()) return
    void addIdentities(entry ? [identity(entry)] : retryIdentities ?? [...new Set(draft.split(/\r?\n/).map(name => name.trim()).filter(Boolean))].map(blend => ({ catalogId: null, maker: '', blend })))
  }
  return <div className="preparation-intake">
    <div className="field tobacco-picker">
      <label htmlFor={id}>Add a blend</label>
      <p id={`${id}-hint`} className="field-hint">Search by maker or blend, or add a name of your own.</p>
      <div className="preparation-add-line"><div className="tobacco-editor">
        <input id={id} ref={input} type="text" role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible ? `${id}-options` : undefined} aria-activedescendant={visible && active >= 0 ? `${id}-${active}` : undefined} aria-describedby={`${id}-hint`} autoComplete="off" value={draft} readOnly={busy || adding} placeholder="Search or type a blend…" onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1) }} onChange={event => { setDraft(event.target.value); setRetryIdentities(null); setOpen(true); setActive(-1) }} onKeyDown={event => {
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && draft.trim()) { event.preventDefault(); setOpen(true); setActive(value => event.key === 'ArrowDown' ? Math.min(value + 1, matches.length) : value < 0 ? matches.length : Math.max(0, value - 1)) }
          else if (event.key === 'Escape') { setOpen(false); setActive(-1) }
          else if (event.key === 'Enter' && draft.trim()) { event.preventDefault(); add(visible && active >= 0 ? matches[active] : undefined) }
        }} onPaste={event => {
          if (busy || adding) { event.preventDefault(); return }
          const pasted = event.clipboardData.getData('text')
          if (!/[\r\n]/.test(pasted)) return
          event.preventDefault()
          const names = [...new Set(pasted.split(/\r?\n/).map(name => name.trim()).filter(Boolean))]
          setDraft(names.join('\n')); setOpen(false)
          void addIdentities(names.map(blend => ({ catalogId: null, maker: '', blend })))
        }} />
        {visible && <ul id={`${id}-options`} className="tobacco-suggestions" role="listbox" aria-label="Blend suggestions">
          {matches.map((entry, index) => <li id={`${id}-${index}`} key={entry.id} role="option" aria-selected={active === index} aria-label={`${entry.blend} by ${entry.maker}`} onMouseDown={event => event.preventDefault()} onClick={() => add(entry)}><strong>{entry.blend}</strong><span>{entry.maker}</span></li>)}
          <li id={`${id}-${matches.length}`} role="option" aria-selected={active === matches.length} onMouseDown={event => event.preventDefault()} onClick={() => add()}>Use “{draft.trim()}” as written</li>
        </ul>}
      </div><button type="button" className="button secondary" disabled={busy || adding || !draft.trim()} onClick={() => add()}>{adding ? 'Adding…' : 'Add blend'}</button></div>
      {addError && <p role="alert">{addError} Your entered names are still here. Try adding them again.</p>}
    </div>
    <OrderImporter onAdd={onAdd} />
  </div>
}

function ArtworkChoices({ row, busy, onChooseCommunity }: Pick<PreparationWorkspaceProps, 'busy' | 'onChooseCommunity'> & { row: PreparationRow }) {
  const [page, setPage] = useState<{ labels: GalleryPublicLabel[]; nextCursor: string | null; serving: boolean } | null>(null)
  const [loading, setLoading] = useState(Boolean(row.catalogId)), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  const [choosing, setChoosing] = useState<string | null>(null), [choiceError, setChoiceError] = useState('')
  const current = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!row.catalogId) return
    const controller = new AbortController(); current.current = controller
    searchExactLabels(row.catalogId, undefined, controller.signal).then(result => { if (!controller.signal.aborted) setPage(result) }).catch(failure => { if (!controller.signal.aborted) setError(errorText(failure)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [row.catalogId, attempt])
  const more = async () => {
    if (!row.catalogId || !page?.nextCursor || !current.current) return
    const controller = current.current
    setLoading(true); setError('')
    try { const next = await searchExactLabels(row.catalogId, page.nextCursor, controller.signal); if (!controller.signal.aborted) setPage(previous => ({ ...next, labels: [...(previous?.labels ?? []), ...next.labels] })) }
    catch (failure) { if (!controller.signal.aborted) setError(errorText(failure)) }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }
  const choose = async (label: GalleryPublicLabel) => {
    setChoosing(label.id); setChoiceError('')
    try { await onChooseCommunity(row.id, label) } catch (failure) { setChoiceError(errorText(failure)) } finally { setChoosing(null) }
  }
  if (!row.catalogId) return <p className="field-hint">This is a custom name. Create your own design, or browse community labels to find one.</p>
  return <div className="preparation-choices" aria-busy={loading}>
    {loading && <p className="field-hint" role="status">Checking community designs…</p>}
    {(error || page?.serving === false) && <div className="preparation-notice"><p>Community designs are unavailable right now. You can still create your own.</p><button type="button" className="button quiet" onClick={() => { setLoading(true); setPage(null); setError(''); setAttempt(value => value + 1) }} disabled={loading}>Retry community lookup</button></div>}
    {!loading && !error && page?.serving && !page.labels.length && <p className="field-hint">No community designs for this blend yet.</p>}
    {page?.serving && page.labels.length > 0 && <ul className="preparation-designs" aria-label={`Community designs for ${row.blend}`}>{page.labels.map(label => <li key={label.id}>
      <a className="preparation-design-preview" href={`${API}/labels/${label.id}/artwork`} target="_blank" rel="noreferrer" aria-label={`View ${label.blend}${label.edition ? `, ${label.edition}` : ''} artwork`}><GalleryThumbnail src={`${API}/labels/${label.id}/thumbnail`} alt={label.description} eager={false} /></a>
      <div className="preparation-design-action"><p>{label.edition || 'Community design'}</p>
        <button type="button" className="button primary" disabled={busy || choosing !== null} onClick={() => void choose(label)}>{choosing === label.id ? 'Adding design…' : 'Use this design'}</button>
      </div>
    </li>)}</ul>}
    {choiceError && <p role="alert">{choiceError} Choose the design again to retry.</p>}
    {page?.serving && page.nextCursor && <button type="button" className="button quiet" disabled={loading} onClick={() => void more()}>More designs for this blend</button>}
  </div>
}

function ChangeArtwork(props: Pick<PreparationWorkspaceProps, 'busy' | 'onChooseCommunity'> & { row: PreparationRow }) {
  const [open, setOpen] = useState(false)
  return <details className="preparation-change" onToggle={event => setOpen(event.currentTarget.open)}><summary>Change design</summary>{open && <ArtworkChoices key={props.row.catalogId} {...props} />}</details>
}

function RowNotes({ row, onNotes }: { row: PreparationRow; onNotes: NonNullable<PreparationWorkspaceProps['onNotes']> }) {
  const [editor, setEditor] = useState<{ source: string; value: string; submitted: string | null }>({ source: row.notes ?? '', value: row.notes ?? '', submitted: null })
  const [error, setError] = useState('')
  if (editor.source !== (row.notes ?? '')) setEditor({ ...editor, source: row.notes ?? '', value: editor.value === editor.source || editor.value === editor.submitted ? row.notes ?? '' : editor.value })
  const save = async () => {
    if (editor.value === (row.notes ?? '')) return
    setError('')
    setEditor(current => ({ ...current, submitted: editor.value }))
    try { await onNotes(row.id, editor.value) } catch (failure) { setError(errorText(failure)) }
  }
  return <div className="field"><label htmlFor={`notes-${row.id}`}>Requests for {row.blend} <em>optional</em></label><textarea id={`notes-${row.id}`} rows={2} value={editor.value} onChange={event => setEditor(current => ({ ...current, value: event.target.value }))} onBlur={() => void save()} placeholder="A particular edition or detail to keep" />{error && <p role="alert">{error} Edit the request and leave the field to try saving again.</p>}</div>
}

export function PreparationWorkspace({ rows, busy, onAdd, onRemove, onCreate, onNotes, onResolve, onChooseCommunity, onPrint, onBrowse, onImport, onGenericChat, handoff }: PreparationWorkspaceProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const ready = rows.filter(row => row.artwork).length, toCreate = rows.filter(row => row.createRequested).length
  return <section className="create-workspace preparation-workspace screen-only" aria-labelledby="preparation-title">
    <header className="page-heading"><h1 id="preparation-title" ref={heading} tabIndex={-1}>Choose labels</h1><p>Use a community design or create your own. Print them together when you’re ready.</p></header>
    <section className="panel preparation-start" aria-label="Add labels">
      <BlendIntake busy={busy} onAdd={onAdd} />
      <div className="preparation-entry-actions"><button type="button" className="button quiet" onClick={onBrowse}>Browse community labels</button><button type="button" className="button quiet" onClick={onImport}>Import a label ZIP</button></div>
    </section>
    {rows.length > 0 && <>
      <div className="preparation-summary"><div><h2>Your labels</h2><p role="status">{ready} {ready === 1 ? 'label' : 'labels'} ready{toCreate ? ` · ${toCreate} to create` : ''}{rows.some(row => !row.artwork && !row.createRequested) ? ` · ${rows.filter(row => !row.artwork && !row.createRequested).length} to choose` : ''}</p></div>{ready > 0 && <button type="button" className="button primary" onClick={onPrint}>Print {ready} ready {ready === 1 ? 'label' : 'labels'}</button>}</div>
      <div className="preparation-rows">{rows.map(row => <article className="panel preparation-row" key={row.id} aria-labelledby={`row-${row.id}`}>
        <div className="preparation-row-heading">{row.artwork && <div className="label-thumbnail"><LabelArtwork label={row.artwork} /></div>}<div><h3 id={`row-${row.id}`}>{row.blend}</h3>{row.maker && <p>{row.maker}{row.edition ? ` · ${row.edition}` : ''}</p>}<span className="field-hint">{row.artwork ? row.createRequested ? 'Ready to print · new design requested' : 'Ready to print' : row.createRequested ? 'Included in your creation request' : 'Choose a design below'}</span></div><button type="button" className="button quiet" disabled={busy} aria-label={`Remove ${formatTobacco(row)}`} onClick={() => { onRemove(row.id); heading.current?.focus({ preventScroll: true }) }}>Remove</button></div>
        <div className="preparation-row-content"><div className="preparation-artwork-options">
        {!row.catalogId && !row.artwork && onResolve && searchTobaccos(row.blend, 3).length > 0 && <div className="preparation-identity-options"><p className="field-hint">Match a catalog blend to check its community designs:</p>{searchTobaccos(row.blend, 3).map(entry => <button type="button" className="button quiet" disabled={busy} key={entry.id} onClick={() => onResolve(row.id, identity(entry))}>Match to {formatTobacco(entry)}</button>)}</div>}
        {row.artwork ? <ChangeArtwork row={row} busy={busy} onChooseCommunity={onChooseCommunity} /> : <ArtworkChoices key={row.catalogId} row={row} busy={busy} onChooseCommunity={onChooseCommunity} />}
        </div><div className="preparation-create-choice"><p className="field-hint">{row.createRequested ? 'New artwork requested' : 'Prefer a different design?'}</p><button type="button" className="button secondary" aria-pressed={row.createRequested} disabled={busy} onClick={() => onCreate(row.id, !row.createRequested)}>{row.createRequested ? 'Remove from creation request' : 'Create my own'}</button>{row.createRequested && onNotes && <RowNotes row={row} onNotes={onNotes} />}</div></div>
      </article>)}</div>
    </>}
    {handoff}
    {!rows.length && <p className="preparation-generic"><button type="button" className="button quiet" onClick={onGenericChat}>Choose blends in my AI chat</button></p>}
    <p className="field-hint preparation-storage">Your labels and requests are saved in this browser. Keep downloaded ZIPs for another device or if you clear browser data.</p>
  </section>
}
