import { useEffect, useMemo, useRef, useState } from 'react'
import { buildTinToCellarPrompt, createChatGPTUrl, type PromptInspiration, type PromptProjectInput } from './lib/prompt'
import { Configurator } from './components/Configurator'
import { Icon } from './components/Icons'
import { PackImporter } from './components/PackImporter'
import { PrintStudio } from './components/PrintStudio'
import { PromptHandoff } from './components/PromptHandoff'
import { Workbench } from './components/Workbench'
import type {
  Calibration,
  ConfiguratorState,
  ImportSummary,
  LabelInstance,
  LabelShape,
  WorkbenchLabel,
  WriteInMode,
} from './components/ui-model'
import './styles/app.css'

const initialConfig: ConfiguratorState = {
  tobaccos: '',
  shape: 'circle',
  width: 2.5,
  height: 2.5,
  bleed: 0.125,
  stock: 'tin-to-cellar:avery-94502@1',
  inspirationUrls: '',
  plannedFiles: '',
  writeInMode: 'JARRED',
  artDirection: '',
}

function buildPromptInput(config: ConfiguratorState): PromptProjectInput {
  const inspiration: PromptInspiration[] = [
    ...config.inspirationUrls.split('\n').map((value) => value.trim()).filter(Boolean).map((value) => ({ kind: 'url' as const, value, role: 'supplement' as const })),
    ...config.plannedFiles.split(',').map((value) => value.trim()).filter(Boolean).map((value) => ({ kind: 'attachment' as const, value, role: 'supplement' as const })),
  ]
  const overlayDirection = config.writeInMode === 'BLANK'
    ? 'Integrate the required light date-writing surface, but the website will leave it visually blank.'
    : config.writeInMode === 'LINE'
      ? 'Integrate the required light date-writing surface; the website will add only a crisp writing line.'
      : `Integrate the required light date-writing surface; the website will add the crisp overlay wording “${config.writeInMode}” and a writing line.`

  return {
    tobaccos: config.tobaccos,
    geometry: {
      shape: config.shape,
      width: config.width,
      height: config.height,
      ...(config.shape === 'circle' ? { diameter: config.width } : {}),
      unit: 'in',
    },
    printPreference: config.stock,
    inspiration,
    artDirection: [
      `Use ${config.bleed} inch bleed on every side.`,
      overlayDirection,
      config.artDirection,
    ].filter(Boolean).join(' '),
    specUrl: `${window.location.origin}/spec/cellarpack-v1.schema.json`,
    humanSpecUrl: `${window.location.origin}/spec/cellarpack-v1.md`,
  }
}

function issueText(issue: { code?: string; message?: string; recovery?: string }) {
  return [issue.code ? `[${issue.code}]` : '', issue.message ?? 'Unknown validation issue', issue.recovery ? `— ${issue.recovery}` : ''].filter(Boolean).join(' ')
}

function mapShape(shape: string): LabelShape {
  if (shape === 'circle' || shape === 'oval' || shape === 'square' || shape === 'rectangle' || shape === 'rounded-rectangle') return shape
  return 'rectangle'
}

function App() {
  const [config, setConfig] = useState(initialConfig)
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [labels, setLabels] = useState<WorkbenchLabel[]>([])
  const [instances, setInstances] = useState<LabelInstance[]>([])
  const [view, setView] = useState<'create' | 'workbench' | 'print'>('create')
  const [overlayMode, setOverlayMode] = useState<WriteInMode>('JARRED')
  const [calibration, setCalibration] = useState<Calibration>({ x: 0, y: 0, scale: 1 })
  const objectUrls = useRef<string[]>([])

  const promptInput = useMemo(() => buildPromptInput(config), [config])
  const prompt = useMemo(() => buildTinToCellarPrompt(promptInput), [promptInput])
  const chatGptUrl = useMemo(() => createChatGPTUrl(prompt), [prompt])
  const codexPrompt = useMemo(() => `${prompt}\n\nCodex packaging note: use the Tin to Cellar v1 schema and deterministic validator. Only name the result .cellarpack.zip after validation passes; otherwise return a clearly named draft or loose bundle.`, [prompt])

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const handlePack = async (file: File) => {
    setImporting(true)
    setSummary(null)
    try {
      const { importCellarPack } = await import('./lib/cellarpack')
      const result = await importCellarPack(await file.arrayBuffer())
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrls.current = []

      const mappedLabels: WorkbenchLabel[] = result.labels.map((item) => {
        const url = URL.createObjectURL(new Blob([item.artwork.data], { type: item.artwork.mediaType }))
        objectUrls.current.push(url)
        const writeArea = item.label.writeInAreas.find((area) => area.purpose === 'jarred-date')
        const sources = item.label.research.sources.map((source) => source.type === 'web'
          ? { id: source.id, title: source.title, url: source.url, role: source.role, publisher: source.publisher }
          : { id: source.id, title: source.description, role: source.role })

        return {
          id: item.id,
          maker: item.label.maker,
          blend: item.label.displayName ?? item.label.blend,
          imageUrl: url,
          imageFrame: {
            left: -(item.label.surface.bleed.left / item.label.surface.finishedSize.width) * 100,
            top: -(item.label.surface.bleed.top / item.label.surface.finishedSize.height) * 100,
            width: ((item.label.surface.finishedSize.width + item.label.surface.bleed.left + item.label.surface.bleed.right) / item.label.surface.finishedSize.width) * 100,
            height: ((item.label.surface.finishedSize.height + item.label.surface.bleed.top + item.label.surface.bleed.bottom) / item.label.surface.finishedSize.height) * 100,
          },
          shape: mapShape(item.label.surface.shape),
          width: item.label.surface.finishedSize.width,
          height: item.label.surface.finishedSize.height,
          writeIn: writeArea ? {
            x: writeArea.geometry.x,
            y: writeArea.geometry.y,
            width: writeArea.geometry.width,
            height: writeArea.geometry.height,
            textColor: writeArea.overlay.textColor ?? '#241d16',
          } : { x: 0.3, y: 0.72, width: 0.4, height: 0.11, textColor: '#241d16' },
          researchStatus: item.label.research.status,
          variant: item.label.research.observedPackage.variant,
          adaptationSummary: item.label.research.adaptationSummary,
          sources,
          warnings: item.issues.map(issueText),
        }
      })

      const nextSummary: ImportSummary = {
        status: result.status,
        title: result.manifest?.title ?? file.name.replace(/\.cellarpack\.zip$|\.zip$/i, ''),
        labels: mappedLabels,
        issues: result.issues.map(issueText),
        quarantined: result.quarantinedLabels.map((item) => ({
          id: item.id,
          reason: item.issues.map(issueText).join(' ') || 'The label did not pass validation.',
        })),
      }

      setSummary(nextSummary)
      setLabels(mappedLabels)
      setInstances(mappedLabels.map((label) => ({ instanceId: crypto.randomUUID(), labelId: label.id, zoom: 1, x: 0, y: 0 })))
      if (mappedLabels.length && result.status !== 'rejected') setView('workbench')
    } catch (error) {
      setSummary({
        status: 'rejected',
        title: file.name,
        labels: [],
        quarantined: [],
        issues: [error instanceof Error ? error.message : 'The selected file could not be read as a CellarPack.'],
      })
      setLabels([])
      setInstances([])
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header screen-only">
        <button className="wordmark" type="button" onClick={() => setView('create')} aria-label="Tin to Cellar home">
          <span className="wordmark-mark" aria-hidden="true">T<span>C</span></span>
          <span><strong>Tin to Cellar</strong><small>Private label print studio</small></span>
        </button>
        <nav aria-label="Workflow">
          <button type="button" className={view === 'create' ? 'is-current' : ''} onClick={() => setView('create')}><span>1</span> Create</button>
          <button type="button" className={view === 'workbench' ? 'is-current' : ''} disabled={!labels.length} onClick={() => setView('workbench')}><span>2</span> Compose</button>
          <button type="button" className={view === 'print' ? 'is-current' : ''} disabled={!labels.length} onClick={() => setView('print')}><span>3</span> Print</button>
        </nav>
        <span className="privacy-mark"><Icon name="lock" size={15} /> Local-first</span>
      </header>

      <main id="main-content">
        {view === 'create' && (
          <>
            <section className="welcome screen-only" aria-labelledby="welcome-title">
              <img src="/assets/tin-to-cellar-workbench.png" alt="A nine-label sheet, dividers, ruler, and fountain pen arranged on a dark green print bench" />
              <div className="welcome-scrim" />
              <div className="welcome-copy">
                <p className="eyebrow brass">From package research to physical labels</p>
                <h1 id="welcome-title">Give good tobacco<br /><em>a proper cellar mark.</em></h1>
                <p>Build a research-grounded brief for ChatGPT or Codex. Bring the resulting CellarPack back here to arrange, measure, and print—without uploading it.</p>
                <a className="text-link light" href="#create-project">Start at the bench <span aria-hidden="true">↓</span></a>
              </div>
              <div className="welcome-proof" aria-hidden="true">
                <span>9-up</span><strong>Avery 94502</strong><small>signature sheet</small>
              </div>
            </section>

            <section className="process-strip screen-only" aria-label="Tin to Cellar workflow">
              <div><span>Research</span><p>Agent inspects the real tin</p></div><i aria-hidden="true" />
              <div><span>Generate</span><p>Original shape-adapted artwork</p></div><i aria-hidden="true" />
              <div><span>Compose</span><p>Local, exact sheet geometry</p></div><i aria-hidden="true" />
              <div><span>Print</span><p>Calibrated at actual size</p></div>
            </section>

            <section id="create-project" className="create-grid screen-only">
              <Configurator value={config} onChange={setConfig} />
              <div className="create-side">
                <PromptHandoff prompt={prompt} codexPrompt={codexPrompt} chatGptUrl={chatGptUrl} hasPlannedFiles={Boolean(config.plannedFiles.trim())} />
                <PackImporter busy={importing} summary={summary} onFile={handlePack} />
              </div>
            </section>
          </>
        )}

        {view === 'workbench' && (
          <Workbench labels={labels} instances={instances} mode={overlayMode} onModeChange={setOverlayMode} onInstancesChange={setInstances} onProceed={() => { setView('print'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
        )}

        {view === 'print' && (
          <PrintStudio labels={labels} instances={instances} mode={overlayMode} calibration={calibration} onCalibrationChange={setCalibration} onBack={() => setView('workbench')} />
        )}
      </main>

      <footer className="site-footer screen-only">
        <div><strong>Tin to Cellar</strong><span>Open packs. Private preparation. Physical truth.</span></div>
        <p>Artwork is generated elsewhere. The print studio never auto-fetches research sources or uploads your pack.</p>
      </footer>
    </div>
  )
}

export default App
