import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'
import { ExamplePack } from './ExamplePack'

type LandingProps = { onNavigate: (view: 'create' | 'print' | 'help' | 'order' | 'gallery') => void; selectedCount?: number; readyCount?: number; busy: boolean; onFile: (file: File) => Promise<void>; onClear: () => Promise<void> }

function ClearLabelsDialog({ count, busy, onClear, onClose }: { count: number; busy: boolean; onClear: () => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const clearing = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const modal = dialog.current!
    modal.showModal()
    cancel.current?.focus()
    return () => {
      modal.close()
      const target = previous?.isConnected ? previous : document.getElementById('main-content')
      target?.focus({ preventScroll: true })
    }
  }, [])
  const clear = async () => {
    if (busy || clearing.current) return
    clearing.current = true
    setPending(true); setError('')
    try { await onClear(); onClose() }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Your labels could not be cleared. Try again.') }
    finally { clearing.current = false; setPending(false) }
  }
  return <dialog ref={dialog} className="import-review-dialog clear-labels-dialog" aria-labelledby="clear-labels-title" aria-describedby="clear-labels-description" onCancel={event => { event.preventDefault(); if (!pending) onClose() }}>
    <div className="import-review-body">
      <h2 id="clear-labels-title">Clear {count === 1 ? '1 label' : `all ${count} labels`} and start over?</h2>
      <p id="clear-labels-description">This removes your saved labels, artwork, creation requests, print settings, and import history from this browser. Downloaded ZIP files are unchanged. This cannot be undone.</p>
      {error && <p role="alert">{error}</p>}
    </div>
    <footer className="import-review-actions">
      <button ref={cancel} className="button secondary" type="button" disabled={pending} onClick={onClose}>Cancel</button>
      <button className="button primary" type="button" disabled={busy || pending} onClick={() => void clear()}>{pending ? 'Clearing labels…' : 'Clear labels'}</button>
    </footer>
  </dialog>
}

const steps = [
  { number: '01', icon: 'research' as const, title: 'Choose your labels', description: 'Find your blends and choose community designs that match the packaging you want to keep.' },
  { number: 'Optional', icon: 'spark' as const, title: 'Create your own', description: 'Need a different design? Use your own AI chat to adapt the original packaging. Bring back the finished label ZIP to add it to your selection.' },
  { number: '02', icon: 'print' as const, title: 'Print them together', description: 'Choose how many of each label you need. Print your jar-lid labels nine to a US Letter sheet.' },
]

export function Landing({ onNavigate, selectedCount = 0, readyCount = 0, busy, onFile, onClear }: LandingProps) {
  const [confirmClear, setConfirmClear] = useState(false)
  return <div className="landing-page screen-only">
    {confirmClear && <ClearLabelsDialog count={selectedCount} busy={busy} onClear={onClear} onClose={() => setConfirmClear(false)} />}
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <h1 id="landing-title">Keep the character of the tin.</h1>
        <p>Bring your blends' familiar artwork to the jars in your cellar, with labels adapted for printing and space to write your dates. Choose community designs or create the ones you need.</p>
        {selectedCount > 0 && <div className="landing-resume"><p>{selectedCount} {selectedCount === 1 ? 'label saved' : 'labels saved'} in this browser · {readyCount} ready to print</p><div className="landing-resume-actions"><button className="button primary" type="button" onClick={() => onNavigate('create')}>Resume your labels</button><button className="button quiet" type="button" disabled={busy} onClick={() => setConfirmClear(true)}>Clear labels</button></div></div>}
      </div>
      <div className="landing-start">
        <div className="landing-entry-paths">
          <button className="landing-entry-card" type="button" onClick={() => onNavigate('order')}><Icon name="upload" /><strong>Add several blends</strong><span>Choose an image or PDF, or paste a blend list. Review your blends and choose designs.</span></button>
          <button className="landing-entry-card" type="button" onClick={() => onNavigate('gallery')}><Icon name="research" /><strong>Browse label designs</strong><span>Choose from community designs and go straight to printing.</span></button>
        </div>
        <div className="landing-actions">
          <button className="button secondary" type="button" onClick={() => onNavigate('create')}><Icon name="pencil" size={20} /><span>Enter blends manually</span></button>
          <button className="button secondary" type="button" onClick={() => onNavigate('print')}><Icon name="upload" size={20} /><span>Import a label ZIP</span></button>
          <button className="button secondary" type="button" onClick={() => onNavigate('help')}><Icon name="book" size={20} /><span>How it works</span></button>
        </div>
        <p className="landing-privacy"><Icon name="lock" size={16} />No Tin to Cellar account needed. Imported files stay on your device.</p>
      </div>
      <div className="landing-hero-art">
        <img src="/assets/tin-to-cellar-jar-collection.jpg" alt="Illustration of a small collection of tobacco jars, including a stack of two, with Quiet Nights, Early Morning Pipe, and Escudo labels on their lids. Escudo coins are visible through the front jar." width={1254} height={1254} fetchPriority="high" />
      </div>
    </section>

    <section className="landing-process" aria-labelledby="landing-steps-title">
      <h2 className="landing-steps-heading" id="landing-steps-title">From choosing to printing</h2>
      <p className="landing-process-intro">Use community designs, create new ones, or combine both. Your selection stays saved in this browser between visits.</p>
      <div className="landing-steps">
        {steps.map((step) => <article className="landing-step panel" key={step.number}>
          <span className="landing-step-icon"><Icon name={step.icon} size={20} /></span>
          <p className="landing-step-number">{step.number}</p>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
          {step.icon === 'print' && <a href="/labels/help#label-paper">Paper and printing guidance</a>}
        </article>)}
      </div>
    </section>

    <ExamplePack variant="landing" busy={busy} onFile={async (file) => { await onFile(file); onNavigate('print') }} />
  </div>
}
