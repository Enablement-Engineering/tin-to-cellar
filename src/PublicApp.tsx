import { usePublicNavigation, viewPaths, type View } from './hooks/usePublicNavigation'
import { usePackImport } from './hooks/usePackImport'
import { useRecoveryBlocker } from './hooks/useAppRecovery'
import { AppRecoveryNotice } from './components/AppRecoveryNotice'
import { UsageInvitation } from './components/UsageInvitation'
import { appRecovery } from './lib/app-recovery'
import { isUploadedReceipt } from './lib/collection/history'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSavedSources } from './lib/prompt/use-saved-sources'
import { ContributionStatus } from './components/ContributionStatus'
import { HowItWorks } from './components/HowItWorks'
import { Landing } from './components/Landing'
import { Privacy } from './components/Privacy'
import { About } from './components/About'
import { Inspiration } from './components/Inspiration'
import { SiteFooter } from './components/SiteFooter'
import { Wordmark } from './components/Wordmark'
import { ThemeControl } from './components/ThemeControl'
import { ProtocolWarning } from './components/ProtocolWarning'
import { StandaloneFeedback } from './components/StandaloneFeedback'
import { ExamplePack } from './components/ExamplePack'
import { PackImporter, ImportReport } from './components/PackImporter'
import { ImportHistory, ReceiptReport } from './components/ImportHistory'
import { PrintStudio } from './components/PrintStudio'
import { GalleryDesignReview } from './components/GalleryDesignReview'
import { OrderPage } from './components/OrderPage'
import { SavedPrintSelection } from './components/SavedPrintSelection'
import { ArtworkCreationFlow } from './components/ArtworkCreationFlow'
import { PromptHandoff } from './components/PromptHandoff'
import { PreparationWorkspace } from './components/PreparationWorkspace'
import { LabelPaperGuidance } from './components/LabelPaperGuidance'
import { CollectionImportReview } from './components/CollectionImportReview'
import type { ImportSummary } from './components/ui-model'
import { GalleryBrowse, GallerySubmission, GalleryAdmin } from './components/gallery/deferred'
import { DeferredPanel } from './components/DeferredPanel'
import { validChoice, MAX_PACK_LABELS, type PackChoice } from './components/gallery/pack-selection'
import { addRequests, updateRow, removeRow, setPrintSettings, setHandoff, setReceiptDelivery, prepareImport, planImport, applyImport, exportCollection } from './lib/collection'
import { useCollection } from './hooks/useCollection'
import { usePrintLabels } from './hooks/usePrintLabels'
import { usePromptModule } from './hooks/usePromptModule'
import { formatTobacco } from './lib/tobacco-catalog'
import { PROTOCOL_REVISION } from './lib/protocol'
import { initializeDemandCollection, recordDemand, recordUsage } from './lib/analytics/client'
import { pruneProgress, startProgress, importProgress, printProgress } from './lib/analytics/progress'
import type { RequestInput } from './lib/collection/types'
import { addManualLabel } from './lib/collection/manual-add'

function issueText(issue: { message?: string; recovery?: string }) { return [issue.message ?? 'The label needs repair.', issue.recovery].filter(Boolean).join(' ') }
const ignoreHandledError = () => undefined
const targetKey = (targets: { rowId: string; revision: number }[]) => JSON.stringify(targets.map(target => [target.rowId, target.revision]))


export default function PublicApp() {
  const { collection, ready, saving, error: storageError, commit } = useCollection()
  const { labels, error: previewError, pending: previewPending } = usePrintLabels(collection)
  const { view, navigate, main } = usePublicNavigation()
  useEffect(() => { pruneProgress(); void initializeDemandCollection() }, [])
  const promptModule = usePromptModule(view === 'artwork' || view === 'help')
  const focusAfterImport = useRef(false)
  const { importing, candidate, setCandidate, cancelImport, review, decisions, setDecisions, reviewInvalidated, refreshDecisions,
    recoveryFile, recoveryFileError, recoveringFile, dismissRecoveryFile, resumeRecoveryFile,
    notice, setNotice, importError, setImportError, importLoadError, receiptId, setReceiptId,
    freshReceipts, setFreshReceipts, notes, setNotes, diagnosticWarnings, saveCandidate, replaceCandidate, handlePack, chooseCommunity } = usePackImport({
    collection, ready, commit,
    onStart: () => undefined,
    onImported: () => { if (view !== 'artwork') navigate('print') },
    onGalleryAdded: rows => recordDemand('added-to-labels', rows),
    onChecked: outcome => recordUsage({ version: 2, event: 'pack-check-result', outcome }),
    onFailed: outcome => recordUsage({ version: 2, event: 'workflow-failed', outcome }),
    onApplied: (before, after, incoming) => {
      if (!['local', 'gallery'].includes(incoming.receipt.origin ?? '')) return
      const ids = new Set(incoming.designs.map(design => design.id))
      const changed = after.rows.some(row => {
        const old = before.rows.find(old => old.id === row.id)
        return row.designId && ids.has(row.designId) && (old?.designId !== row.designId || old.createRequested && !row.createRequested)
      })
      if (changed) recordUsage({ version: 2, event: incoming.receipt.origin === 'local' ? 'pack-import-applied' : 'gallery-design-applied', outcome: 'saved' })
      void importProgress(before, after, incoming)
    },
  })
  const [showIntake, setShowIntake] = useState(false)
  const openImport = () => { setShowIntake(true); navigate('print') }
  const [galleryVisited, setGalleryVisited] = useState(view === 'gallery')
  if (view === 'gallery' && !galleryVisited) setGalleryVisited(true)
  const [genericChat, setGenericChat] = useState(() => {
    try { return sessionStorage.getItem('tin-to-cellar:generic-chat') === '1' } catch { return false }
  })
  const genericRecovery = useRef(Symbol('generic-chat-recovery'))
  useEffect(() => {
    try {
      if (genericChat) sessionStorage.setItem('tin-to-cellar:generic-chat', '1')
      else sessionStorage.removeItem('tin-to-cellar:generic-chat')
      return appRecovery.guard(genericRecovery.current, null)
    } catch { return appRecovery.guard(genericRecovery.current, genericChat ? 'This browser could not preserve your new AI chat. Add a blend to leave this empty chat before updating.' : null) }
  }, [genericChat])
  const [downloading, setDownloading] = useState(false)
  const [legacyRestoring, setLegacyRestoring] = useState(false)
  const [legacyChoices, setLegacyChoices] = useState<PackChoice[]>(() => {
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem('gallery-pack-selection') ?? '[]')
      return Array.isArray(value) && value.length <= MAX_PACK_LABELS && value.every(validChoice) ? value : []
    } catch { return [] }
  })
  const busy = importing || saving || legacyRestoring || recoveringFile || !ready
  useRecoveryBlocker(busy || downloading ? 'Wait for your current work to finish saving before updating.'
    : storageError ? 'Resolve the saved-label error before updating.'
    : candidate ? 'Save or cancel your imported-label review before updating.'
    : view === 'gallery-admin' ? 'Finish reviewing and save your corrections before reloading.' : null, true)
  useEffect(() => {
    if (!/^\d+ labels? ready\.$/.test(notice)) return
    const timer = window.setTimeout(() => {
      // Leave the dismiss control in place while someone is using it.
      if (!document.activeElement?.closest('.app-notice')) setNotice('')
    }, 10000)
    return () => window.clearTimeout(timer)
  }, [notice, setNotice])
  useEffect(() => {
    if (!focusAfterImport.current || view !== 'print' || candidate || busy) return
    if (previewPending) return
    const target = main.current?.querySelector<HTMLElement>('.quantity-panel h2, .saved-print-selection h2') ?? main.current?.querySelector<HTMLElement>('.importer h2')
    if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); focusAfterImport.current = false }
  }, [collection.revision, collection.rows, labels.length, previewPending, view, candidate, busy, main])
  const uploadedReceipts = collection.receipts.filter(receipt => isUploadedReceipt(receipt, collection.designs))
  const currentReceipt = candidate?.receipt ?? uploadedReceipts.find(receipt => receipt.id === receiptId) ?? uploadedReceipts.at(-1)
  const summary: ImportSummary | null = currentReceipt ? {
    title: currentReceipt.title,
    status: currentReceipt.quarantined.length || currentReceipt.issues.some(issue => issue.severity === 'error' || issue.severity === 'fatal') ? 'partial' : 'ready',
    labels: candidate ? candidate.designs.map(design => ({ id: design.id, maker: design.item.label.maker, blend: design.item.label.blend, imageUrl: '', imageFrame: { left: 0, top: 0, width: 100, height: 100 } })) : labels.filter(label => collection.designs[collection.rows.find(row => row.id === label.id)?.designId ?? '']?.receiptId === currentReceipt.id),
    issues: currentReceipt.issues.filter(issue => issue.code !== 'MISSING_PREVIEW').map(issueText),
    quarantined: currentReceipt.quarantined,
  } : null
  if (summary && !summary.labels.length && (summary.quarantined.length || currentReceipt?.issues.some(issue => issue.severity === 'error' || issue.severity === 'fatal'))) summary.status = 'rejected'

  const creationRows = useMemo(() => collection.rows.filter(row => row.createRequested), [collection.rows])
  const workspaceRows = collection.rows.map(row => ({ ...row, artwork: labels.find(label => label.id === row.id) }))
  const saveCreationList = (ids: string[]) => commit(current => {
    if (ids.some(id => !current.rows.some(row => row.id === id))) throw new Error('Your labels changed. Review the creation list again.')
    return current.rows.reduce((next, row) => row.createRequested === ids.includes(row.id) ? next : updateRow(next, row.id, { createRequested: ids.includes(row.id) }), current)
  }).then(() => { setNotice('') })
  const setCreationRequested = (id: string, requested: boolean) => {
    setGenericChat(false)
    return commit(current => updateRow(current, id, { createRequested: requested })).then(() => { setNotice('') })
  }
  const targets = creationRows.map(({ id, revision, catalogId, maker, blend, edition, notes }) => ({ rowId: id, revision, catalogId, maker, blend, edition, notes }))
  const sourcesText = creationRows.map(formatTobacco).join('\n')
  const savedSources = useSavedSources(sourcesText, view === 'artwork' && creationRows.length > 0)
  const requestedKey = targetKey(targets)
  const frozen = collection.handoff && targetKey(collection.handoff.targets) === requestedKey && (targets.length > 0 || genericChat && collection.handoff.targets.length === 0) ? collection.handoff : null
  const handoffDraft = useMemo(() => {
    if (frozen) return frozen
    if (!promptModule.module) return null
    const input = {
      tobaccos: creationRows.map(row => ({ maker: row.maker || undefined, blend: row.blend, notes: [row.edition, row.notes].filter(Boolean).join('; ') })),
      savedSources,
      geometry: { shape: 'circle' as const, width: 2.5, height: 2.5, diameter: 2.5, unit: 'in' as const },
      websiteUrl: window.location.href,
      printPreference: 'tin-to-cellar:avery-94502@1',
      artDirection: 'Use 0.125 inch bleed on every side and integrate a blank, light date-writing surface into the artwork, with no words or writing line.',
    }
    return creationRows.length ? promptModule.module.buildCollectionHandoff(input) : genericChat ? promptModule.module.buildGenericChatHandoff(input) : null
  }, [frozen, creationRows, savedSources, genericChat, promptModule.module])
  const instructions = useMemo(() => view === 'help' && promptModule.module ? promptModule.module.buildTinToCellarInstructions(window.location.href) : null, [view, promptModule.module])
  const copyHandoff = async (useLatest = false) => {
    if (!handoffDraft) throw new Error('Choose at least one label to create first.')
    if (!promptModule.module) throw new Error('Instructions could not load. Reload the application before copying.')
    await promptModule.module.verifyPreparedPromptHandoff(handoffDraft)
    const selected = useLatest ? { ...handoffDraft, protocolRevision: PROTOCOL_REVISION, prompt: `${promptModule.module.buildTinToCellarInstructions()}\n\n${handoffDraft.request}` } : handoffDraft
    if (useLatest) await promptModule.module.verifyPreparedPromptHandoff(selected)
    const saved = await commit(current => {
      const actual = current.rows.filter(row => row.createRequested).map(row => ({ rowId: row.id, revision: row.revision }))
      if (targetKey(actual) !== requestedKey) throw new Error('Your label choices changed. Review the updated prompt before copying.')
      if (current.handoff && current.handoff.prompt === selected.prompt && targetKey(current.handoff.targets) === requestedKey) return current
      return setHandoff(current, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), targets, prompt: selected.prompt, request: selected.request, protocolRevision: selected.protocolRevision, copied: false })
    })
    return saved.handoff!.prompt
  }
  const restoreLegacy = async () => {
    if (legacyRestoring) return
    setLegacyRestoring(true)
    try {
      const { downloadPublishedPack } = await import('./components/gallery/pack-builder')
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
      recordUsage({ version: 2, event: 'labels-download-requested', outcome: 'requested' })
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch (failure) { recordUsage({ version: 2, event: 'workflow-failed', outcome: 'labels-export' }); setImportError(failure instanceof Error ? failure.message : 'The labels could not be downloaded. Your saved work is unchanged.') }
    finally { setDownloading(false) }
  }
  const acceptImport = async () => {
    if (!candidate || !review || reviewInvalidated) return
    focusAfterImport.current = true
    try { await saveCandidate(candidate, review, decisions); setShowIntake(false); if (view === 'artwork') navigate('create') }
    catch (failure) { focusAfterImport.current = false; setImportError(failure instanceof Error ? failure.message : 'Your labels could not be saved. Review the selection and try again.') }
  }
  const replaceImport = async () => {
    if (!candidate || !review || reviewInvalidated) return
    focusAfterImport.current = true
    try { await replaceCandidate(candidate, review); setShowIntake(false); if (view === 'artwork') navigate('create') }
    catch (failure) { focusAfterImport.current = false; setImportError(failure instanceof Error ? failure.message : 'Your labels could not be replaced. Your saved selection is unchanged.') }
  }
  const clearLabels = async () => {
    await commit(current => ({ ...current, rows: [], designs: {}, receipts: [], handoff: null, printSettings: { page: 0, firstSlot: 1, offset: { x: 0, y: 0 } } })).then(() => {
      setCandidate(null); setReceiptId(null); setNotes({}); setFreshReceipts(new Set()); setImportError(''); setGenericChat(false)
      setNotice('Saved labels and requests reset. Downloaded ZIPs are unchanged.')
      main.current?.focus()
    })
  }
  const resetLabels = () => {
    if (!window.confirm('Reset all labels, requests, print settings and import history saved in this browser? Download your ready labels first. This cannot be undone.')) return
    void clearLabels().catch(ignoreHandledError)
  }
  const reviewingPack = candidate !== null || importing
  // Saved rows determine whether a selection exists. Blob previews only decide
  // whether that selection can currently be rendered for printing.
  const printState = !ready || previewPending ? 'loading'
    : previewError ? 'unavailable'
    : labels.length > 0 ? 'ready'
    : collection.rows.length > 0 ? 'needs-artwork' : 'empty'
  const quantities = Object.fromEntries(collection.rows.map(row => [row.id, row.quantity]))
  const readyDemandRows = () => collection.rows.filter(row => row.quantity > 0 && labels.some(label => label.id === row.id))
  const openReadyPrint = () => {
    recordUsage({ version: 2, event: 'print-preparation-result', outcome: printState === 'unavailable' ? 'preview-unavailable' : printState })
    if (view !== 'print' && printState === 'ready' && !busy) recordDemand('selected-for-print', readyDemandRows())
    navigate('print')
  }
  const addLabelRequests = async (identities: RequestInput[]) => {
    let added: RequestInput[] = []
    await commit(current => {
      const next = addRequests(current, identities)
      added = next.rows.filter(row => !current.rows.some(previous => previous.id === row.id))
      return next
    })
    recordDemand('added-to-labels', added)
  }
  const addGalleryCreationRequest = async (identity: RequestInput) => {
    let addedRows: RequestInput[] = []
    await commit(current => {
      const added = addRequests(current, [identity])
      addedRows = added.rows.filter(row => !current.rows.some(previous => previous.id === row.id))
      return added.rows.reduce((next, row) => row.catalogId === identity.catalogId && row.maker === identity.maker && row.blend === identity.blend && !row.edition && !row.notes ? updateRow(next, row.id, { createRequested: true }) : next, added)
    })
    recordDemand('added-to-labels', addedRows)
    navigate('create')
  }
  const communityHashes = new Set(collection.receipts.flatMap(receipt => receipt.knownGalleryHashes ?? []))
  const activeDesigns = Object.values(collection.designs).filter(design => collection.rows.some(row => row.designId === design.id))
  const shareableLabels = activeDesigns.filter(design => design.origin === 'local' && !communityHashes.has(design.item.artwork.asset.sha256)).map(design => ({ ...design.item, id: design.id, label: { ...design.item.label, id: design.id } }))
  const galleryMatch = candidate?.designs[0]?.origin === 'gallery' && review?.entries.length === 1 && review.entries[0].matchRowIds.length === 1 ? labels.find(label => label.id === review.entries[0].matchRowIds[0]) : undefined
  const acceptGalleryChoice = async (action: 'replace' | 'add') => {
    if (!candidate || !review || !galleryMatch || reviewInvalidated) return
    try { await saveCandidate(candidate, review, { [review.entries[0].designId]: action === 'replace' ? { action, rowId: galleryMatch.id } : { action } }) }
    catch (failure) { setImportError(failure instanceof Error ? failure.message : 'The selected design could not be saved.') }
  }
  const intake = <div className="import-section screen-only">
    {!candidate && <PackImporter compact={view === 'artwork'} busy={busy} summary={null} onFile={handlePack} history={<ImportHistory receipts={uploadedReceipts} designs={collection.designs} />} />}
    {candidate && <ProtocolWarning context={candidate.receipt.protocolContext} feedback={candidate.receipt.contribution?.feedback} />}
    {importLoadError && <div className="panel" role="alert"><h3>The label reader couldn’t load</h3><p>Use the app recovery controls above to check the connection or update the app. Your saved labels remain available.</p></div>}
  </div>
  const importProblem = !reviewingPack && currentReceipt && (currentReceipt.repairPrompt || summary?.status !== 'ready') && <aside className="import-problem screen-only" aria-label="Import needs attention">
    <p>{currentReceipt.quarantined.length ? `${currentReceipt.quarantined.length} ${currentReceipt.quarantined.length === 1 ? 'label was' : 'labels were'} excluded from your last ZIP import.` : 'Your last ZIP import needs attention.'}</p>
    <details key={currentReceipt.id}>
      <summary>View details</summary>
      <ReceiptReport key={currentReceipt.id} receipt={currentReceipt} />
      {summary?.status === 'rejected' && <StandaloneFeedback />}
    </details>
  </aside>
  const handoff = handoffDraft && <>
    {collection.handoff && !frozen && <p role="status">Your creation choices changed. Copy the updated prompt before starting a new chat.</p>}
    <PromptHandoff prompt={handoffDraft.prompt} request={handoffDraft.request} copyLabel={targets.length ? `Copy instructions for ${targets.length} ${targets.length === 1 ? 'label' : 'labels'}` : 'Copy instructions for my AI chat'} copied={Boolean(frozen?.copied)} busy={busy || !promptModule.module} onCopy={() => copyHandoff()} onCopyLatest={frozen && String(frozen.protocolRevision) !== PROTOCOL_REVISION ? () => copyHandoff(true) : undefined} onCopyResult={outcome => recordUsage({ version: 2, event: 'instructions-copy-result', outcome })} onCopied={payload => { void commit(current => current.handoff?.prompt === payload ? setHandoff(current, { ...current.handoff, copied: true }) : current).then(saved => { if (saved.handoff?.prompt === payload) void startProgress(saved.id, saved.handoff) }).catch(ignoreHandledError) }} />
  </>
  const promptLoading = <section className="panel screen-only" aria-label="Instructions">
    <p role="status">{promptModule.failed ? 'Instructions could not load. Use the app recovery controls above. Your saved labels remain available.' : 'Loading instructions…'}</p>
    {promptModule.failed && <button type="button" className="button secondary" onClick={() => void appRecovery.check()}>Check app update</button>}
  </section>
  const titles: Record<View | 'not-found', string> = { labels: 'Labels for your tobacco jars', 'not-found': 'Page not found', create: 'Your labels', artwork: 'Create artwork', order: 'Add several blends', print: 'Print labels', help: 'How it works', about: 'About', inspiration: 'Inspiration', privacy: 'Privacy', gallery: 'Gallery', 'gallery-admin': 'Review submissions' }
  const routeClick = (next: View) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); if (next === 'print') openReadyPrint(); else navigate(next)
  }
  const navItems: { view: View; label: string }[] = [
    { view: 'create' as const, label: 'Your labels' }, { view: 'print' as const, label: 'Print labels' },
  ]
  const showNotice = (view === 'print' || view === 'create' || view === 'artwork') && Boolean(notice) && !importing
  return <div className="app-shell tc-grain" onClick={event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target instanceof Element ? event.target.closest('a') : null
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin || url.hash || url.search) return
    const next = (Object.keys(viewPaths) as View[]).find(key => viewPaths[key] === url.pathname)
    if (next) { event.preventDefault(); if (next === 'print') openReadyPrint(); else navigate(next) }
  }}>
    <title>{`${titles[view]} | Tin to Cellar`}</title>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); main.current?.focus(); main.current?.scrollIntoView({ block: 'start' }) }}>Skip to main content</a>
    <header className="site-header screen-only"><div className="site-header-inner">
      <a className="wordmark" href="/" onClick={routeClick('labels')} aria-label="Tin to Cellar home"><Wordmark /></a>
      <nav className="nav-tabs" aria-label="Workflow">{navItems.map(item => <a key={item.view} href={viewPaths[item.view]} aria-current={view === item.view ? 'page' : undefined} onClick={routeClick(item.view)}>{item.label}</a>)}</nav>
      <ThemeControl />
    </div></header>
    <main id="main-content" ref={main} tabIndex={-1} className={`site-main view-${view}`}>
      <AppRecoveryNotice />
      {(recoveryFile || recoveryFileError) && <section className="panel screen-only" aria-label="Selected ZIP recovery">
        <p>{recoveryFile ? `${recoveryFile.name} is selected for recovery. Resume its review when the app is ready. The ZIP stays on this device.` : recoveryFileError}</p>
        {recoveryFile && recoveryFileError && <p role="alert">{recoveryFileError}</p>}
        <div className="handoff-actions">
          {recoveryFile && <button type="button" className="button primary" disabled={busy || recoveringFile || Boolean(candidate)} onClick={() => void resumeRecoveryFile()}>Resume ZIP review</button>}
          <button type="button" className="button secondary" disabled={busy || recoveringFile} onClick={() => void dismissRecoveryFile()}>Dismiss selected ZIP</button>
        </div>
      </section>}
      {(storageError || importError) && <p className="panel screen-only" role="alert">{storageError || importError}</p>}
      {previewError && <p className="panel screen-only" role="alert">{previewError}</p>}
      {(view === 'artwork' || view === 'create') && importProblem}
      {view === 'print' && currentReceipt && diagnosticWarnings[currentReceipt.id] && <p className="field-hint screen-only" role="status">Some diagnostics could not be prepared. Your label import can continue.</p>}
      {storageError && !ready && <button className="button secondary screen-only" type="button" onClick={() => window.location.reload()}>Reload saved labels</button>}
      <div className={showNotice ? 'app-notice screen-only' : 'visually-hidden screen-only'}>
        <p role="status">{importing ? 'Checking your labels…' : notice}</p>
        {showNotice && <button className="button quiet" type="button" onClick={() => { setNotice(''); main.current?.focus({ preventScroll: true }) }}>Dismiss message</button>}
      </div>
      {galleryMatch && candidate && <GalleryDesignReview current={galleryMatch} incoming={candidate.designs[0]} busy={busy} invalidated={reviewInvalidated} error={reviewInvalidated ? 'Your saved labels changed. Cancel and choose the design again.' : importError || storageError} onReplace={() => void acceptGalleryChoice('replace')} onAdd={() => void acceptGalleryChoice('add')} onCancel={cancelImport} />}
      {review && candidate && !galleryMatch && <CollectionImportReview unresolvedRequests={collection.rows.filter(row => row.createRequested && !Object.values(decisions).some(decision => decision.action === 'replace' && decision.rowId === row.id)).map(row => row.blend)} collection={collection} plan={review} decisions={decisions} onChange={setDecisions} onAccept={() => void acceptImport()} onReplace={() => void replaceImport()} onCancel={() => { focusAfterImport.current = true; setShowIntake(false); cancelImport() }} busy={busy} invalidated={reviewInvalidated} onRefresh={refreshDecisions} error={importError || storageError}>{summary && (summary.status !== 'ready' || summary.issues.length > 0 || summary.quarantined.length > 0) ? <ImportReport summary={summary} /> : null}</CollectionImportReview>}
      {legacyChoices.length > 0 && <section className="panel screen-only"><h2>Your previous community selection</h2><p>{legacyChoices.length} selected designs can be saved in Your labels. A design only becomes ready after its artwork downloads.</p><button type="button" className="button secondary" disabled={busy} onClick={() => void restoreLegacy()}>Restore selected labels</button></section>}
      {(galleryVisited || view === 'gallery') && <div hidden={view !== 'gallery'} className="screen-only"><DeferredPanel><GalleryBrowse selectedCount={collection.rows.length} readyCount={labels.length} onView={() => navigate('create')} onCreate={addGalleryCreationRequest} getActionLabel={label => { const matches = collection.rows.filter(row => row.catalogId === label.catalogId && !row.edition); return matches.length === 1 && !matches[0].designId ? `Use for your ${label.blend} label` : matches.some(row => row.designId) ? 'Review this design' : 'Add to your labels' }} onAdd={label => chooseCommunity(label)} selectedIds={activeDesigns.flatMap(design => design.publicationId ? [design.publicationId] : [])} onPrint={openReadyPrint} /></DeferredPanel></div>}
      {view === 'not-found' ? <div className="landing-page screen-only"><h1>Page not found</h1><p>This page doesn’t exist.</p><a href="/labels" onClick={routeClick('labels')}>Go to Labels</a></div> : view === 'labels' ? <Landing selectedCount={collection.rows.length} readyCount={labels.length} onNavigate={next => next === 'print' ? openImport() : navigate(next)} busy={busy} onFile={file => handlePack(file, 'example')} onClear={clearLabels} /> : view === 'gallery' ? null : view === 'order' ? <OrderPage rows={collection.rows} busy={busy} onAdd={async identities => { await addLabelRequests(identities); navigate('create') }} onBrowse={() => navigate('gallery')} /> : view === 'gallery-admin' ? <DeferredPanel><GalleryAdmin /></DeferredPanel> : view === 'create' ? <PreparationWorkspace rows={workspaceRows} busy={busy}
        onOrder={() => navigate('order')} onCreateMany={saveCreationList} onAdd={async (identity, choice) => {
          if (choice !== 'ai') { await chooseCommunity(choice, undefined, identity); return }
          await commit(current => addManualLabel(current, identity, 'ai'))
          setGenericChat(false); setNotice('')
          recordDemand('added-to-labels', [identity])
        }}
        onRemove={id => { void commit(current => removeRow(current, id)).catch(ignoreHandledError) }}
        onCreate={setCreationRequested}
        onNotes={(id, value) => commit(current => updateRow(current, id, { notes: value })).then(() => undefined)}
        onResolve={(id, identity) => { void commit(current => updateRow(current, id, identity)).catch(ignoreHandledError) }}
        onChooseCommunity={(id, label) => chooseCommunity(label, id)} onPrint={openReadyPrint} onBrowse={() => navigate('gallery')} onImport={openImport} onGenericChat={() => { setGenericChat(true); navigate('artwork') }} onContinueCreation={() => navigate('artwork')} /> : view === 'artwork' ? <ArtworkCreationFlow rows={creationRows} allRows={workspaceRows} requestKey={requestedKey} copied={Boolean(frozen?.copied)} generic={genericChat} busy={busy} onBack={() => navigate('create')} onEdit={saveCreationList} onNotes={(id, notes) => commit(current => updateRow(current, id, { notes })).then(() => undefined)} onCancel={id => setCreationRequested(id, false)} handoff={handoff ?? promptLoading} intake={intake} /> : view === 'help' ? <>{instructions !== null ? <HowItWorks instructions={instructions} /> : promptLoading}<StandaloneFeedback /></> : view === 'privacy' ? <Privacy /> : view === 'about' ? <About /> : view === 'inspiration' ? <Inspiration /> : <>
        <div className="page-heading print-page-heading screen-only"><h1>{reviewingPack ? 'Review imported labels' : 'Print labels'}</h1><LabelPaperGuidance /></div>
        {!reviewingPack && <div className="handoff-actions print-page-controls screen-only"><button className="button secondary" type="button" onClick={() => navigate('create')}>Add more labels</button>{labels.length > 0 && <button type="button" className="button secondary" disabled={downloading} onClick={() => void download()}>{downloading ? 'Preparing download…' : 'Download labels'}</button>}{(collection.rows.length > 0 || collection.receipts.length > 0) && <button type="button" className="button quiet" disabled={busy} onClick={resetLabels}>Reset labels</button>}</div>}
        {!reviewingPack && printState === 'ready' && collection.rows.some(row => !row.designId) && <p className="field-hint screen-only">{collection.rows.filter(row => !row.designId).length} labels still need artwork. {labels.length > 0 ? 'You can print the ready labels now.' : 'Choose a design or import a finished ZIP to start printing.'}</p>}
        {!reviewingPack && collection.receipts.filter(receipt => activeDesigns.some(design => design.receiptId === receipt.id)).map(receipt => <ProtocolWarning key={receipt.id} context={receipt.protocolContext} feedback={receipt.contribution?.feedback} />)}
        {importProblem}
        {reviewingPack ? <div className="screen-only"><p role="status">This pack has not changed your saved selection. Add its labels, replace your selection, or cancel to return to your print sheet.</p>{intake}</div> : printState === 'loading' ? <p className="panel screen-only" role="status">Loading your saved labels…</p> : printState === 'ready' ? <PrintStudio onPrintRequested={() => { const rows = readyDemandRows(); recordDemand('print-job-requested', rows); recordUsage({ version: 2, event: 'print-requested', outcome: 'requested' }); void printProgress(collection, rows.map(row => row.id)) }} saving={saving} intake={showIntake || candidate || importing || importError ? intake : <details className="print-add-labels"><summary>Add labels from a ZIP</summary>{intake}</details>} labels={labels} quantities={quantities} onQuantityChange={(id, change) => { void commit(current => {
          const row = current.rows.find(row => row.id === id)
          if (!row) return current
          const otherCopies = current.rows.reduce((sum, item) => sum + (item.id !== id && item.designId ? item.quantity : 0), 0)
          const quantity = Math.max(0, Math.min(99, 450 - otherCopies, typeof change === 'number' ? change : row.quantity + change.delta))
          return updateRow(current, id, { quantity })
        }).catch(ignoreHandledError) }} settings={collection.printSettings} onSettingsChange={settings => { void commit(current => setPrintSettings(current, { ...current.printSettings, ...settings, offset: { ...current.printSettings.offset, ...settings.offset } })).catch(ignoreHandledError) }} /> : printState !== 'empty' ? <><SavedPrintSelection rows={collection.rows} previewUnavailable={printState === 'unavailable'} onChoose={() => navigate('create')} /><details open={showIntake || undefined} className="print-add-labels screen-only"><summary>Add labels from a ZIP</summary>{intake}</details></> : <div className="print-intake screen-only">{intake}{!candidate && <ExamplePack busy={busy} onFile={file => handlePack(file, 'example')} />}</div>}
        {!reviewingPack && shareableLabels.length > 0 && <DeferredPanel><GallerySubmission labels={shareableLabels} /></DeferredPanel>}
      </>}
      {view === 'create' && (collection.rows.length > 0 || collection.receipts.length > 0) && <div className="preparation-storage screen-only"><button type="button" className="button quiet" disabled={busy} onClick={resetLabels}>Clear saved labels</button></div>}
      {collection.receipts.map(receipt => <ContributionStatus key={receipt.id} contribution={receipt.contribution} retrospective={notes[receipt.id] ?? null} onDismissNotes={() => setNotes(current => { const next = { ...current }; delete next[receipt.id]; return next })} hidden={view !== 'print' || currentReceipt?.id !== receipt.id} autoSend={freshReceipts.has(receipt.id)} delivery={receipt.delivery} onDelivery={delivery => { void commit(current => setReceiptDelivery(current, receipt.id, delivery)).catch(ignoreHandledError) }} />)}
      {['create', 'artwork', 'print'].includes(view) && <UsageInvitation key={view} />}
    </main>
    <SiteFooter currentView={view} onNavigate={navigate} />
  </div>
}
