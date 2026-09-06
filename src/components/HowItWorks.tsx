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
    <div className="page-heading"><h1 id="how-title">How it works</h1><p>One prompt, your own AI chat, and a sheet of labels.</p></div>
    <ol className="workflow-steps">
      <li><span className="workflow-step-number" aria-hidden="true">01</span><div><h2>Make a prompt</h2><p>Add your blend names and any special requests, or leave them blank and let your AI ask. Choose Copy prompt, paste it into your chat, and send it. Attach reference photos there if you have them.</p></div></li>
      <li><span className="workflow-step-number" aria-hidden="true">02</span><div><h2>Create the labels in your chat</h2><p>Your AI uses the original packaging to make round labels with a blank space for the date. Ask for changes in the same chat, then download the label ZIP.</p></div></li>
      <li><span className="workflow-step-number" aria-hidden="true">03</span><div><h2>Bring the ZIP back and print</h2><p>Open Print labels, choose your ZIP, and set quantities. Print at actual size or 100% scale with headers and footers off. You can also choose Save as PDF.</p><p className="spec-line">Avery 94502 · 2.5 in circles · 9 per US Letter sheet</p></div></li>
    </ol>
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
    <p>Switching views keeps your work; reloading or closing the page clears the print job. Keep the ZIP so you can import it again.</p>
    </article>
    <article>
    <h2>Does the return link bring my labels?</h2>
    <p>The link opens Print labels. Download the ZIP from your chat, then choose it here.</p>
    </article>
    </section>
  </div>
}
