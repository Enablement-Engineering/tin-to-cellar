import { usePublicNavigation, viewPaths, type View } from './hooks/usePublicNavigation'
import { usePackImport } from './hooks/usePackImport'
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
import { ProtocolWarning } from './components/ProtocolWarning'
import { StandaloneFeedback } from './components/StandaloneFeedback'
import { ExamplePack } from './components/ExamplePack'
import { PackImporter, ImportReport } from './components/PackImporter'
import { PrintStudio } from './components/PrintStudio'
import { PromptHandoff } from './components/PromptHandoff'
import { PreparationWorkspace } from './components/PreparationWorkspace'
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

function issueText(issue: { message?: string; recovery?: string }) { return [issue.message ?? 'The label needs repair.', issue.recovery].filter(Boolean).join(' ') }
const ignoreHandledError = () => undefined
const targetKey = (targets: { rowId: string; revision: number }[]) => JSON.stringify(targets.map(target => [target.rowId, target.revision]))


export default function PublicApp() {
  const { collection, ready, saving, error: storageError, commit } = useCollection()
  const { labels, error: previewError } = usePrintLabels(collection)
  const { view, navigate, main } = usePublicNavigation()
  const promptModule = usePromptModule(view === 'create' || view === 'help')
  const focusAfterImport = useRef(false)
  const [repairStatus, setRepairStatus] = useState('')
  const [showRepair, setShowRepair] = useState(false)
  const { importing, candidate, setCandidate, review, decisions, setDecisions, reviewInvalidated, refreshDecisions,
    notice, setNotice, importError, setImportError, importLoadError, receiptId, setReceiptId,
    freshReceipts, setFreshReceipts, notes, setNotes, diagnosticWarnings, saveCandidate, replaceCandidate, handlePack, chooseCommunity } = usePackImport({
    collection, ready, commit,
    onStart: () => { setRepairStatus(''); setShowRepair(false) },
    onImported: () => navigate('print'),
  })
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
  }, [collection.revision, collection.rows, labels.length, view, candidate, busy, main])
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
  const replaceImport = async () => {
    if (!candidate || !review || reviewInvalidated) return
    focusAfterImport.current = true
    try { await replaceCandidate(candidate, review) }
    catch (failure) { focusAfterImport.current = false; setImportError(failure instanceof Error ? failure.message : 'Your labels could not be replaced. Your saved selection is unchanged.') }
  }
  const resetLabels = () => {
    if (!window.confirm('Reset all labels, requests, print settings and import history saved in this browser? Download your ready labels first. This cannot be undone.')) return
    void commit(current => ({ ...current, rows: [], designs: {}, receipts: [], handoff: null, printSettings: { page: 0, firstSlot: 1, offset: { x: 0, y: 0 } } })).then(() => {
      setCandidate(null); setReceiptId(null); setNotes({}); setFreshReceipts(new Set()); setImportError(''); setRepairStatus(''); setShowRepair(false); setGenericChat(false)
      setNotice('Saved labels and requests reset. Downloaded ZIPs are unchanged.')
      main.current?.focus()
    }).catch(ignoreHandledError)
  }
  const receiptName = (id: string, title: string, index: number) => {
    const blends = [...new Set(Object.values(collection.designs).filter(design => design.receiptId === id).map(design => formatTobacco(design.item.label)))]
    return `${index + 1}. ${blends.length ? blends.slice(0, 2).join(', ') + (blends.length > 2 ? ` + ${blends.length - 2} more` : '') : title}`
  }
  const quantities = Object.fromEntries(collection.rows.map(row => [row.id, row.quantity]))
  const communityHashes = new Set(collection.receipts.flatMap(receipt => receipt.knownGalleryHashes ?? []))
  const shareableLabels = Object.values(collection.designs).filter(design => design.origin === 'local' && !communityHashes.has(design.item.artwork.asset.sha256)).map(design => ({ ...design.item, id: design.id, label: { ...design.item.label, id: design.id } }))
  const intake = <div className="import-section screen-only">
    <PackImporter busy={busy} summary={candidate ? summary : null} onFile={handlePack} />
    {review && candidate && <CollectionImportReview collection={collection} plan={review} decisions={decisions} onChange={setDecisions} onAccept={() => void acceptImport()} onReplace={() => void replaceImport()} onCancel={() => { setCandidate(null) }} busy={busy} invalidated={reviewInvalidated} onRefresh={refreshDecisions} />}
    {!candidate && currentReceipt && <details className="panel import-history" open={!!currentReceipt.repairPrompt || summary?.status !== 'ready'}>
      <summary>Import history and checks</summary>
      <p>These reports describe past imports. Choosing a report does not change your labels or print sheet.</p>
      <label>Previous import<select value={currentReceipt.id} onChange={event => { setReceiptId(event.target.value); setRepairStatus(''); setShowRepair(false) }}>{collection.receipts.map((receipt, index) => <option key={receipt.id} value={receipt.id}>{receiptName(receipt.id, receipt.title, index)}</option>)}</select></label>
      <p className="field-hint">Imported {new Date(currentReceipt.createdAt).toLocaleString()}. Ready counts below refer only to labels from this import still in your collection.</p>
      <ImportReport summary={summary} showReady />
    </details>}
    {currentReceipt && <ProtocolWarning context={currentReceipt.protocolContext} feedback={currentReceipt.contribution?.feedback} />}
    {summary?.status === 'rejected' && <StandaloneFeedback />}
    {importLoadError && <div className="panel" role="alert"><h3>The label reader couldn’t load</h3><p>The app may have updated, or the connection was interrupted. Reload the page, then choose the same ZIP again. Your saved labels will remain.</p><button className="button secondary" type="button" onClick={() => window.location.reload()}>Reload app</button></div>}
    {currentReceipt?.repairPrompt && <div className="panel repair-panel"><h3>{labels.length ? 'Some labels need fixing' : 'The ZIP needs fixing'}</h3><p>Send this original import’s repair request to the same AI chat. Your ready labels stay here while you add the corrected ZIP.</p><button className="button secondary" type="button" onClick={() => void copyRepair()}>Copy repair request</button><p className="copy-status" role="status">{repairStatus}</p>{showRepair && <textarea aria-label="Repair request" readOnly value={currentReceipt.repairPrompt} rows={8} onFocus={event => event.currentTarget.select()} />}</div>}
  </div>
  const handoff = handoffDraft && <>
    {collection.handoff && !frozen && <p role="status">Your creation choices changed. Copy the updated prompt before starting a new chat.</p>}
    <PromptHandoff prompt={handoffDraft.prompt} request={handoffDraft.request} copyLabel={targets.length ? `Copy prompt for ${targets.length} ${targets.length === 1 ? 'label' : 'labels'}` : 'Copy prompt for my AI chat'} busy={busy} onCopy={copyHandoff} onCopied={() => { void commit(current => current.handoff?.prompt === handoffDraft.prompt ? setHandoff(current, { ...current.handoff, copied: true }) : current).catch(ignoreHandledError) }} onPrint={() => navigate('print')} />
  </>
  const promptLoading = <section className="panel screen-only" aria-label="Instructions">
    <p role="status">{promptModule.failed ? 'Instructions could not load. Reload to try again. Your saved labels remain available.' : 'Loading instructions…'}</p>
    {promptModule.failed && <button type="button" className="button secondary" onClick={event => {
      if (document.activeElement === event.currentTarget) {
        try { sessionStorage.setItem('tin-to-cellar:instructions-reload-focus', '1') } catch { /* Recovery does not require focus storage. */ }
      }
      window.location.reload()
    }}>Reload instructions</button>}
  </section>
  const titles: Record<View | 'not-found', string> = { labels: 'Labels for your tobacco jars', 'not-found': 'Page not found', create: 'Choose labels', print: 'Print labels', help: 'How it works', about: 'About', inspiration: 'Inspiration', privacy: 'Privacy', gallery: 'Community labels', 'gallery-admin': 'Review submissions' }
  const routeClick = (next: View) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); navigate(next)
  }
  const navItems: { view: View; label: string }[] = [
    { view: 'create' as const, label: 'Choose labels' }, { view: 'print' as const, label: 'Print labels' },
  ]
  return <div className="app-shell tc-grain" onClick={event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target instanceof Element ? event.target.closest('a') : null
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin || url.hash || url.search) return
    const next = (Object.keys(viewPaths) as View[]).find(key => viewPaths[key] === url.pathname)
    if (next) { event.preventDefault(); navigate(next) }
  }}>
    <title>{`${titles[view]} | Tin to Cellar`}</title>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); main.current?.focus(); main.current?.scrollIntoView({ block: 'start' }) }}>Skip to main content</a>
    <header className="site-header screen-only"><div className="site-header-inner">
      <a className="wordmark" href="/" onClick={routeClick('labels')} aria-label="Tin to Cellar home"><Wordmark /></a>
      <nav className="nav-tabs" aria-label="Workflow">{navItems.map(item => <a key={item.view} href={viewPaths[item.view]} aria-current={view === item.view ? 'page' : undefined} onClick={routeClick(item.view)}>{item.label}</a>)}</nav>
    </div></header>
    <main id="main-content" ref={main} tabIndex={-1} className={`site-main view-${view}`}>
      {(storageError || importError) && <p className="panel screen-only" role="alert">{storageError || importError}</p>}
      {previewError && <p className="panel screen-only" role="alert">{previewError}</p>}
      {view === 'print' && currentReceipt && diagnosticWarnings[currentReceipt.id] && <p className="field-hint screen-only" role="status">Some diagnostics could not be prepared. Your label import can continue.</p>}
      {storageError && !ready && <button className="button secondary screen-only" type="button" onClick={() => window.location.reload()}>Reload saved labels</button>}
      <p className="visually-hidden screen-only" role="status">{importing ? 'Checking your labels…' : notice}</p>
      {legacyChoices.length > 0 && <section className="panel screen-only"><h2>Your previous community selection</h2><p>{legacyChoices.length} selected designs can be saved in Your labels. A design only becomes ready after its artwork downloads.</p><button type="button" className="button secondary" disabled={busy} onClick={() => void restoreLegacy()}>Restore selected labels</button></section>}
      {view === 'not-found' ? <div className="landing-page screen-only"><h1>Page not found</h1><p>This page doesn’t exist.</p><a href="/labels" onClick={routeClick('labels')}>Go to Labels</a></div> : view === 'labels' ? <Landing onNavigate={navigate} busy={busy} onFile={file => handlePack(file, 'example')} /> : view === 'gallery' ? <DeferredPanel><GalleryBrowse readyCount={labels.length} onAdd={label => chooseCommunity(label)} selectedIds={Object.values(collection.designs).flatMap(design => design.publicationId ? [design.publicationId] : [])} onPrint={() => navigate('print')} /></DeferredPanel> : view === 'gallery-admin' ? <DeferredPanel><GalleryAdmin /></DeferredPanel> : view === 'create' ? <PreparationWorkspace rows={collection.rows.map(row => ({ ...row, artwork: labels.find(label => label.id === row.id) }))} busy={busy}
        onAdd={identities => commit(current => addRequests(current, identities)).then(() => undefined)}
        onRemove={id => { void commit(current => removeRow(current, id)).catch(ignoreHandledError) }}
        onCreate={(id, requested) => { setGenericChat(false); void commit(current => updateRow(current, id, { createRequested: requested })).catch(ignoreHandledError) }}
        onNotes={(id, value) => commit(current => updateRow(current, id, { notes: value })).then(() => undefined)}
        onResolve={(id, identity) => { void commit(current => updateRow(current, id, identity)).catch(ignoreHandledError) }}
        onChooseCommunity={(id, label) => chooseCommunity(label, id)} onPrint={() => navigate('print')} onBrowse={() => navigate('gallery')} onImport={() => navigate('print')} onGenericChat={() => setGenericChat(true)} handoff={handoff ?? ((creationRows.length > 0 || genericChat) ? promptLoading : null)} /> : view === 'help' ? <>{instructions !== null ? <HowItWorks instructions={instructions} /> : promptLoading}<StandaloneFeedback /></> : view === 'privacy' ? <Privacy /> : view === 'about' ? <About /> : view === 'inspiration' ? <Inspiration /> : <>
        <div className="page-heading screen-only"><h1>Print labels</h1><p className="spec-line">Avery 94502 · 2.5 in circles · US Letter</p></div>
        <div className="handoff-actions screen-only"><button className="button secondary" type="button" onClick={() => navigate('create')}>Add more labels</button>{labels.length > 0 && <button type="button" className="button secondary" disabled={downloading} onClick={() => void download()}>{downloading ? 'Preparing download…' : 'Download labels'}</button>}{(collection.rows.length > 0 || collection.receipts.length > 0) && <button type="button" className="button quiet" disabled={busy} onClick={resetLabels}>Reset labels</button>}</div>
        {collection.rows.some(row => !row.designId) && <p className="field-hint screen-only">{collection.rows.filter(row => !row.designId).length} labels still need artwork. {labels.length > 0 ? 'You can print the ready labels now.' : 'Choose a design or import a finished ZIP to start printing.'}</p>}
        {labels.length > 0 ? <PrintStudio saving={saving} intake={candidate || importing || importError || currentReceipt?.repairPrompt ? intake : <details className="print-add-labels"><summary>Add labels from a ZIP</summary>{intake}</details>} labels={labels} quantities={quantities} onQuantityChange={(id, change) => { void commit(current => {
          const row = current.rows.find(row => row.id === id)
          if (!row) return current
          const otherCopies = current.rows.reduce((sum, item) => sum + (item.id !== id && item.designId ? item.quantity : 0), 0)
          const quantity = Math.max(0, Math.min(99, 450 - otherCopies, typeof change === 'number' ? change : row.quantity + change.delta))
          return updateRow(current, id, { quantity })
        }).catch(ignoreHandledError) }} settings={collection.printSettings} onSettingsChange={settings => { void commit(current => setPrintSettings(current, { ...current.printSettings, ...settings, offset: { ...current.printSettings.offset, ...settings.offset } })).catch(ignoreHandledError) }} /> : <div className="print-intake screen-only">{intake}{!candidate && <ExamplePack busy={busy} onFile={file => handlePack(file, 'example')} />}</div>}
        {shareableLabels.length > 0 && <DeferredPanel><GallerySubmission labels={shareableLabels} /></DeferredPanel>}
      </>}
      {view === 'create' && (collection.rows.length > 0 || collection.receipts.length > 0) && <div className="preparation-storage screen-only"><button type="button" className="button quiet" disabled={busy} onClick={resetLabels}>Clear saved labels</button></div>}
      {collection.receipts.map(receipt => <ContributionStatus key={receipt.id} contribution={receipt.contribution} retrospective={notes[receipt.id] ?? null} hidden={view !== 'print' || currentReceipt?.id !== receipt.id} autoSend={freshReceipts.has(receipt.id)} delivery={receipt.delivery} onDelivery={delivery => { void commit(current => setReceiptDelivery(current, receipt.id, delivery)).catch(ignoreHandledError) }} />)}
    </main>
    <SiteFooter currentView={view} onNavigate={navigate} />
  </div>
}
