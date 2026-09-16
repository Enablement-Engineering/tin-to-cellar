import { useEffect, useRef } from 'react'
import { Icon } from './Icons'
import { LabelPaperGuidance } from './LabelPaperGuidance'

export function HowItWorks({ instructions }: { instructions: string }) {
  const downloadLink = useRef<HTMLAnchorElement>(null)
  const paperHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (window.location.hash !== '#label-paper') return
    // The help page mounts after its instructions load, so the browser's
    // initial fragment scroll can happen before this heading exists.
    const frame = requestAnimationFrame(() => {
      paperHeading.current?.focus({ preventScroll: true })
      paperHeading.current?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([instructions], { type: 'text/markdown;charset=utf-8' }))
    if (downloadLink.current) downloadLink.current.href = url
    return () => URL.revokeObjectURL(url)
  }, [instructions])
  return <div className="help-page how-it-works screen-only">
    <section aria-labelledby="how-title">
    <div className="page-heading"><h1 id="how-title">How it works</h1><p>Choose labels for your blends, create any missing designs, and prepare a sheet to print.</p></div>
    <ol className="workflow-steps">
      <li><span className="workflow-step-number" aria-hidden="true">01</span><div><h2>Choose your labels</h2><p>Browse community designs, enter blend names, or add a list from an order or screenshot. Choose the artwork you want for each blend. Already have a label ZIP? Import it in Print labels.</p></div></li>
      <li><span className="workflow-step-number" aria-hidden="true">02</span><div><h2>Create new designs if needed</h2><p>Select the blends that need new artwork. Review the request, add any design notes, and copy the instructions into your own AI chat.</p><p>Your AI shows a packaging photo for each blend. If it is the right one, use Copy Image and paste the photo into the chat. The AI makes and checks one label at a time. Review the artwork, then download the finished label ZIP.</p><p>You can skip this step when community designs cover what you need.</p></div></li>
      <li><span className="workflow-step-number" aria-hidden="true">03</span><div><h2>Add the artwork and print</h2><p>Import any new label ZIP and review the designs. Choose which to add or replace, then set your print quantities. In the print dialog, use US Letter, no margins, and Actual Size / 100%. Turn off headers and footers, or choose Save as PDF to keep the sheets.</p></div></li>
    </ol>
    </section>
    <section id="label-paper" className="help-answers" aria-labelledby="label-paper-title">
      <h2 id="label-paper-title" ref={paperHeading} tabIndex={-1}>What you'll need</h2>
      <p>2.5-inch round labels for jar lids, printed at Actual Size / 100%.</p>
      <LabelPaperGuidance />
    </section>
    <section className="help-answers" aria-labelledby="behind-scenes-title">
      <h2 id="behind-scenes-title">How the artwork keeps the tin's character</h2>
      <p>For each new design, the instructions ask your AI to follow these steps.</p>
      <ol>
        <li><strong>Research.</strong> Find the blend's actual packaging and confirm the reference photo with you.</li>
        <li><strong>Layout.</strong> Keep the package's defining illustration, colors, and lettering while making room for a handwritten date.</li>
        <li><strong>Generation.</strong> Adapt the artwork to the label's shape and writing space.</li>
        <li><strong>Check.</strong> Compare the artwork with the packaging photo. Check the names, writing space, and fit within the label's cut edge.</li>
        <li><strong>Repair.</strong> Ask you before trying to correct a confirmed artwork problem.</li>
        <li><strong>Package.</strong> Return the artwork and print details in a CellarPack, the label ZIP you import here.</li>
      </ol>
      <p>Tin to Cellar checks the returned files and dimensions. Finishing the checks does not guarantee every detail is right. Review the artwork against the original packaging before printing. Check the names and make sure the blank area is large enough for your dates.</p>
    </section>
    <section className="help-reuse panel" aria-labelledby="reuse-title">
    <h2 id="reuse-title">Reuse the instructions</h2>
    <p>The copied instructions include your selected blends and the steps for making and checking each label. For another batch in the same chat, tell your AI which blends to make next.</p>
    <p className="field-hint">The download below contains the reusable instructions without your blend selection.</p>
    <div className="help-actions"><a className="button secondary" ref={downloadLink} download="tin-to-cellar-instructions.md"><Icon name="download" size={17} />Download instructions</a><a className="button quiet" href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT ↗</a></div>
    </section>
    <section className="help-answers" aria-label="Common questions">
    <article>
    <h2>Designed for ChatGPT</h2>
    <p>These instructions are designed for ChatGPT. Other AI agents may also work if they can browse the web, inspect and generate images, run code, and return downloadable ZIP files.</p>
    </article>
    <article>
    <h2>Why use a separate AI chat?</h2>
    <p>New artwork is made in your own AI chat using the account you already have, within its usual limits. Community designs can be printed without one.</p>
    </article>
    <article>
    <h2>What if I cannot copy the packaging photo?</h2>
    <p>Save the photo and attach it to your AI chat, or attach a clear screenshot. If it shows the wrong package, tell your AI which edition to find before confirming it.</p>
    </article>
    <article>
    <h2>What if a label comes back wrong?</h2>
    <p>If an imported file fails checks, use its repair request in the original AI chat and bring back the corrected ZIP. Labels that pass can still be printed. If the artwork itself looks wrong, describe the problem to that chat and compare the correction with the original package.</p>
    </article>
    <article>
    <h2>Check the fit before printing</h2>
    <p>Print a test on plain paper before using label stock. In Paper and alignment, you can print an alignment sheet and adjust the label position. The ruler should measure two inches at Actual Size / 100%.</p>
    <p>Artwork checks help the design fit inside the cut edge. A test sheet checks how your printer places it on the page.</p>
    </article>
    <article>
    <h2>What stays in my browser?</h2>
    <p>Your artwork, quantities, and requests are saved in this browser. Another device starts separately, and clearing site data removes this saved work. Download labels keeps the finished artwork in a ZIP; it does not save quantities or unfinished requests.</p>
    <p>Imported orders and ZIPs are read on your device. Importing a label ZIP automatically shares valid AI feedback, file-check results, and eligible public packaging links. It does not upload your artwork or open the reference links. Submitting artwork to the community is a separate action. Optional usage measurement counts actions and request milestones only when you enable it. See <a href="/privacy">Privacy and data choices</a> for details.</p>
    </article>
    <article>
    <h2>How do I bring labels back from my chat?</h2>
    <p>Download the finished label ZIP, then import it here. A return link opens Print labels, but does not transfer the file.</p>
    </article>
    </section>
  </div>
}
