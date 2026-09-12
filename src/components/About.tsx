export function About() {
  return <article className="editorial-page screen-only">
    <header className="editorial-header">
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
        <h2>Enablement Engineering</h2>
        <p>Enablement Engineering is both a philosophy and a practice of helping people do more with technology. For me, that means building around human needs and making sure more people can share in the benefits.</p>
        <p>Accessibility and education are central to that work. I want the tools I build to remove barriers and give people more ways to learn, create, and make their own choices. Tin to Cellar is one example of that practice, built around a specific human need, with the complicated parts handled behind the scenes.</p>
        <p><a href="https://www.enablement.engineering/">More about Enablement Engineering <span aria-hidden="true">↗</span></a></p>
      </section>
      <section>
        <h2>Behind the labels</h2>
        <p>Tin to Cellar is also an experiment in using generative tools carefully.</p>
        <p>The AI gets a structured production brief. It asks the AI to research the original package, preserve the blend's recognizable identity, work within known print geometry, leave writing space, inspect the result and repair problems. The finished artwork returns in a format the app can check.</p>
        <p>The label is the visible result. The workflow makes creative work easier to review against its sources and constraints. Those checks support your judgment; they do not certify packaging fidelity or permission to use a design.</p>
      </section>
      <section>
        <h2>Respecting the original work</h2>
        <p>Tin to Cellar is an independent tool, not affiliated with or endorsed by tobacco brands. It adapts recognizable packaging for personal jar labels. Brand names and original packaging artwork belong to their respective owners. Using the tool does not grant permission to reuse those designs.</p>
        <p className="field-hint">Questions about a label or source link? <a href="mailto:dylan@enablement.engineering">Email this address</a> with a link and a short note.</p>
      </section>
      <section>
        <h2>Beyond cellar labels</h2>
        <p>Jar labels are a deliberately narrow test case for adapting existing creative work while respecting its identity, sources, constraints and human review.</p>
        <p>The same approach can inform other product artwork where consistency matters. If you work with a brand, retailer or maker and are interested in the process, <a href="mailto:dylan@enablement.engineering">I'd be glad to talk</a>.</p>
      </section>
    </div>
  </article>
}
