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
      <li><span className="workflow-step-number" aria-hidden="true">01</span><div><h2>Make a prompt</h2><p>List your tobaccos and special requests, or let your AI ask. Copy the full prompt into your chat and attach reference photos there if you have them.</p></div></li>
      <li><span className="workflow-step-number" aria-hidden="true">02</span><div><h2>Create the labels in your chat</h2><p>Your AI studies the original packaging and adapts it into round labels with a light writing space. Ask for changes in the same chat, then download the label ZIP.</p></div></li>
      <li><span className="workflow-step-number" aria-hidden="true">03</span><div><h2>Bring the ZIP back and print</h2><p>Open Print labels, choose your ZIP, and set quantities. Print at actual size with headers and footers off, or choose Save as PDF.</p><p className="spec-line">Avery 94502 · 2.5 in circles · 9 per US Letter sheet</p></div></li>
    </ol>
    </section>
    <section className="help-reuse panel" aria-labelledby="reuse-title">
    <h2 id="reuse-title">Reuse the instructions</h2>
    <p>For repeated batches, attach these instructions to your chat or AI project. Next time, use More options and Copy request only.</p>
    <p className="field-hint">A new chat needs the instructions or the complete prompt before generating.</p>
    <div className="help-actions"><a className="button secondary" ref={downloadLink} download="tin-to-cellar-instructions.md"><Icon name="download" size={17} />Download instructions</a><a className="button quiet" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT ↗</a></div>
    </section>
    <section className="help-answers" aria-label="Common questions">
    <article>
    <h2>Why use a separate AI chat?</h2>
    <p>Use the AI account or subscription you already have, within its usual limits. This site does not run its own image-generation service.</p>
    </article>
    <article>
    <h2>What if a label comes back wrong?</h2>
    <p>Usable labels remain printable. Labels with incompatible dimensions stay off the sheet. Copy the repair request into the same chat and bring back the corrected ZIP.</p>
    </article>
    <article>
    <h2>Check the fit before printing</h2>
    <p>Your AI makes trim and safe-area guides by default. For hosted checks, open More options and choose Enable hosted image checks before copying your prompt.</p>
    <p>Cloudflare verifies access for up to 60 checks over 24 hours. The service returns guide copies without storing images. If access expires or capacity runs out, your AI uses local guides. Only clean artwork goes into the ZIP.</p>
    </article>
    <article>
    <h2>What happens on this device?</h2>
    <p>This app checks your ZIP and places each label at its physical size. Imported files stay in your browser, and research links are never opened automatically.</p>
    <p>Switching views keeps your work; reloading or closing the page clears the print job. Keep the ZIP so you can import it again.</p>
    </article>
    <article>
    <h2>Does the return link bring my labels?</h2>
    <p>The link opens Print labels. Download the ZIP from your chat, then choose it here. A localhost link works only on the device running this app.</p>
    </article>
    </section>
  </div>
}
