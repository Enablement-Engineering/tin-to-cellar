import { useEffect, useId, useRef, useState } from 'react'
import { formatTobacco, searchTobaccos, type TobaccoEntry } from '../lib/tobacco-catalog'
import type { GalleryPublicLabel } from '../lib/gallery/types'
import type { PrintLabel } from './ui-model'
import { SelectionSummary } from './SelectionSummary'
import { Icon } from './Icons'
import { CreationSelection } from './CreationSelection'
import '../styles/label-workspace.css'
import '../styles/preparation-actions.css'
import { LabelArtwork } from './LabelArtwork'
import { GalleryThumbnail } from './gallery/GalleryThumbnail'
import { API, errorText } from './gallery/client'
import { searchExactLabels } from './gallery/search-labels'

export type PreparationIdentity = { catalogId: string | null; maker: string; blend: string }
export type PreparationRow = PreparationIdentity & { id: string; edition?: string; notes?: string; createRequested: boolean; previousDesignId?: string; artwork?: PrintLabel }
export type PreparationWorkspaceProps = {
  rows: PreparationRow[]; busy?: boolean
  onAdd: (identities: PreparationIdentity[]) => void | Promise<void>
  onRemove: (rowId: string) => void
  onCreate: (rowId: string, requested: boolean) => void | Promise<void>
  onNotes?: (rowId: string, notes: string) => void | Promise<void>
  onResolve?: (rowId: string, identity: PreparationIdentity) => void
  onChooseCommunity: (rowId: string, label: GalleryPublicLabel) => Promise<void>
  onOrder?: () => void; onCreateMany?: (ids: string[]) => Promise<void>
  onPrint: () => void; onBrowse: () => void; onImport: () => void; onGenericChat: () => void
  onContinueCreation?: () => void
}
const identity = (entry: TobaccoEntry): PreparationIdentity => ({ catalogId: entry.id, maker: entry.maker, blend: entry.blend })

function BlendIntake({ busy, onAdd, rows }: Pick<PreparationWorkspaceProps, 'busy' | 'onAdd' | 'rows'>) {
  const id = useId(), input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(''), [open, setOpen] = useState(false), [active, setActive] = useState(-1)
  const [adding, setAdding] = useState(false), [addError, setAddError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  useEffect(() => { if (!confirmation) return; const timer = window.setTimeout(() => setConfirmation(''), 6000); return () => window.clearTimeout(timer) }, [confirmation])
  const [retryIdentities, setRetryIdentities] = useState<PreparationIdentity[] | null>(null)
  const matches = searchTobaccos(draft, 6), visible = open && Boolean(draft.trim())
  useEffect(() => { if (visible && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: 'nearest' }) }, [visible, active, id])
  const addIdentities = async (identities: PreparationIdentity[]) => {
    if (busy || adding) return
    setAdding(true); setAddError(''); setConfirmation('')
    setRetryIdentities(identities)
    try {
      const saved = onAdd(identities)
      if (saved) await saved
      const first = identities[0]
      const exists = first && rows.some(row => row.maker === first.maker && row.blend === first.blend)
      setConfirmation(identities.length === 1 ? `${first.blend} ${exists ? 'is already selected' : 'added'}` : 'Selection saved')
      setDraft(''); setRetryIdentities(null); setOpen(false); setActive(-1); input.current?.focus()
    } catch (failure) { setAddError(errorText(failure)) }
    finally { setAdding(false) }
  }
  const selected = active >= 0 ? active : matches.length === 1 ? 0 : -1
  const submit = () => {
    if (selected >= 0) add(matches[selected])
    else if (!matches.length) add()
    else { setOpen(true); setAddError('Choose a catalog match below, or use this name without a catalog match.') }
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
        <input id={id} ref={input} type="text" role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={visible ? `${id}-options` : undefined} aria-activedescendant={visible && selected >= 0 ? `${id}-${selected}` : undefined} aria-describedby={`${id}-hint`} autoComplete="off" value={draft} readOnly={busy || adding} placeholder="Search or type a blend…" onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1) }} onChange={event => { setDraft(event.target.value); setRetryIdentities(null); setOpen(true); setActive(-1) }} onKeyDown={event => {
          if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && draft.trim()) { event.preventDefault(); setOpen(true); setActive(value => event.key === 'ArrowDown' ? Math.min(value + 1, matches.length) : value < 0 ? matches.length : Math.max(0, value - 1)) }
          else if (event.key === 'Escape') { setOpen(false); setActive(-1) }
          else if (event.key === 'Enter' && draft.trim()) { event.preventDefault(); submit() }
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
          {matches.map((entry, index) => <li id={`${id}-${index}`} key={entry.id} role="option" aria-selected={selected === index} aria-label={`${entry.blend} by ${entry.maker}`} onMouseDown={event => event.preventDefault()} onClick={() => add(entry)}><strong>{entry.blend}</strong><span>{entry.maker}</span></li>)}
          <li id={`${id}-${matches.length}`} role="option" aria-selected={selected === matches.length} onMouseDown={event => event.preventDefault()} onClick={() => add()}>Use “{draft.trim()}” without a catalog match</li>
        </ul>}
      </div><button type="button" className="button secondary" disabled={busy || adding || !draft.trim()} onClick={submit}>{adding ? 'Adding…' : 'Add blend'}</button></div>
      <p className="selection-confirmation" role="status" aria-atomic="true">{confirmation && `${confirmation} · ${rows.length} ${rows.length === 1 ? 'blend' : 'blends'} selected.`}</p>
      {addError && <p role="alert">{addError} Your entered names are still here. Try adding them again.</p>}
    </div>
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
    <h4>Community examples</h4>
    <p className="field-hint">Choose one design for this label. If several examples are available, open the artwork to compare them before choosing.</p>
    {loading && <p className="field-hint" role="status">Checking community designs…</p>}
    {(error || page?.serving === false) && <div className="preparation-notice"><p>Community designs are unavailable right now. You can still create your own.</p><button type="button" className="button quiet" onClick={() => { setLoading(true); setPage(null); setError(''); setAttempt(value => value + 1) }} disabled={loading}>Retry community lookup</button></div>}
    {!loading && !error && page?.serving && !page.labels.length && <p className="field-hint">No community designs for this blend yet.</p>}
    {page?.serving && page.labels.length > 0 && <ul className="preparation-designs" aria-label={`Community examples for ${row.blend}`}>{page.labels.map((label, index) => <li key={label.id}>
      <a className="preparation-design-preview" href={`${API}/labels/${label.id}/artwork`} target="_blank" rel="noreferrer" aria-label={`View community example ${index + 1} for ${label.blend}`}><GalleryThumbnail src={`${API}/labels/${label.id}/thumbnail`} alt={label.description} eager={false} /></a>
      <div className="preparation-design-action"><p>Community example {index + 1}</p>
        <button type="button" className="button primary" disabled={busy || choosing !== null} onClick={() => void choose(label)}>{choosing === label.id ? 'Adding design…' : 'Use this design'}</button>
      </div>
    </li>)}</ul>}
    {choiceError && <p role="alert">{choiceError} Choose the design again to retry.</p>}
    {page?.serving && page.nextCursor && <button type="button" className="button quiet" disabled={loading} onClick={() => void more()}>More designs for this blend</button>}
  </div>
}

export function RowNotes({ row, onNotes }: { row: PreparationRow; onNotes: NonNullable<PreparationWorkspaceProps['onNotes']> }) {
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

export function PreparationWorkspace({ rows, busy, onAdd, onRemove, onCreate, onCreateMany, onOrder, onResolve, onChooseCommunity, onPrint, onBrowse, onImport, onGenericChat, onContinueCreation }: PreparationWorkspaceProps) {
  const workspace = useRef<HTMLElement>(null)
  const selectedHeading = useRef<HTMLHeadingElement>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'ready'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [creationOpen, setCreationOpen] = useState(false)
  const [creationNotice, setCreationNotice] = useState('')
  const [creationError, setCreationError] = useState('')
  const requestArtwork = async (row: PreparationRow, requested: boolean) => {
    setCreationError('')
    try {
      await onCreate(row.id, requested)
      setExpanded(null)
      setCreationNotice(requested ? `${row.blend} added to your creation list.` : row.previousDesignId ? `Previous design restored for ${row.blend}.` : `${row.blend} removed from your creation list.`)
      selectedHeading.current?.focus({ preventScroll: true })
    } catch (failure) { setCreationError(failure instanceof Error ? failure.message : 'Your selection could not be saved. Try again.') }
  }
  const ready = rows.filter(row => row.artwork).length
  const requested = rows.filter(row => row.createRequested)
  const shown = rows.filter(row => filter === 'all' || (filter === 'ready' ? Boolean(row.artwork) : !row.artwork))
  const focusList = () => { selectedHeading.current?.scrollIntoView({ block: 'start' }); selectedHeading.current?.focus({ preventScroll: true }) }
  const choose = async (id: string, label: GalleryPublicLabel) => { await onChooseCommunity(id, label); setExpanded(null); selectedHeading.current?.focus({ preventScroll: true }) }
  return <section ref={workspace} className="create-workspace preparation-workspace label-workspace screen-only" aria-labelledby="preparation-title">
    <header className="page-heading"><h1 id="preparation-title">Your labels</h1><p>Choose artwork for each blend. Your community designs and new artwork stay together here.</p></header>
    {rows.length > 0 && <SelectionSummary selectedCount={rows.length} readyCount={ready} creationCount={requested.length} onView={requested.length ? undefined : focusList} onPrint={onPrint} busy={busy}>{requested.length > 0 && onContinueCreation && <button className="button primary" type="button" disabled={busy} onClick={onContinueCreation}>Continue to creation</button>}</SelectionSummary>}
    <section className="panel preparation-start" aria-label="Add labels">
      <BlendIntake busy={busy} onAdd={onAdd} rows={rows} />
      <div className="preparation-entry-actions preparation-shortcuts">
        {onOrder && <button type="button" className="button secondary" onClick={onOrder}><Icon name="file" size={18} />Add several blends</button>}
        <button type="button" className="button secondary" onClick={onBrowse}><Icon name="research" size={18} />Browse label designs</button>
      </div>
    </section>
    {creationNotice && <p role="status" className="selection-confirmation">{creationNotice}</p>}
    {creationError && <p role="alert">{creationError}</p>}
    {rows.length > 0 && <>
      <div className="workspace-list-heading"><h2 ref={selectedHeading} tabIndex={-1} className="selected-labels-heading">Your saved selection</h2>
      <div className="workspace-filters" role="group" aria-label="Filter your labels">{([['all', `All (${rows.length})`], ['pending', `Needs artwork (${rows.length - ready})`], ['ready', `Ready (${ready})`]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setExpanded(null) }}>{label}</button>)}</div></div>
      <div className="preparation-rows">{shown.map(row => <article className="panel preparation-row" key={row.id} aria-labelledby={`row-${row.id}`}>
        <div className="preparation-row-heading">
          {row.artwork ? <div className="label-thumbnail"><LabelArtwork label={row.artwork} /></div> : <div className="workspace-art-placeholder" aria-hidden="true"><Icon name="spark" size={20} /></div>}
          <div className="workspace-row-title"><h3 id={`row-${row.id}`}>{row.blend}</h3>{row.maker && <p>{row.maker}{row.edition ? ` · ${row.edition}` : ''}</p>}<span className="field-hint">{row.artwork ? 'Ready to print' : row.previousDesignId ? 'Needs new artwork · previous design saved' : row.createRequested ? 'Selected for creation' : 'Needs artwork'}</span></div>
          <div className="workspace-row-actions"><button type="button" className="button secondary" aria-expanded={expanded === row.id} aria-controls={expanded === row.id ? `choices-${row.id}` : undefined} onClick={() => setExpanded(current => current === row.id ? null : row.id)}>{expanded === row.id ? 'Close choices' : row.artwork ? 'Change design' : 'Choose design'}</button>{row.createRequested && <button type="button" className="button quiet" disabled={busy} onClick={() => void requestArtwork(row, false)}>{row.previousDesignId ? 'Use previous design' : 'Cancel new artwork request'}</button>}<button type="button" className="button quiet" disabled={busy} aria-label={`Remove ${formatTobacco(row)}`} onClick={() => { onRemove(row.id); if (rows.length === 1) workspace.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus(); else selectedHeading.current?.focus({ preventScroll: true }) }}>Remove</button></div>
        </div>
        {expanded === row.id && <div id={`choices-${row.id}`} className="preparation-row-content"><div className="preparation-artwork-options">
          {!row.catalogId && onResolve && searchTobaccos(row.blend, 3).length > 0 && <div className="preparation-identity-options"><p className="field-hint">Match a catalog blend to check its community designs:</p>{searchTobaccos(row.blend, 3).map(entry => <button type="button" className="button quiet" disabled={busy} key={entry.id} onClick={() => onResolve(row.id, identity(entry))}>Match to {formatTobacco(entry)}</button>)}</div>}
          <ArtworkChoices key={row.catalogId} row={row} busy={busy} onChooseCommunity={choose} />
        </div><div className="preparation-create-choice"><p className="field-hint">{row.createRequested ? 'Selected for creation' : row.artwork ? 'Creating a new design will leave this label off your print sheet. You can restore the previous design at any time.' : 'Create artwork for this label'}</p>{!row.createRequested && <button type="button" className="button secondary" disabled={busy} onClick={() => void requestArtwork(row, true)}>Create my own</button>}</div></div>}
      </article>)}</div>
      {!shown.length && <p className="panel" role="status">{filter === 'ready' ? 'No artwork is ready yet. Choose a design or request new artwork.' : 'Every saved label has artwork.'}</p>}
      <section className="panel workspace-creation" aria-labelledby="workspace-creation-title"><div><h2 id="workspace-creation-title">Create artwork in your AI chat</h2><p>{requested.length ? `${requested.length} ${requested.length === 1 ? 'label selected' : 'labels selected'} for creation. Continue to review your request and copy the instructions.` : 'Choose labels, copy the instructions into your AI chat, then bring back the finished ZIP.'}</p></div>
        {onCreateMany && <button className="button secondary" type="button" disabled={busy} onClick={() => setCreationOpen(true)}>{requested.length ? 'Edit creation list' : 'Choose artwork to create'}</button>}
        {requested.length > 0 && <ul className="workspace-request-list" aria-label="Requested artwork">{requested.map(row => <li key={row.id}>{row.blend}{row.previousDesignId ? ' · previous design saved' : ''}</li>)}</ul>}
      </section>
    </>}
    {creationOpen && onCreateMany && <CreationSelection rows={rows} busy={busy} onSave={async ids => { await onCreateMany(ids); if (ids.length) onContinueCreation?.() }} onClose={() => setCreationOpen(false)} />}
    <p className="preparation-import-return"><button type="button" className="button quiet" onClick={onImport}><Icon name="upload" size={18} />I already have a finished ZIP</button></p>
    {!rows.length && <p className="preparation-generic"><button type="button" className="button quiet" onClick={onGenericChat}><Icon name="spark" size={18} />Choose blends in my AI chat</button></p>}
    <p className="field-hint preparation-storage">Your labels and requests are saved in this browser. Keep downloaded ZIPs for another device or if you clear browser data.</p>
  </section>
}
