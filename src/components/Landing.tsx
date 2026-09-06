import { Icon } from './Icons'

type LandingProps = { onNavigate: (view: 'create' | 'print' | 'help') => void }

const steps = [
  { number: '01', icon: 'copy' as const, title: 'Copy the prompt', description: 'List your blends, or leave it blank and let your AI ask.' },
  { number: '02', icon: 'research' as const, title: 'Let your AI draw', description: 'It studies the real tin and adapts the artwork to a round label.' },
  { number: '03', icon: 'print' as const, title: 'Print at actual size', description: 'Bring the ZIP back here. Nine circles fit a US Letter sheet.' },
]

export function Landing({ onNavigate }: LandingProps) {
  return <div className="landing-page screen-only">
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-hero-copy">
        <p className="eyebrow landing-eyebrow">Jar labels from tin art</p>
        <h1 id="landing-title">Your tobacco keeps better in a jar. Make the jar look like the tin.</h1>
        <p>Tin to Cellar writes the prompt, your own AI chat draws the labels, and this page prints them at exactly 2.5 inches.</p>
        <div className="landing-actions">
          <button className="button primary" type="button" onClick={() => onNavigate('create')}><Icon name="spark" />Make a prompt</button>
          <button className="button secondary" type="button" onClick={() => onNavigate('help')}>How it works</button>
        </div>
        <p className="landing-privacy"><Icon name="lock" size={16} />No account. Imported files stay on your device.</p>
      </div>
      <div className="landing-hero-art" role="img" aria-label="A sheet of round labels beside a brass compass and ruler on a workbench" />
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

    <section className="landing-specs" aria-labelledby="landing-pack-title">
      <div className="landing-print-note">
        <h2 id="landing-pack-title">From chat to sheet</h2>
        <p>Your labels come back as a CellarPack: a ZIP with the artwork, its dimensions, and its sources.</p>
        <button className="button secondary" type="button" onClick={() => onNavigate('print')}><Icon name="upload" size={17} />Print a pack</button>
      </div>
      <dl className="landing-spec-grid">
        <div className="landing-spec"><dt>Circle trim</dt><dd>2.5 in</dd></div>
        <div className="landing-spec"><dt>Bleed on every side</dt><dd>0.125 in</dd></div>
        <div className="landing-spec"><dt>Labels per sheet</dt><dd>9</dd></div>
      </dl>
    </section>
  </div>
}
