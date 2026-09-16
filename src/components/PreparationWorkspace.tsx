import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useRecoveryBlocker } from '../hooks/useAppRecovery'
import { formatTobacco, searchTobaccos, type TobaccoEntry } from '../lib/tobacco-catalog'
import type { GalleryPublicLabel } from '../lib/gallery/types'
import type { PrintLabel } from './ui-model'
import { SelectionSummary } from './SelectionSummary'
import { Icon } from './Icons'
import { CreationSelection } from './CreationSelection'
import { TobaccoSelector, type TobaccoIdentity } from './TobaccoSelector'
import '../styles/label-workspace.css'
import '../styles/preparation-actions.css'
import { LabelArtwork } from './LabelArtwork'
import { GalleryThumbnail } from './gallery/GalleryThumbnail'
import { API, errorText } from './gallery/client'
import { searchExactLabels } from './gallery/search-labels'

export type PreparationIdentity = TobaccoIdentity
export type PreparationRow = PreparationIdentity & { id: string; edition?: string; notes?: string; createRequested: boolean; designId?: string | null; previousDesignId?: string; artwork?: PrintLabel }
export type PreparationWorkspaceProps = {
  rows: PreparationRow[]; busy?: boolean
  onAdd: (identity: PreparationIdentity, choice: GalleryPublicLabel | 'ai') => void | Promise<void>
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
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<PreparationIdentity | null>(null)
  const [confirmation, setConfirmation] = useState('')
  useRecoveryBlocker(draft || pending ? 'Finish adding your blend, or clear the blend search, before updating.' : null)
  useEffect(() => { if (!confirmation) return; const timer = window.setTimeout(() => setConfirmation(''), 6000); return () => window.clearTimeout(timer) }, [confirmation])
  const close = () => { setPending(null); input.current?.focus() }
  const add = (selectedIdentity: PreparationIdentity) => {
    if (busy || pending) return
    setConfirmation('')
    if (rows.some(row => row.catalogId === selectedIdentity.catalogId && row.maker === selectedIdentity.maker && row.blend === selectedIdentity.blend && !row.edition && !row.notes)) {
      setConfirmation(`${selectedIdentity.blend} is already saved. Change its artwork below.`)
      input.current?.focus(); return
    }
    setPending(selectedIdentity)
  }
  return <div className="preparation-intake">
    <TobaccoSelector value={draft} onChange={setDraft} onChoose={add} inputRef={input} disabled={busy} actionLabel="Add blend" hint="Find a blend, then choose a community design or add it to your AI creation list." multilineHint="Add one blend at a time here. To paste a list, choose Add several blends." />
    <p className="selection-confirmation" role="status" aria-atomic="true">{confirmation && `${confirmation} · ${rows.length} ${rows.length === 1 ? 'blend' : 'blends'} selected.`}</p>
    {pending && <BlendArtworkDialog identity={pending} busy={busy} returnFocus={input} onClose={close} onSave={async choice => {
      await onAdd(pending, choice)
      setConfirmation(`${pending.blend} ${choice === 'ai' ? 'added to your AI creation list' : 'is ready to print'}`)
      setDraft('')
      close()
    }} />}
  </div>
}

function BlendArtworkDialog({ identity, busy, returnFocus, onSave, onClose }: {
  identity: PreparationIdentity; busy?: boolean; returnFocus: RefObject<HTMLInputElement | null>; onSave: (choice: GalleryPublicLabel | 'ai') => Promise<void>; onClose: () => void
}) {
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null)
  const inFlight = useRef(false)
  const [saving, setSaving] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    const modal = dialog.current!
    const input = returnFocus.current
    modal.showModal(); heading.current?.focus()
    return () => { modal.close(); input?.focus({ preventScroll: true }) }
  }, [returnFocus])
  const save = async (choice: GalleryPublicLabel | 'ai') => {
    if (inFlight.current || busy) return
    inFlight.current = true; setSaving(true); setError('')
    try { await onSave(choice) }
    catch (failure) { setError(errorText(failure)) }
    finally { inFlight.current = false; setSaving(false) }
  }
  return <dialog ref={dialog} className="import-review-dialog blend-artwork-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); if (!inFlight.current) onClose() }} onKeyDown={event => {
    if (event.key !== 'Tab') return
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }}>
    <header className="import-review-header"><h2 id={`${id}-title`} ref={heading} tabIndex={-1}>Choose artwork for {identity.blend}</h2>{identity.maker && <p>{identity.maker}</p>}<p id={`${id}-description`}>Choose a design to make this label ready to print, or add it to your AI creation list. Nothing is added until you choose.</p></header>
    <div className="import-review-body">
      <div className="blend-ai-choice"><div><h3>Create with AI</h3><p>Add this blend to your list, then create the artwork in your AI chat when you are ready.</p></div><button type="button" className="button secondary" disabled={busy || saving} onClick={() => void save('ai')}>Create with AI</button></div>
      <ArtworkChoices row={{ ...identity, id: 'draft', createRequested: false }} busy={busy || saving} onChooseCommunity={(_id, label) => save(label)} />
      {error && <p role="alert">{error} Nothing was added. Choose again to retry.</p>}
    </div>
    <footer className="import-review-actions">{saving && <p role="status">Saving your label…</p>}<button type="button" className="button quiet" disabled={saving} onClick={onClose}>Cancel</button></footer>
  </dialog>
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
  if (!row.catalogId) return <p className="field-hint">This custom name has no catalog match. To look for community designs, close these choices and use Browse label designs.</p>
  return <div className="preparation-choices" aria-busy={loading}>
    <h3>Community designs</h3>
    <p className="field-hint">Choose one design for this label. If several designs are available, open the artwork to compare them before choosing.</p>
    {loading && <p className="field-hint" role="status">Checking community designs…</p>}
    {(error || page?.serving === false) && <div className="preparation-notice"><p>Community designs are unavailable right now. You can still create your own.</p><button type="button" className="button quiet" onClick={() => { setLoading(true); setPage(null); setError(''); setAttempt(value => value + 1) }} disabled={loading}>Retry community lookup</button></div>}
    {!loading && !error && page?.serving && !page.labels.length && <p className="field-hint">No community designs for this blend yet.</p>}
    {page?.serving && page.labels.length > 0 && <ul className="preparation-designs" aria-label={`Community designs for ${row.blend}`}>{page.labels.map((label, index) => <li key={label.id}>
      <a className="preparation-design-preview" href={`${API}/labels/${label.id}/artwork`} target="_blank" rel="noreferrer" aria-label={`View community design ${index + 1} for ${label.blend}`}><GalleryThumbnail src={`${API}/labels/${label.id}/thumbnail`} alt={label.altText} eager={false} /></a>
      <div className="preparation-design-action"><p>Community design {index + 1}</p>
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
  useRecoveryBlocker(editor.value !== (row.notes ?? '') ? 'Save your label notes before updating.' : null)
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
  useRecoveryBlocker(creationOpen ? 'Save or cancel your artwork selection before updating.' : null)
  const [creationNotice, setCreationNotice] = useState('')
  const [creationError, setCreationError] = useState('')
  const [confirmed, setConfirmed] = useState<{ id: string; designBefore?: string | null } | { identity: PreparationIdentity } | null>(null)
  useEffect(() => {
    if (!confirmed) return
    // This marker is decorative. Saving and focus never wait for its lifetime.
    const timer = window.setTimeout(() => setConfirmed(null), 600)
    return () => window.clearTimeout(timer)
  }, [confirmed])
  const justConfirmed = (row: PreparationRow) => confirmed !== null && ('id' in confirmed ? confirmed.id === row.id && (!('designBefore' in confirmed) || row.designId !== confirmed.designBefore)
    : row.catalogId === confirmed.identity.catalogId && row.maker === confirmed.identity.maker && row.blend === confirmed.identity.blend && !row.edition && !row.notes)
  const requestArtwork = async (row: PreparationRow, requested: boolean) => {
    setCreationError('')
    try {
      await onCreate(row.id, requested)
      setConfirmed({ id: row.id })
      setExpanded(null)
      setCreationNotice(requested ? `${row.blend} added to your creation list.` : row.previousDesignId ? `Previous design restored for ${row.blend}.` : `${row.blend} removed from your creation list.`)
      selectedHeading.current?.focus({ preventScroll: true })
    } catch (failure) { setCreationError(failure instanceof Error ? failure.message : 'Your selection could not be saved. Try again.') }
  }
  const hasArtwork = (row: PreparationRow) => Boolean(row.designId || row.artwork)
  const ready = rows.filter(hasArtwork).length
  const requested = rows.filter(row => row.createRequested)
  const shown = rows.filter(row => filter === 'all' || (filter === 'ready' ? hasArtwork(row) : !hasArtwork(row)))
  const groups = [
    { title: 'Ready to print', rows: shown.filter(hasArtwork) },
    { title: 'To create with AI', rows: shown.filter(row => !hasArtwork(row) && row.createRequested) },
    { title: 'Choose artwork', rows: shown.filter(row => !hasArtwork(row) && !row.createRequested) },
  ]
  const focusList = () => { selectedHeading.current?.scrollIntoView({ block: 'start' }); selectedHeading.current?.focus({ preventScroll: true }) }
  const choose = async (id: string, label: GalleryPublicLabel) => {
    const designBefore = rows.find(row => row.id === id)?.designId
    await onChooseCommunity(id, label)
    // A replacement may only open review. Emphasize the row once saved data changes.
    setConfirmed({ id, designBefore }); setExpanded(null); selectedHeading.current?.focus({ preventScroll: true })
  }
  return <section ref={workspace} className="create-workspace preparation-workspace label-workspace screen-only" aria-labelledby="preparation-title">
    <header className="page-heading"><h1 id="preparation-title">Your labels</h1><p>Choose designs for your blends and keep track of artwork still to create. Print the labels that are ready.</p></header>
    {rows.length > 0 && <SelectionSummary selectedCount={rows.length} readyCount={ready} creationCount={requested.length} onView={requested.length ? undefined : focusList} onPrint={onPrint} busy={busy}>{requested.length > 0 && onContinueCreation && <button className="button primary" type="button" disabled={busy} onClick={onContinueCreation}>Continue to creation</button>}</SelectionSummary>}
    <section className="panel preparation-start" aria-label="Add labels">
      <BlendIntake busy={busy} onAdd={async (identity, choice) => { await onAdd(identity, choice); setConfirmed({ identity }); setFilter('all') }} rows={rows} />
      <div className="preparation-entry-actions preparation-shortcuts">
        {onOrder && <button type="button" className="button secondary" onClick={onOrder}><Icon name="file" size={18} />Add several blends</button>}
        <a className="button secondary" href="/gallery" onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onBrowse() }}><Icon name="research" size={18} />Browse gallery</a>
      </div>
    </section>
    {creationNotice && <p role="status" className="selection-confirmation">{creationNotice}</p>}
    {creationError && <p role="alert">{creationError}</p>}
    {rows.length > 0 && <>
      <div className="workspace-list-heading"><h2 ref={selectedHeading} tabIndex={-1} className="selected-labels-heading">Your saved selection</h2>
      <div className="workspace-filters" role="group" aria-label="Filter your labels">{([['all', `All (${rows.length})`], ['pending', `Needs artwork (${rows.length - ready})`], ['ready', `Ready (${ready})`]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setExpanded(null) }}>{label}</button>)}</div></div>
      {groups.filter(group => group.rows.length > 0).map(group => <section className="preparation-group" key={group.title} aria-label={group.title}><h3>{group.title} <span className="field-hint">({group.rows.length})</span></h3>{group.title === 'Choose artwork' && <p className="field-hint">These saved blends still need a community design or an AI creation request.</p>}
      <div className="preparation-rows">{group.rows.map(row => <article className="panel preparation-row" key={row.id} data-confirmed={justConfirmed(row) || undefined} aria-labelledby={`row-${row.id}`}>
        <div className="preparation-row-heading">
          {row.artwork ? <div className="label-thumbnail"><LabelArtwork label={row.artwork} /></div> : <div className="workspace-art-placeholder" aria-hidden="true"><Icon name="spark" size={20} /></div>}
          <div className="workspace-row-title"><h4 id={`row-${row.id}`}>{row.blend}</h4>{row.maker && <p>{row.maker}{row.edition ? ` · ${row.edition}` : ''}</p>}<span className="field-hint workspace-row-status">{hasArtwork(row) && <Icon name="check" size={14} />}{hasArtwork(row) ? 'Ready to print' : row.previousDesignId ? 'To create with AI · previous design saved' : row.createRequested ? 'To create with AI' : 'Needs artwork'}</span></div>
          <div className="workspace-row-actions"><button type="button" className="button secondary" aria-expanded={expanded === row.id} aria-controls={expanded === row.id ? `choices-${row.id}` : undefined} onClick={() => setExpanded(current => current === row.id ? null : row.id)}>{expanded === row.id ? 'Close choices' : row.artwork ? 'Change design' : 'Choose design'}</button>{row.createRequested && <button type="button" className="button quiet" disabled={busy} onClick={() => void requestArtwork(row, false)}>{row.previousDesignId ? 'Use previous design' : 'Cancel new artwork request'}</button>}<button type="button" className="button quiet" disabled={busy} aria-label={`Remove ${formatTobacco(row)}`} onClick={() => { onRemove(row.id); if (rows.length === 1) workspace.current?.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus(); else selectedHeading.current?.focus({ preventScroll: true }) }}>Remove</button></div>
        </div>
        {expanded === row.id && <div id={`choices-${row.id}`} className="preparation-row-content"><div className="preparation-artwork-options">
          {!row.catalogId && onResolve && searchTobaccos(row.blend, 3).length > 0 && <div className="preparation-identity-options"><p className="field-hint">Match a catalog blend to check its community designs:</p>{searchTobaccos(row.blend, 3).map(entry => <button type="button" className="button quiet" disabled={busy} key={entry.id} onClick={() => onResolve(row.id, identity(entry))}>Match to {formatTobacco(entry)}</button>)}</div>}
          <ArtworkChoices key={row.catalogId} row={row} busy={busy} onChooseCommunity={choose} />
        </div><div className="preparation-create-choice"><p className="field-hint">{row.createRequested ? 'Selected for creation' : row.artwork ? 'Creating a new design will leave this label off your print sheet. You can restore the previous design at any time.' : 'Create artwork for this label'}</p>{!row.createRequested && <button type="button" className="button secondary" disabled={busy} onClick={() => void requestArtwork(row, true)}>Create my own</button>}</div></div>}
      </article>)}</div></section>)}
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
