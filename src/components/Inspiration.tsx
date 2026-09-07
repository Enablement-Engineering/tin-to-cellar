export function Inspiration() {
  return <article className="editorial-page screen-only">
    <header className="editorial-header">
      <h1>Inspired by Hobbiton Piper</h1>
      <p className="editorial-lede">His guide to making labels for pipe tobacco jars was the starting point for Tin to Cellar.</p>
    </header>
    <div className="editorial-body">
      <iframe
        className="inspiration-video"
        width="560"
        height="315"
        src="https://www.youtube-nocookie.com/embed/2zPQSh5kHHQ"
        title="Hobbiton Piper: How To Make Cellar Labels For Pipe Tobacco Jars"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; picture-in-picture; web-share"
        allowFullScreen
      />
      <a className="inspiration-source" href="https://www.youtube.com/watch?v=2zPQSh5kHHQ">
        <strong>How To Make Cellar Labels For Pipe Tobacco Jars (Step By Step Guide)</strong>
        <span>Hobbiton Piper · Watch on YouTube <span aria-hidden="true">↗</span></span>
      </a>
      <section>
        <h2>A label worth keeping</h2>
        <p>In his 2021 guide, Hobbiton Piper arranges blend artwork in Microsoft Word, prints it on paper, then cuts out the labels and glues them to jar lids. He adds the year by hand.</p>
      </section>
      <section>
        <h2>From that guide to this app</h2>
        <p>Tin to Cellar follows that idea. Use your own AI chat to adapt the tin artwork, then bring the finished labels here to lay out and print. The labels leave room to add the date by hand.</p>
        <p>Thank you, Hobbiton Piper, for sharing the method that inspired this project.</p>
      </section>
    </div>
  </article>
}
