import type { ProofLease } from './lib/prompt/proof-access'
import { ContributionStatus } from './components/ContributionStatus'
import { contributionFromManifest, type Contribution } from './lib/contributions'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildTinToCellarPrompt, buildCompleteTinToCellarPrompt, buildTinToCellarRequest, buildTinToCellarInstructions, buildCellarPackRepairPrompt } from './lib/prompt'
import { checkAvery94502Compatibility } from './lib/sheets'
import { Configurator } from './components/Configurator'
import { HowItWorks } from './components/HowItWorks'
import { SiteHome } from './components/SiteHome'
import { Landing } from './components/Landing'
import { Privacy } from './components/Privacy'
import { About } from './components/About'
import { Inspiration } from './components/Inspiration'
import { SiteFooter } from './components/SiteFooter'
import { Icon } from './components/Icons'
import { Wordmark } from './components/Wordmark'
import { DiagnosticFeedback } from './components/DiagnosticFeedback'
import { resolveProtocolContext } from './lib/protocol'
import { FEEDBACK_KEY } from './lib/feedback'
import { ExamplePack } from './components/ExamplePack'
import { PackImporter } from './components/PackImporter'
import { PrintStudio } from './components/PrintStudio'
import { PromptHandoff } from './components/PromptHandoff'
import type { ConfiguratorState, ImportSummary, PrintLabel, PrintSettings } from './components/ui-model'
import './styles/app.css'

const initialConfig: ConfiguratorState = {
  tobaccos: '', artDirection: '',
}
const viewPaths = { home: '/', labels: '/labels', create: '/labels/create', print: '/labels/print', help: '/labels/help', about: '/about', inspiration: '/inspiration', privacy: '/privacy' } as const
type View = keyof typeof viewPaths
function viewFromPath(): View | 'not-found' {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/'
  return (Object.keys(viewPaths) as View[]).find((view) => viewPaths[view] === pathname) ?? 'not-found'
}
function issueText(issue: { message?: string; recovery?: string }) {
  return [issue.message ?? 'The label needs repair.', issue.recovery].filter(Boolean).join(' ')
}

function App() {
  const [proofLease, setProofLease] = useState<ProofLease | null>(null)
  const [config, setConfig] = useState(initialConfig)
  const [view, setView] = useState<View | 'not-found'>(viewFromPath)
  const main = useRef<HTMLElement>(null)
  const previousView = useRef(view)
  const navigate = (next: View) => {
    setView(next)
    if (next === view) {
      main.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, left: 0 })
    }
    if (window.location.pathname !== viewPaths[next] || window.location.hash) window.history.pushState({}, '', viewPaths[next])
  }
  useEffect(() => {
    // Leave initial focus at the document so the skip link is the first Tab stop.
    if (previousView.current !== view) {
      main.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, left: 0 })
      previousView.current = view
    }
  }, [view])
  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const onPopState = () => setView(viewFromPath())
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.history.scrollRestoration = previousRestoration
    }
  }, [])
  const [protocolContext, setProtocolContext] = useState<ReturnType<typeof resolveProtocolContext>>({ status: 'legacy' })
  const [contribution, setContribution] = useState<Contribution | null>(null)
  const [feedback, setFeedback] = useState<unknown>(null)
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [labels, setLabels] = useState<PrintLabel[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [printSettings, setPrintSettings] = useState<PrintSettings>({ page: 0, firstSlot: 1, offset: { x: 0, y: 0 } })
  const [repairPrompt, setRepairPrompt] = useState('')
  const [repairStatus, setRepairStatus] = useState('')
  const [importLoadError, setImportLoadError] = useState(false)
  const [showRepair, setShowRepair] = useState(false)
  const objectUrls = useRef<string[]>([])
  const previousLabelCount = useRef(0)
  useEffect(() => {
    // The first usable pack replaces the empty workspace, removing its upload button.
    if (!previousLabelCount.current && labels.length && view === 'print' && document.activeElement === document.body) {
      main.current?.querySelector<HTMLElement>('.quantity-panel h2')?.focus()
    }
    previousLabelCount.current = labels.length
  }, [labels, view])
  const importBusy = useRef(false)
  const promptInput = useMemo(() => ({
    tobaccos: config.tobaccos,
    geometry: { shape: 'circle' as const, width: 2.5, height: 2.5, diameter: 2.5, unit: 'in' as const },
    websiteUrl: window.location.href,
    printPreference: 'tin-to-cellar:avery-94502@1',
    artDirection: ['Use 0.125 inch bleed on every side and integrate a blank, light date-writing surface into the artwork, with no words or writing line.', config.artDirection].filter(Boolean).join(' '),
  }), [config])
  const prompt = useMemo(() => buildTinToCellarPrompt(promptInput), [promptInput])
  const completePrompt = useMemo(() => buildCompleteTinToCellarPrompt(promptInput), [promptInput])
  const request = useMemo(() => buildTinToCellarRequest(promptInput), [promptInput])
  const instructions = useMemo(() => buildTinToCellarInstructions(window.location.href), [])
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const handlePack = async (file: File) => {
    if (importBusy.current) return
    importBusy.current = true
    setImporting(true)
    setFeedback(null)
    setContribution(null)
    setProtocolContext({ status: 'legacy' })
    setRepairStatus('')
    setShowRepair(false)
    setImportLoadError(false)
    try {
      const { importCellarPack } = await import('./lib/cellarpack')
      const result = await importCellarPack(await file.arrayBuffer())
      if (result.manifest) setContribution(await contributionFromManifest(result.manifest))
      const context = resolveProtocolContext(result.manifest?.extensions)
      setProtocolContext(context)
      setFeedback(result.manifest?.extensions?.[FEEDBACK_KEY] ?? null)
      const issues = result.issues.filter((issue) => issue.code !== 'MISSING_PREVIEW')
      const quarantined = result.quarantinedLabels.map((item) => ({ id: item.id, reason: item.issues.map(issueText).join(' ') }))
      const nextUrls: string[] = []
      const mappedLabels: PrintLabel[] = []
      for (const item of result.labels) {
        const compatibility = checkAvery94502Compatibility(item.label.surface)
        if (!compatibility.compatible) {
          const failures = compatibility.issues.map((issue) => ({ ...issue, labelId: item.id, severity: 'error' as const, recovery: 'Return this label as a 2.5-inch circle for Avery 94502. Do not stretch the artwork.' }))
          issues.push(...failures)
          quarantined.push({ id: item.id, reason: failures.map(issueText).join(' ') })
          continue
        }
        const url = URL.createObjectURL(new Blob([item.artwork.data], { type: item.artwork.mediaType }))
        nextUrls.push(url)
        const surface = item.label.surface
        const bleedRatio = (value: number, dimension: number) => (value * (surface.bleed.unit === 'mm' ? 1 / 25.4 : 1)) / (dimension * (surface.finishedSize.unit === 'mm' ? 1 / 25.4 : 1))
        mappedLabels.push({
          id: item.id, maker: item.label.maker, blend: item.label.displayName ?? item.label.blend,
          imageUrl: url,
          imageFrame: {
            left: -bleedRatio(surface.bleed.left, surface.finishedSize.width) * 100,
            top: -bleedRatio(surface.bleed.top, surface.finishedSize.height) * 100,
            width: (1 + bleedRatio(surface.bleed.left + surface.bleed.right, surface.finishedSize.width)) * 100,
            height: (1 + bleedRatio(surface.bleed.top + surface.bleed.bottom, surface.finishedSize.height)) * 100,
          },
        })
      }
      const hasFailures = quarantined.length > 0 || result.status !== 'ready' || issues.some((issue) => issue.severity === 'error')
      setSummary({ status: mappedLabels.length ? (hasFailures ? 'partial' : 'ready') : 'rejected', title: result.manifest?.title ?? file.name, labels: mappedLabels, issues: issues.map(issueText), quarantined })
      const repairIssues = [...issues, ...result.quarantinedLabels.flatMap((label) => label.issues)]
      setRepairPrompt(hasFailures ? buildCellarPackRepairPrompt(repairIssues, context) : '')
      if (mappedLabels.length) {
        objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
        objectUrls.current = nextUrls
        setLabels(mappedLabels)
        setQuantities(Object.fromEntries(mappedLabels.map((label) => [label.id, 1])))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The selected ZIP could not be read.'
      if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)) {
        setImportLoadError(true)
        setSummary(null)
        setRepairPrompt('')
        return
      }
      setSummary({ status: 'rejected', title: file.name, labels: [], quarantined: [], issues: [message] })
      setRepairPrompt(buildCellarPackRepairPrompt([{ message }]))
    } finally {
      importBusy.current = false
      setImporting(false)
    }
  }
  const copyRepair = async () => {
    try { await navigator.clipboard.writeText(repairPrompt); setRepairStatus('Copied. Paste this into the same AI chat, then import the corrected ZIP.') }
    catch { setShowRepair(true); setRepairStatus('Select and copy the repair request below, then paste it into the same chat.') }
  }

  const intake = <div className="import-section screen-only"><PackImporter busy={importing} summary={summary} onFile={handlePack} /><ContributionStatus key={JSON.stringify(contribution)} contribution={contribution} />
    {importLoadError && <div className="panel" role="alert"><h3>The label reader couldn’t load</h3><p>The app may have updated, or the connection was interrupted. Reload the page, then choose the same ZIP again. Reloading clears the current workspace.</p><button className="button secondary" type="button" onClick={() => window.location.reload()}>Reload app</button></div>}
    {repairPrompt && <div className="panel repair-panel"><h3>{labels.length ? 'Some labels need fixing' : 'The ZIP needs fixing'}</h3><p>{labels.length ? 'You can still print the usable labels below. ' : ''}Send the repair request to the same AI chat and import the ZIP it returns.</p><button className="button secondary" type="button" onClick={() => void copyRepair()}><Icon name="copy" size={17} />Copy repair request</button><p className="copy-status" role="status">{repairStatus}</p>{showRepair && <textarea aria-label="Repair request" readOnly value={repairPrompt} rows={8} onFocus={(event) => event.currentTarget.select()} />}</div>}
  </div>

  const titles: Record<View | 'not-found', string> = { home: 'Tin to Cellar', labels: 'Labels for your tobacco jars', 'not-found': 'Page not found', create: 'Make a prompt', print: 'Print labels', help: 'How it works', about: 'About', inspiration: 'Inspiration', privacy: 'Privacy' }
  const routeClick = (next: View) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(next)
  }
  const workflowViews: View[] = ['labels', 'create', 'print', 'help']
  const navItems: { view: View; label: string }[] = [{ view: 'labels', label: 'Labels' }, ...(workflowViews.includes(view as View) ? [
    { view: 'create' as const, label: 'Make a prompt' }, { view: 'print' as const, label: 'Print labels' }, { view: 'help' as const, label: 'How it works' },
  ] : [])]

  return <div className="app-shell tc-grain" onClick={(event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target instanceof Element ? event.target.closest('a') : null
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin || url.hash || url.search) return
    const next = (Object.keys(viewPaths) as View[]).find((key) => viewPaths[key] === url.pathname)
    if (next) { event.preventDefault(); navigate(next) }
  }}>
    <title>{view === 'home' ? titles.home : `${titles[view]} | Tin to Cellar`}</title>
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); main.current?.focus(); main.current?.scrollIntoView({ block: 'start' }) }}>Skip to main content</a>
    <p className="visually-hidden screen-only" role="status">{importing ? 'Checking your labels…' : summary ? `${summary.status === 'ready' ? 'Labels ready to print' : summary.status === 'partial' ? 'Some labels need repair' : 'ZIP needs repair'}. ${summary.labels.length} labels ready. ${summary.issues.length} issues to review.` : ''}</p>
    <header className="site-header screen-only">
      <div className="site-header-inner">
        <a className="wordmark" href="/" onClick={routeClick('home')} aria-label="Tin to Cellar home"><Wordmark /></a>
        <nav className="nav-tabs" aria-label="Workflow">{navItems.map((item) => <a key={item.view} href={viewPaths[item.view]} aria-current={view === item.view ? 'page' : undefined} onClick={routeClick(item.view)}>{item.label}</a>)}</nav>
      </div>
    </header>
    <main id="main-content" ref={main} tabIndex={-1} className={`site-main view-${view}`}>
      {view === 'home' ? <SiteHome onNavigate={() => navigate('labels')} /> : view === 'not-found' ? <div className="landing-page screen-only"><h1>Page not found</h1><p>This page doesn’t exist.</p><a href="/labels" onClick={routeClick('labels')}>Go to Labels</a></div> : view === 'labels' ? <Landing onNavigate={navigate} /> : view === 'create' ? <div className="screen-only create-workspace">
        <div className="create-grid"><Configurator value={config} onChange={setConfig} /><PromptHandoff proofLease={proofLease} onProofLeaseChange={setProofLease} completePrompt={completePrompt} prompt={prompt} request={request} onPrint={() => navigate('print')} /></div>
      </div> : view === 'help' ? <HowItWorks instructions={instructions} /> : view === 'privacy' ? <Privacy /> : view === 'about' ? <About /> : view === 'inspiration' ? <Inspiration /> : <>
        <div className="page-heading screen-only"><h1>Print labels</h1><p className="spec-line">Avery 94502 · 2.5 in circles · US Letter</p></div>
        {labels.length > 0 ? <PrintStudio intake={intake} labels={labels} quantities={quantities} onQuantityChange={(id, value) => setQuantities((current) => ({ ...current, [id]: value }))} settings={printSettings} onSettingsChange={setPrintSettings} /> :
          <div className="print-intake screen-only">{intake}<ExamplePack busy={importing} onFile={handlePack} /></div>}
        <DiagnosticFeedback candidate={feedback} protocolContext={protocolContext} />
      </>}
    </main>
    <SiteFooter currentView={view} onNavigate={navigate} />
  </div>
}
export default App
