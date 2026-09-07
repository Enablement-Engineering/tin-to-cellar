import { useEffect, useMemo, useRef, useState } from 'react'
import { useSavedSources } from './lib/prompt/use-saved-sources'
import { buildCollectionHandoff, buildGenericChatHandoff, buildTinToCellarInstructions, buildCellarPackRepairPrompt } from './lib/prompt'
import { ContributionStatus } from './components/ContributionStatus'
import { contributionFromManifest } from './lib/contributions'
import { checkAvery94502Compatibility } from './lib/sheets'
import { HowItWorks } from './components/HowItWorks'
import { Landing } from './components/Landing'
import { Privacy } from './components/Privacy'
import { About } from './components/About'
import { Inspiration } from './components/Inspiration'
import { SiteFooter } from './components/SiteFooter'
import { Wordmark } from './components/Wordmark'
import { ProtocolWarning } from './components/ProtocolWarning'
import { StandaloneFeedback } from './components/StandaloneFeedback'
import { parseRetrospective, RETROSPECTIVE_KEY, type Retrospective } from './lib/feedback/retrospective'
import { websiteValidation } from './lib/contributions/validation'
import { resolveProtocolContext } from './lib/protocol'
import { ExamplePack } from './components/ExamplePack'
import { PackImporter } from './components/PackImporter'
import { PrintStudio } from './components/PrintStudio'
import { PromptHandoff } from './components/PromptHandoff'
import { PreparationWorkspace } from './components/PreparationWorkspace'
import { CollectionImportReview } from './components/CollectionImportReview'
import type { ImportSummary } from './components/ui-model'
import type { CellarPackImportResult } from './lib/cellarpack'
import { GalleryBrowse, GallerySubmission, GalleryAdmin } from './components/gallery'
import { useConfig as useGalleryConfig } from './components/gallery/client'
import { downloadPublishedPack } from './components/gallery/pack-builder'
import { validChoice, MAX_PACK_LABELS, type PackChoice } from './components/gallery/pack-selection'
import { addRequests, updateRow, removeRow, setPrintSettings, setHandoff, setReceiptDelivery, prepareImport, planImport, applyImport, exportCollection, type Collection, type CollectionOrigin, type ImportCandidate, type ImportDecisions, type ImportPlan } from './lib/collection'
import { useCollection } from './hooks/useCollection'
import { usePrintLabels } from './hooks/usePrintLabels'
import { formatTobacco } from './lib/tobacco-catalog'

const viewPaths = { home: '/', labels: '/labels', create: '/labels/create', print: '/labels/print', help: '/labels/help', about: '/about', inspiration: '/inspiration', privacy: '/privacy', gallery: '/gallery', 'gallery-admin': '/admin/gallery' } as const
type View = keyof typeof viewPaths
function viewFromPath(): View | 'not-found' {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/'
  if (pathname === '/') { window.history.replaceState(window.history.state, '', `/labels${window.location.search}${window.location.hash}`); return 'labels' }
  return (Object.keys(viewPaths) as View[]).find(view => viewPaths[view] === pathname) ?? 'not-found'
}
function issueText(issue: { message?: string; recovery?: string }) { return [issue.message ?? 'The label needs repair.', issue.recovery].filter(Boolean).join(' ') }
function defaultDecisions(plan: ImportPlan): ImportDecisions {
  return Object.fromEntries(plan.entries.map(entry => [entry.designId, entry.kind === 'fill' ? { action: 'replace', rowId: entry.matchRowIds[0] } : { action: entry.kind === 'add' ? 'add' : 'skip' }]))
}
const ignoreHandledError = () => undefined
const targetKey = (targets: { rowId: string; revision: number }[]) => JSON.stringify(targets.map(target => [target.rowId, target.revision]))
const importReviewKey = (collection: Collection, candidate: ImportCandidate) => JSON.stringify([candidate.receipt.id, collection.handoff?.id, collection.rows.map(row => [row.id, row.revision, row.designId])])

export default function PublicApp() {
  const { config: galleryConfig } = useGalleryConfig()
  const { collection, ready, saving, error: storageError, commit } = useCollection()
  const labels = usePrintLabels(collection)
  const [view, setView] = useState<View | 'not-found'>(viewFromPath)
  const main = useRef<HTMLElement>(null)
  const focusAfterImport = useRef(false)
  const previousView = useRef(view)
  const navigate = (next: View) => {
    if (next === 'home') next = 'labels'
    setView(next)
    if (next === view) { main.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, left: 0 }) }
    if (window.location.pathname !== viewPaths[next] || window.location.hash) window.history.pushState({}, '', viewPaths[next])
  }
  useEffect(() => {
    if (previousView.current !== view) { main.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, left: 0 }); previousView.current = view }
  }, [view])
  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const onPopState = () => setView(viewFromPath())
    window.addEventListener('popstate', onPopState)
    return () => { window.removeEventListener('popstate', onPopState); window.history.scrollRestoration = previousRestoration }
  }, [])

  const [importing, setImporting] = useState(false)
  const importBusy = useRef(false)
  const [candidate, setCandidate] = useState<ImportCandidate | null>(null)
  const review = useMemo(() => candidate ? planImport(collection, candidate) : null, [collection, candidate])
  const reviewKey = candidate ? importReviewKey(collection, candidate) : ''
  const [reviewChoices, setReviewChoices] = useState<{ key: string; values: ImportDecisions } | null>(null)
  const decisions = reviewChoices?.key === reviewKey ? reviewChoices.values : review ? defaultDecisions(review) : {}
  const reviewInvalidated = reviewChoices !== null && reviewChoices.key !== reviewKey
  const setDecisions = (values: ImportDecisions) => setReviewChoices({ key: reviewKey, values })
  const [notice, setNotice] = useState('')
  const [importError, setImportError] = useState('')
  const [importLoadError, setImportLoadError] = useState(false)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [freshReceipts, setFreshReceipts] = useState<Set<string>>(() => new Set())
  const [notes, setNotes] = useState<Record<string, Retrospective>>({})
  const [repairStatus, setRepairStatus] = useState('')
  const [showRepair, setShowRepair] = useState(false)
  const [genericChat, setGenericChat] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [legacyRestoring, setLegacyRestoring] = useState(false)
  const [legacyChoices, setLegacyChoices] = useState<PackChoice[]>(() => {
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem('gallery-pack-selection') ?? '[]')
      return Array.isArray(value) && value.length <= MAX_PACK_LABELS && value.every(validChoice) ? value : []
    } catch { return [] }
  })
  const busy = importing || saving || legacyRestoring || !ready
  useEffect(() => {
    if (!focusAfterImport.current || view !== 'print' || candidate || busy) return
    if (collection.rows.some(row => row.designId) && !labels.length) return
    const target = main.current?.querySelector<HTMLElement>('.quantity-panel h2') ?? main.current?.querySelector<HTMLElement>('.importer h2')
    if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); focusAfterImport.current = false }
  }, [collection.revision, collection.rows, labels.length, view, candidate, busy])
  const currentReceipt = candidate?.receipt ?? collection.receipts.find(receipt => receipt.id === receiptId) ?? collection.receipts.at(-1)
  const summary: ImportSummary | null = currentReceipt ? {
    title: currentReceipt.title,
    status: currentReceipt.quarantined.length || currentReceipt.issues.some(issue => issue.severity === 'error' || issue.severity === 'fatal') ? 'partial' : 'ready',
    labels: candidate ? candidate.designs.map(design => ({ id: design.id, maker: design.item.label.maker, blend: design.item.label.blend, imageUrl: '', imageFrame: { left: 0, top: 0, width: 100, height: 100 } })) : labels.filter(label => collection.designs[collection.rows.find(row => row.id === label.id)?.designId ?? '']?.receiptId === currentReceipt.id),
    issues: currentReceipt.issues.filter(issue => issue.code !== 'MISSING_PREVIEW').map(issueText),
    quarantined: currentReceipt.quarantined,
  } : null
  if (summary && !summary.labels.length && (summary.issues.length || summary.quarantined.length)) summary.status = 'rejected'

  const creationRows = useMemo(() => collection.rows.filter(row => row.createRequested), [collection.rows])
  const targets = creationRows.map(({ id, revision, catalogId, maker, blend, edition, notes }) => ({ rowId: id, revision, catalogId, maker, blend, edition, notes }))
  const sourcesText = creationRows.map(formatTobacco).join('\n')
  const savedSources = useSavedSources(sourcesText, view === 'create' && creationRows.length > 0)
  const requestedKey = targetKey(targets)
  const frozen = collection.handoff && targetKey(collection.handoff.targets) === requestedKey && (targets.length > 0 || genericChat && collection.handoff.targets.length === 0) ? collection.handoff : null
  const handoffDraft = useMemo(() => {
    if (frozen) return frozen
    const input = {
      tobaccos: creationRows.map(row => ({ maker: row.maker || undefined, blend: row.blend, notes: [row.edition, row.notes].filter(Boolean).join('; ') })),
      savedSources,
      geometry: { shape: 'circle' as const, width: 2.5, height: 2.5, diameter: 2.5, unit: 'in' as const },
      websiteUrl: window.location.href,
      printPreference: 'tin-to-cellar:avery-94502@1',
      artDirection: 'Use 0.125 inch bleed on every side and integrate a blank, light date-writing surface into the artwork, with no words or writing line.',
    }
    return creationRows.length ? buildCollectionHandoff(input) : genericChat ? buildGenericChatHandoff(input) : null
  }, [frozen, creationRows, savedSources, genericChat])
  const instructions = useMemo(() => buildTinToCellarInstructions(window.location.href), [])
  const copyHandoff = async () => {
    if (!handoffDraft) throw new Error('Choose at least one label to create first.')
    const saved = await commit(current => {
      const actual = current.rows.filter(row => row.createRequested).map(row => ({ rowId: row.id, revision: row.revision }))
      if (targetKey(actual) !== requestedKey) throw new Error('Your label choices changed. Review the updated prompt before copying.')
      if (current.handoff && current.handoff.prompt === handoffDraft.prompt && targetKey(current.handoff.targets) === requestedKey) return current
      return setHandoff(current, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), targets, prompt: handoffDraft.prompt, request: handoffDraft.request, protocolRevision: handoffDraft.protocolRevision, copied: false })
    })
    return saved.handoff!.prompt
  }
  const saveCandidate = async (incoming: ImportCandidate, plan: ImportPlan, choices: ImportDecisions) => {
    const saved = await commit(current => applyImport(current, plan, choices))
    if (incoming.receipt.contribution && !collection.receipts.some(receipt => receipt.id === incoming.receipt.id || receipt.contribution?.submissionId === incoming.receipt.contribution?.submissionId)) setFreshReceipts(previous => new Set(previous).add(incoming.receipt.id))
    setReceiptId(incoming.receipt.id); setCandidate(null)
    const count = saved.rows.filter(row => row.designId).length
    setNotice(`${incoming.receipt.repairPrompt ? incoming.designs.length ? 'Some labels need repair. ' : 'ZIP needs repair. ' : ''}${count} ${count === 1 ? 'label' : 'labels'} ready.`)
    return saved
  }
  const processResult = async (result: CellarPackImportResult, title: string, origin: CollectionOrigin, publicationId?: string, rowId?: string) => {
    const context = resolveProtocolContext(result.manifest?.extensions)
    const issues = [...result.issues]
    const quarantinedLabels = [...result.quarantinedLabels]
    const usable = result.labels.filter(item => {
      const compatibility = checkAvery94502Compatibility(item.label.surface)
      if (compatibility.compatible) return true
      const failures = compatibility.issues.map(issue => ({ ...issue, labelId: item.id, severity: 'error' as const, recovery: 'Return this label as a 2.5-inch circle for Avery 94502. Do not stretch the artwork.' }))
      issues.push(...failures); quarantinedLabels.push({ id: item.id, label: item.label, issues: failures })
      return false
    })
    const status = usable.length ? (quarantinedLabels.length || result.status !== 'ready' || issues.some(issue => ['fatal', 'error'].includes(issue.severity)) ? 'partial' : 'ready') : 'rejected'
    const repairIssues = [...issues, ...quarantinedLabels.flatMap(item => item.issues)]
    const contribution = origin === 'local' && result.manifest ? await contributionFromManifest(result.manifest, websiteValidation(status, repairIssues)) : null
    const incoming = await prepareImport({ ...result, labels: usable, quarantinedLabels, issues, status }, { origin, publicationId, protocolContext: context, repairPrompt: status !== 'ready' ? buildCellarPackRepairPrompt(repairIssues, context) : '', contribution })
    incoming.receipt.title = (result.manifest?.title ?? title).slice(0, 300)
    if (contribution?.feedback && 'protocolRevision' in contribution.feedback) {
      const retrospective = parseRetrospective(result.manifest?.extensions?.[RETROSPECTIVE_KEY])
      if (retrospective && retrospective.protocolRevision === contribution.feedback.protocolRevision) setNotes(previous => ({ ...previous, [incoming.receipt.id]: retrospective }))
    }
    const plan = planImport(collection, incoming)
    if (origin === 'gallery' && usable.length === 1) {
      const choices = defaultDecisions(plan)
      const entry = plan.entries[0]
      if (entry && (rowId || entry.kind !== 'duplicate')) choices[entry.designId] = rowId ? { action: 'replace', rowId } : { action: 'add' }
      await saveCandidate(incoming, plan, choices)
    } else if (!incoming.designs.length) await saveCandidate(incoming, plan, {})
    else { setCandidate(incoming); setReviewChoices({ key: importReviewKey(collection, incoming), values: defaultDecisions(plan) }) }
  }
  const handlePack = async (file: File, origin: CollectionOrigin = 'local') => {
    if (importBusy.current || !ready) return
    importBusy.current = true; setImporting(true); setImportError(''); setImportLoadError(false); setRepairStatus(''); setShowRepair(false); setNotice('')
    try {
      const { importCellarPack } = await import('./lib/cellarpack')
      await processResult(await importCellarPack(await file.arrayBuffer()), file.name, origin)
      navigate('print')
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'The selected ZIP could not be read.'
      if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)) setImportLoadError(true)
      else setImportError(message)
    } finally { importBusy.current = false; setImporting(false) }
  }
  const chooseCommunity = async (choice: PackChoice, rowId?: string) => {
    if (importBusy.current || !ready) throw new Error('Wait for the current label to finish saving, then try again.')
    importBusy.current = true; setImporting(true); setImportError('')
    try { const { file, result } = await downloadPublishedPack(choice); await processResult(result, file.name, 'gallery', choice.id, rowId) }
    finally { importBusy.current = false; setImporting(false) }
  }
  const restoreLegacy = async () => {
    if (legacyRestoring) return
    setLegacyRestoring(true)
    try {
      for (const choice of legacyChoices) {
        const { file, result } = await downloadPublishedPack(choice)
        const incoming = await prepareImport(result, { origin: 'gallery', publicationId: choice.id })
        incoming.receipt.title = file.name
        await commit(current => { const plan = planImport(current, incoming); return applyImport(current, plan, Object.fromEntries(plan.entries.map(entry => [entry.designId, { action: entry.kind === 'duplicate' ? 'skip' : 'add' }]))) })
      }
      sessionStorage.removeItem('gallery-pack-selection'); setLegacyChoices([])
    } catch (failure) { setImportError(failure instanceof Error ? failure.message : 'The previous selection could not be restored. It is still saved for retry.') }
    finally { setLegacyRestoring(false) }
  }
  const download = async () => {
    setDownloading(true); setImportError('')
    try {
      const file = await exportCollection(collection)
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'your-labels.cellarpack.zip'; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (failure) { setImportError(failure instanceof Error ? failure.message : 'The labels could not be downloaded. Your saved work is unchanged.') }
    finally { setDownloading(false) }
  }
  const copyRepair = async () => {
    if (!currentReceipt?.repairPrompt) return
    try { await navigator.clipboard.writeText(currentReceipt.repairPrompt); setRepairStatus('Copied. Paste this into the same AI chat, then add the corrected ZIP.') }
    catch { setShowRepair(true); setRepairStatus('Select and copy the repair request below, then paste it into the same chat.') }
  }
  const acceptImport = async () => {
    if (!candidate || !review || reviewInvalidated) return
    focusAfterImport.current = true
    try { await saveCandidate(candidate, review, decisions) }
    catch (failure) { focusAfterImport.current = false; setImportError(failure instanceof Error ? failure.message : 'Your labels could not be saved. Review the selection and try again.') }
  }
  const quantities = Object.fromEntries(collection.rows.map(row => [row.id, row.quantity]))
  const communityHashes = new Set(collection.receipts.flatMap(receipt => receipt.knownGalleryHashes ?? []))
  const shareableLabels = Object.values(collection.designs).filter(design => design.origin === 'local' && !communityHashes.has(design.item.artwork.asset.sha256)).map(design => ({ ...design.item, id: design.id, label: { ...design.item.label, id: design.id } }))
  const intake = <div className="import-section screen-only">
    <PackImporter busy={busy} summary={summary} onFile={handlePack} />
    {review && candidate && <CollectionImportReview collection={collection} plan={review} decisions={decisions} onChange={setDecisions} onAccept={() => void acceptImport()} onCancel={() => { setCandidate(null) }} busy={busy} invalidated={reviewInvalidated} onRefresh={() => setDecisions(defaultDecisions(review))} />}
    {collection.receipts.length > 1 && <label>Import report<select value={currentReceipt?.id ?? ''} onChange={event => { setCandidate(null); setReceiptId(event.target.value); setRepairStatus(''); setShowRepair(false) }}>{collection.receipts.map(receipt => <option key={receipt.id} value={receipt.id}>{receipt.title}</option>)}</select></label>}
    {currentReceipt && <ProtocolWarning context={currentReceipt.protocolContext} feedback={currentReceipt.contribution?.feedback} />}
    {summary?.status === 'rejected' && <StandaloneFeedback />}
    {importLoadError && <div className="panel" role="alert"><h3>The label reader couldn’t load</h3><p>The app may have updated, or the connection was interrupted. Reload the page, then choose the same ZIP again. Your saved labels will remain.</p><button className="button secondary" type="button" onClick={() => window.location.reload()}>Reload app</button></div>}
    {currentReceipt?.repairPrompt && <div className="panel repair-panel"><h3>{labels.length ? 'Some labels need fixing' : 'The ZIP needs fixing'}</h3><p>Send this original import’s repair request to the same AI chat. Your ready labels stay here while you add the corrected ZIP.</p><button className="button secondary" type="button" onClick={() => void copyRepair()}>Copy repair request</button><p className="copy-status" role="status">{repairStatus}</p>{showRepair && <textarea aria-label="Repair request" readOnly value={currentReceipt.repairPrompt} rows={8} onFocus={event => event.currentTarget.select()} />}</div>}
  </div>
  const handoff = handoffDraft && <>
    {collection.handoff && !frozen && <p role="status">Your creation choices changed. Copy the updated prompt before starting a new chat.</p>}
    <PromptHandoff prompt={handoffDraft.prompt} request={handoffDraft.request} copyLabel={targets.length ? `Copy prompt for ${targets.length} ${targets.length === 1 ? 'label' : 'labels'}` : 'Copy prompt for my AI chat'} busy={busy} onCopy={copyHandoff} onCopied={() => { void commit(current => current.handoff?.prompt === handoffDraft.prompt ? setHandoff(current, { ...current.handoff, copied: true }) : current).catch(ignoreHandledError) }} onPrint={() => navigate('print')} />
  </>
  const titles: Record<View | 'not-found', string> = { home: 'Tin to Cellar', labels: 'Labels for your tobacco jars', 'not-found': 'Page not found', create: 'Choose labels', print: 'Print labels', help: 'How it works', about: 'About', inspiration: 'Inspiration', privacy: 'Privacy', gallery: 'Community labels', 'gallery-admin': 'Review submissions' }
  const routeClick = (next: View) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); navigate(next)
  }
  const workflowViews: View[] = ['labels', 'create', 'print', 'help', 'gallery', 'gallery-admin']
  const navItems: { view: View; label: string }[] = [{ view: 'labels', label: 'Labels' }, ...(workflowViews.includes(view as View) ? [
    { view: 'create' as const, label: 'Choose labels' }, { view: 'print' as const, label: 'Print labels' }, ...(galleryConfig?.serving ? [{ view: 'gallery' as const, label: 'Community labels' }] : []),
  ] : [])]
  return <div className="app-shell tc-grain" onClick={event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target instanceof Element ? event.target.closest('a') : null
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin || url.hash || url.search) return
    const next = (Object.keys(viewPaths) as View[]).find(key => viewPaths[key] === url.pathname)
    if (next) { event.preventDefault(); navigate(next) }
  }}>
    <title>{view === 'home' ? titles.home : `${titles[view]} | Tin to Cellar`}</title>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); main.current?.focus(); main.current?.scrollIntoView({ block: 'start' }) }}>Skip to main content</a>
    <header className="site-header screen-only"><div className="site-header-inner">
      <a className="wordmark" href="/" onClick={routeClick('home')} aria-label="Tin to Cellar home"><Wordmark /></a>
      <nav className="nav-tabs" aria-label="Workflow">{navItems.map(item => <a key={item.view} href={viewPaths[item.view]} aria-current={view === item.view ? 'page' : undefined} onClick={routeClick(item.view)}>{item.label}</a>)}</nav>
    </div></header>
    <main id="main-content" ref={main} tabIndex={-1} className={`site-main view-${view}`}>
      {(storageError || importError) && <p className="panel screen-only" role="alert">{storageError || importError}</p>}
      {storageError && !ready && <button className="button secondary screen-only" type="button" onClick={() => window.location.reload()}>Reload saved labels</button>}
      <p className="visually-hidden screen-only" role="status">{importing ? 'Checking your labels…' : notice}</p>
      {legacyChoices.length > 0 && <section className="panel screen-only"><h2>Your previous community selection</h2><p>{legacyChoices.length} selected designs can be saved in Your labels. A design only becomes ready after its artwork downloads.</p><button type="button" className="button secondary" disabled={busy} onClick={() => void restoreLegacy()}>Restore selected labels</button></section>}
      {view === 'not-found' ? <div className="landing-page screen-only"><h1>Page not found</h1><p>This page doesn’t exist.</p><a href="/labels" onClick={routeClick('labels')}>Go to Labels</a></div> : view === 'labels' || view === 'home' ? <Landing onNavigate={navigate} busy={busy} onFile={file => handlePack(file, 'example')} /> : view === 'gallery' ? <GalleryBrowse onAdd={label => chooseCommunity(label)} selectedIds={Object.values(collection.designs).flatMap(design => design.publicationId ? [design.publicationId] : [])} onPrint={() => navigate('print')} /> : view === 'gallery-admin' ? <GalleryAdmin /> : view === 'create' ? <PreparationWorkspace rows={collection.rows.map(row => ({ ...row, artwork: labels.find(label => label.id === row.id) }))} busy={busy}
        onAdd={identities => commit(current => addRequests(current, identities)).then(() => undefined)}
        onRemove={id => { void commit(current => removeRow(current, id)).catch(ignoreHandledError) }}
        onCreate={(id, requested) => { setGenericChat(false); void commit(current => updateRow(current, id, { createRequested: requested })).catch(ignoreHandledError) }}
        onNotes={(id, value) => commit(current => updateRow(current, id, { notes: value })).then(() => undefined)}
        onResolve={(id, identity) => { void commit(current => updateRow(current, id, identity)).catch(ignoreHandledError) }}
        onChooseCommunity={(id, label) => chooseCommunity(label, id)} onPrint={() => navigate('print')} onBrowse={() => navigate('gallery')} onImport={() => navigate('print')} onGenericChat={() => setGenericChat(true)} handoff={handoff} /> : view === 'help' ? <><HowItWorks instructions={instructions} /><StandaloneFeedback /></> : view === 'privacy' ? <Privacy /> : view === 'about' ? <About /> : view === 'inspiration' ? <Inspiration /> : <>
        <div className="page-heading screen-only"><h1>Print labels</h1><p className="spec-line">Avery 94502 · 2.5 in circles · US Letter</p></div>
        <div className="handoff-actions screen-only"><button className="button secondary" type="button" onClick={() => navigate('create')}>Add more labels</button>{labels.length > 0 && <button type="button" className="button secondary" disabled={downloading} onClick={() => void download()}>{downloading ? 'Preparing download…' : 'Download labels'}</button>}</div>
        {collection.rows.some(row => !row.designId) && <p className="field-hint screen-only">{collection.rows.filter(row => !row.designId).length} labels still need artwork. You can print the ready labels now.</p>}
        {labels.length > 0 ? <PrintStudio intake={intake} labels={labels} quantities={quantities} onQuantityChange={(id, quantity) => { void commit(current => updateRow(current, id, { quantity })).catch(ignoreHandledError) }} settings={collection.printSettings} onSettingsChange={settings => { void commit(current => setPrintSettings(current, settings)).catch(ignoreHandledError) }} /> : <div className="print-intake screen-only">{intake}<ExamplePack busy={busy} onFile={file => handlePack(file, 'example')} /></div>}
        {shareableLabels.length > 0 && <GallerySubmission labels={shareableLabels} />}
      </>}
      {view === 'create' && (collection.rows.length > 0 || collection.receipts.length > 0) && <div className="preparation-storage screen-only"><button type="button" className="button quiet" disabled={busy} onClick={() => {
        if (!window.confirm('Clear all labels, requests, print settings and import reports saved in this browser? Download your ready labels first. This cannot be undone.')) return
        void commit(current => ({ ...current, rows: [], designs: {}, receipts: [], handoff: null, printSettings: { page: 0, firstSlot: 1, offset: { x: 0, y: 0 } } })).then(() => { setCandidate(null); setNotes({}); setFreshReceipts(new Set()); setNotice('Saved labels and requests cleared. Downloaded ZIPs are unchanged.') }).catch(ignoreHandledError)
      }}>Clear saved labels</button></div>}
      {collection.receipts.map(receipt => <ContributionStatus key={receipt.id} contribution={receipt.contribution} retrospective={notes[receipt.id] ?? null} hidden={view !== 'print' || currentReceipt?.id !== receipt.id} autoSend={freshReceipts.has(receipt.id)} delivery={receipt.delivery} onDelivery={delivery => { void commit(current => setReceiptDelivery(current, receipt.id, delivery)).catch(ignoreHandledError) }} />)}
    </main>
    <SiteFooter currentView={view} onNavigate={navigate} />
  </div>
}
