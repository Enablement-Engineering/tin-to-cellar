export function About() {
  return <article className="editorial-page screen-only">
    <header className="editorial-header">
      <p className="eyebrow">Behind the app</p>
      <h1>About Tin to Cellar</h1>
      <p className="editorial-lede">Keep the look of your favorite tins when the tobacco moves into jars.</p>
    </header>
    <div className="editorial-body">
      <section>
        <h2>Why I made it</h2>
        <p>I'm Dylan Isaac. I made Tin to Cellar to make it easier to carry a tin's artwork over to a jar label. The artwork is part of what makes a blend recognizable.</p>
        <p>You use your own AI chat to make the artwork, then return here to arrange and print the labels. Each design leaves room to write a date by hand.</p>
        <p><a href="/inspiration">Hobbiton Piper's guide</a> was the starting point. Tin to Cellar builds on his idea so you can make a set of labels without laying out every sheet by hand.</p>
      </section>
      <section>
        <h2>Personal cellaring</h2>
        <p>Tin to Cellar is an independent tool, not affiliated with or endorsed by tobacco brands. It adapts recognizable packaging for personal jar labels. Brand names and original packaging artwork belong to their respective owners. Using the tool does not grant permission to reuse those designs.</p>
        <p className="field-hint">Questions about a label or source link? <a href="mailto:dylan@enablement.engineering">Email this address</a> with a link and a short note.</p>
      </section>
      <section>
        <h2>Enablement Engineering</h2>
        <p>Enablement Engineering is both a philosophy and a practice of helping people do more with technology. For me, that means building around human needs and making sure more people can share in the benefits.</p>
        <p>Accessibility and education are central to that work. I want the tools I build to remove barriers and give people more ways to learn, create, and make their own choices. Tin to Cellar is one small project from that practice.</p>
        <p><a href="https://www.enablement.engineering/">More about Enablement Engineering <span aria-hidden="true">↗</span></a></p>
      </section>
    </div>
  </article>
}
