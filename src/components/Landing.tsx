import { Icon } from './Icons'
import { ExamplePack } from './ExamplePack'

type LandingProps = { onNavigate: (view: 'create' | 'print' | 'help') => void; busy: boolean; onFile: (file: File) => Promise<void> }

const steps = [
  { number: '01', icon: 'research' as const, title: 'Choose existing designs', description: 'Add your blends or import an order, then choose community artwork. Found everything you need? Go straight to printing.' },
  { number: 'Optional', icon: 'spark' as const, title: 'Create your own', description: 'Select Create my own for any blend that needs a new design. Copy its prompt into your AI chat, then import the finished label ZIP alongside your choices.' },
  { number: '02', icon: 'print' as const, title: 'Print them together', description: 'Choose quantities for your community and imported designs. Print at Actual Size / 100%, with nine 2.5-inch circles per US Letter sheet.' },
]

export function Landing({ onNavigate, busy, onFile }: LandingProps) {
  return <div className="landing-page screen-only">
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <h1 id="landing-title">Make the jar look like the tin.</h1>
        <p>Start with community designs for your blends. If you want something different, create it in your AI chat. Keep both in one set of labels and print them together.</p>
        <div className="landing-actions">
          <button className="button primary" type="button" onClick={() => onNavigate('create')}><Icon name="research" />Choose labels</button>
          <button className="button secondary" type="button" onClick={() => onNavigate('print')}>Import a label ZIP</button>
          <button className="button quiet" type="button" onClick={() => onNavigate('help')}>How it works</button>
        </div>
        <p className="landing-privacy"><Icon name="lock" size={16} />No Tin to Cellar account needed. Imported files stay on your device.</p>
      </div>
      <div className="landing-hero-art">
        <img src="/assets/tin-to-cellar-jar-collection.jpg" alt="Illustration of a small collection of tobacco jars, including a stack of two, with Quiet Nights, Early Morning Pipe, and Escudo labels on their lids. Escudo coins are visible through the front jar." width={1254} height={1254} fetchPriority="high" />
      </div>
    </section>

    <section className="landing-process" aria-labelledby="landing-steps-title">
      <h2 className="landing-steps-heading" id="landing-steps-title">From choosing to printing</h2>
      <p className="landing-process-intro">Your choices and quantities are saved in this browser, so you can come back to them. No AI chat is needed to print existing designs.</p>
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
