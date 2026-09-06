import { useEffect, useMemo, useRef, useState } from 'react'
import { buildTinToCellarPrompt, buildTinToCellarRequest, buildTinToCellarInstructions, buildCellarPackRepairPrompt } from './lib/prompt'
import { checkAvery94502Compatibility } from './lib/sheets'
import { Configurator } from './components/Configurator'
import { HowItWorks } from './components/HowItWorks'
import { PackImporter } from './components/PackImporter'
import { PrintStudio } from './components/PrintStudio'
import { PromptHandoff } from './components/PromptHandoff'
import type { ConfiguratorState, ImportSummary, PrintLabel, PrintSettings } from './components/ui-model'
import './styles/app.css'

const initialConfig: ConfiguratorState = {
  tobaccos: '', artDirection: '',
}
type View = 'create' | 'print' | 'help'
function viewFromHash(): View | null {
  const hash = window.location.hash.slice(1)
  if (!hash) return 'create'
  return hash === 'create' || hash === 'print' || hash === 'help' ? hash : null
}
function issueText(issue: { message?: string; recovery?: string }) {
  return [issue.message ?? 'The label needs repair.', issue.recovery].filter(Boolean).join(' ')
}

function App() {
  const [config, setConfig] = useState(initialConfig)
  const [view, setView] = useState<View>(() => viewFromHash() ?? 'create')
  const navigate = (next: View) => {
    setView(next)
    if (window.location.hash !== `#${next}`) window.location.hash = next
  }
  useEffect(() => {
    const onHashChange = () => {
      const next = viewFromHash()
      if (next) setView(next)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
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
  const importBusy = useRef(false)
  const promptInput = useMemo(() => ({
    tobaccos: config.tobaccos,
    geometry: { shape: 'circle' as const, width: 2.5, height: 2.5, diameter: 2.5, unit: 'in' as const },
    websiteUrl: window.location.href,
    printPreference: 'tin-to-cellar:avery-94502@1',
    artDirection: ['Use 0.125 inch bleed on every side and integrate a blank, light date-writing surface into the artwork, with no words or writing line.', config.artDirection].filter(Boolean).join(' '),
  }), [config])
  const prompt = useMemo(() => buildTinToCellarPrompt(promptInput), [promptInput])
  const request = useMemo(() => buildTinToCellarRequest(promptInput), [promptInput])
  const instructions = useMemo(() => buildTinToCellarInstructions(window.location.href), [])
  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const handlePack = async (file: File) => {
    if (importBusy.current) return
    importBusy.current = true
    setImporting(true)
    setRepairStatus('')
    setShowRepair(false)
    setImportLoadError(false)
    try {
      const { importCellarPack } = await import('./lib/cellarpack')
      const result = await importCellarPack(await file.arrayBuffer())
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
        const area = item.label.writeInAreas[0]
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
          writeIn: { x: area.geometry.x, y: area.geometry.y, width: area.geometry.width, height: area.geometry.height, rotationDegrees: area.geometry.rotationDegrees ?? 0, textColor: area.overlay.textColor ?? '#241d16' },
        })
      }
      const hasFailures = quarantined.length > 0 || result.status !== 'ready' || issues.some((issue) => issue.severity === 'error')
      setSummary({ status: mappedLabels.length ? (hasFailures ? 'partial' : 'ready') : 'rejected', title: result.manifest?.title ?? file.name, labels: mappedLabels, issues: issues.map(issueText), quarantined })
      const repairIssues = [...issues, ...result.quarantinedLabels.flatMap((label) => label.issues)]
      setRepairPrompt(hasFailures ? buildCellarPackRepairPrompt(repairIssues) : '')
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
    try { await navigator.clipboard.writeText(repairPrompt); setRepairStatus('Copied. Paste this into the same ChatGPT chat, then import its repaired ZIP.') }
    catch { setShowRepair(true); setRepairStatus('Select and copy the repair request below, then paste it into the same chat.') }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header screen-only">
      <button className="wordmark" type="button" onClick={() => navigate('create')} aria-label="Tin to Cellar home"><img className="brand-mark" src="/brand/monogram-180.png" width="38" height="38" alt="" /><strong>Tin to Cellar</strong></button>
      <nav aria-label="Workflow"><button className={view === 'create' ? 'is-current' : ''} aria-current={view === 'create' ? 'page' : undefined} type="button" onClick={() => navigate('create')}>Make a prompt</button><button className={view === 'print' ? 'is-current' : ''} aria-current={view === 'print' ? 'page' : undefined} type="button" onClick={() => navigate('print')}>Print labels</button><button className={view === 'help' ? 'is-current' : ''} aria-current={view === 'help' ? 'page' : undefined} type="button" onClick={() => navigate('help')}>How it works</button></nav>
    </header>
    <main id="main-content">
      {view === 'create' ? <div className="screen-only create-workspace">
        <section className="create-grid"><Configurator value={config} onChange={setConfig} /><PromptHandoff prompt={prompt} request={request} /></section>
      </div> : view === 'help' ? <HowItWorks instructions={instructions} /> : <>
        <div className="import-section screen-only"><PackImporter busy={importing} summary={summary} onFile={handlePack} />
          {importLoadError && <div className="panel" role="alert"><h3>The label reader couldn’t load</h3><p>The app may have updated, or the connection was interrupted. Reload the page, then choose the same ZIP again. Reloading clears the current workspace.</p><button className="button secondary" type="button" onClick={() => window.location.reload()}>Reload app</button></div>}
          {repairPrompt && <div className="panel repair-panel" role="status"><h3>{labels.length ? 'Some labels need another pass' : 'The ZIP needs another pass'}</h3><p>{labels.length ? 'Your current printable labels are still available below. ' : ''}Send the repair request to the same ChatGPT chat and import the ZIP it returns.</p><button className="button secondary" type="button" onClick={() => void copyRepair()}>Copy repair request</button><p>{repairStatus}</p>{showRepair && <textarea aria-label="Repair request" readOnly value={repairPrompt} rows={8} onFocus={(event) => event.currentTarget.select()} />}</div>}
        </div>
        {labels.length > 0 && <PrintStudio labels={labels} quantities={quantities} onQuantityChange={(id, value) => setQuantities((current) => ({ ...current, [id]: value }))} settings={printSettings} onSettingsChange={setPrintSettings} />}
      </>}
    </main>
  </div>
}
export default App
