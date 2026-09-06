interface SiteHomeProps {
  onNavigate: () => void
}

export function SiteHome({ onNavigate }: SiteHomeProps) {
  return <div className="landing-page screen-only">
    <section className="landing-hero" aria-labelledby="site-home-title">
      <div className="landing-hero-copy">
        <p className="eyebrow">Tin to Cellar</p>
        <h1 id="site-home-title">For the jars in your cellar.</h1>
        <p>Give your tobacco jars labels inspired by the original tin artwork.</p>
        <a className="button primary" href="/labels" onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          onNavigate()
        }}>Explore Labels</a>
      </div>
      <div className="landing-hero-art" role="img" aria-label="A sheet of round labels beside a brass compass and ruler on a workbench" />
    </section>
  </div>
}
