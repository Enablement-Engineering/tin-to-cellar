import { useEffect, useRef } from 'react'
import { Icon } from './Icons'

export function HowItWorks({ instructions }: { instructions: string }) {
  const downloadLink = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([instructions], { type: 'text/markdown;charset=utf-8' }))
    if (downloadLink.current) downloadLink.current.href = url
    return () => URL.revokeObjectURL(url)
  }, [instructions])
  return <div className="help-page how-it-works screen-only">
    <section aria-labelledby="how-title">
    <div className="page-heading"><h1 id="how-title">How it works</h1><p>Choose existing designs, create your own, and print them together.</p></div>
    <ol className="workflow-steps">
      <li><span className="workflow-step-number" aria-hidden="true">01</span><div><h2>Choose your labels</h2><p>Add blend names or import an order, then choose community designs you like. You can also browse Community labels or import a label ZIP you already have. If you have everything you need, continue straight to printing.</p></div></li>
      <li><span className="workflow-step-number" aria-hidden="true">02</span><div><h2>Create any new designs</h2><p>Choose Create my own for the blends you want new artwork for. Copy their prompt into your AI chat and send it. Your existing selections stay saved in this browser while the AI makes the new labels. Attach reference photos in the chat if you have them, and download the finished ZIP.</p></div></li>
      <li><span className="workflow-step-number" aria-hidden="true">03</span><div><h2>Add the artwork and print</h2><p>Open Print labels and import the new ZIP. Review additions and choose whether to replace an existing design or keep both. Choose quantities, then print at actual size or 100% scale with headers and footers off. You can also choose Save as PDF.</p><p className="spec-line">Avery 94502 · 2.5 in circles · 9 per US Letter sheet</p></div></li>
    </ol>
    </section>
    <section className="help-answers" aria-labelledby="behind-scenes-title">
      <h2 id="behind-scenes-title">What happens behind the scenes</h2>
      <p>The production brief asks your chosen AI to follow these steps.</p>
      <ol>
        <li><strong>Research.</strong> Find authoritative packaging references and use them to establish the blend's identity.</li>
        <li><strong>Art direction.</strong> Follow the label geometry, permitted text and writing-space requirements while preserving the package's character.</li>
        <li><strong>Generation.</strong> Adapt the artwork to the label's shape and writing space.</li>
        <li><strong>Proof.</strong> Inspect dimensions, bleed, safe areas, text, writing space and fidelity to the package.</li>
        <li><strong>Repair.</strong> Use specific correction instructions when a check fails.</li>
        <li><strong>Package.</strong> Return the reviewed artwork and structured metadata together in a CellarPack that the app can validate and print.</li>
      </ol>
      <p>The workflow is not tied to a particular image model. Tin to Cellar defines the job, constraints, checks and return format; your chosen creative system performs the work.</p>
      <p>The app checks the returned files and print geometry. Review the artwork yourself for spelling, recognizable packaging and a usable writing area before printing.</p>
    </section>
    <section className="help-reuse panel" aria-labelledby="reuse-title">
    <h2 id="reuse-title">Reuse the instructions</h2>
    <p>Copy prompt includes your request, all instructions and the proof program. Paste it once into your chat. There is no separate instruction page for your AI to retrieve.</p>
    <p className="field-hint">For another batch in the same chat, tell your AI which blends to make. You can also download the instructions for your own reference.</p>
    <div className="help-actions"><a className="button secondary" ref={downloadLink} download="tin-to-cellar-instructions.md"><Icon name="download" size={17} />Download instructions</a><a className="button quiet" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT ↗</a></div>
    </section>
    <section className="help-answers" aria-label="Common questions">
    <article>
    <h2>Why use a separate AI chat?</h2>
    <p>Use a chat that can browse the web, generate images, and create a ZIP download. You can use the account you already have, within its usual limits. Tin to Cellar does not generate the images itself.</p>
    </article>
    <article>
    <h2>What if a label comes back wrong?</h2>
    <p>Usable labels remain printable. Labels with incompatible dimensions stay off the sheet. Copy the repair request into the same chat and bring back the corrected ZIP.</p>
    </article>
    <article>
    <h2>Check the fit before printing</h2>
    <p>Your AI makes separate guide copies in its own working environment to check the cut edge, safe area, bleed, and writing space. It reviews those guides before packaging the labels.</p>
    <p>Only the artwork without guides goes into the ZIP. These checks help with fit, but you should still review the labels and print a test sheet before using label stock.</p>
    </article>
    <article>
    <h2>What stays in my browser?</h2>
    <p>This app checks your ZIP and places each label at its physical size. Imported files stay in your browser, and research links are never opened automatically.</p>
    <p>Importing automatically shares valid AI feedback, ZIP-check results, and eligible package-source links. Choose View shared diagnostics to inspect the shared fields, or Report a failed AI run for a separate failure report. This collection does not upload your ZIP or artwork. Gallery sharing requires a separate selection and submission. See Privacy for details.</p>
    <p>Your selected artwork, quantities, and current creation request are saved in this browser, including when you reload or return in another tab. Another device starts separately. Clearing site data removes this saved work. Download labels to keep the finished artwork; that ZIP does not preserve quantities or unfinished requests.</p>
    </article>
    <article>
    <h2>Does the return link bring my labels?</h2>
    <p>The link opens Print labels. Download the ZIP from your chat, then choose it here.</p>
    </article>
    </section>
  </div>
}
