import { Icon } from './Icons'
import { ExamplePack } from './ExamplePack'

type LandingProps = { onNavigate: (view: 'create' | 'print' | 'help') => void; busy: boolean; onFile: (file: File) => Promise<void> }

const steps = [
  { number: '01', icon: 'copy' as const, title: 'Copy the prompt', description: 'Add your blend names, or leave them blank and let your AI ask.' },
  { number: '02', icon: 'research' as const, title: 'Create the artwork', description: 'Your AI uses the original tin artwork to make round labels.' },
  { number: '03', icon: 'print' as const, title: 'Print at actual size', description: 'Bring the ZIP back here. Nine circles fit a US Letter sheet.' },
]

export function Landing({ onNavigate, busy, onFile }: LandingProps) {
  return <div className="landing-page screen-only">
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <p className="eyebrow landing-eyebrow">Jar labels from tin art</p>
        <h1 id="landing-title">Make the jar look like the tin.</h1>
        <p>Choose your blends, copy a prompt into your AI chat, then bring the finished labels back here to lay out and print.</p>
        <div className="landing-actions">
          <button className="button primary" type="button" onClick={() => onNavigate('create')}><Icon name="spark" />Make a prompt</button>
          <button className="button secondary" type="button" onClick={() => onNavigate('help')}>How it works</button>
        </div>
        <p className="landing-privacy"><Icon name="lock" size={16} />No Tin to Cellar account needed. Imported files stay on your device.</p>
      </div>
      <div className="landing-hero-art">
        <img src="/assets/tin-to-cellar-jar-collection.jpg" alt="Illustration of a small collection of tobacco jars, including a stack of two, with Quiet Nights, Early Morning Pipe, and Escudo labels on their lids. Escudo coins are visible through the front jar." width={1254} height={1254} fetchPriority="high" />
      </div>
    </section>

    <section className="landing-process" aria-labelledby="landing-steps-title">
      <h2 className="landing-steps-heading" id="landing-steps-title">Three steps, one chat</h2>
      <div className="landing-steps">
        {steps.map((step) => <article className="landing-step panel" key={step.number}>
          <span className="landing-step-icon"><Icon name={step.icon} size={20} /></span>
          <p className="landing-step-number">{step.number}</p>
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </article>)}
      </div>
    </section>

    <ExamplePack variant="landing" busy={busy} onFile={async (file) => { await onFile(file); onNavigate('print') }} />
  </div>
}
