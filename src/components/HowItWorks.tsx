import { useEffect, useRef } from 'react'

export function HowItWorks({ instructions }: { instructions: string }) {
  const downloadLink = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([instructions], { type: 'text/markdown;charset=utf-8' }))
    if (downloadLink.current) downloadLink.current.href = url
    return () => URL.revokeObjectURL(url)
  }, [instructions])
  return <section className="how-it-works panel screen-only" aria-labelledby="how-title">
    <h1 id="how-title">How it works</h1>
    <ol className="workflow-steps">
      <li><h2>Make a prompt</h2><p>List your tobaccos and any special requests. You can leave the list blank and let the AI ask what you are cellaring. Copy the full prompt into ChatGPT or Codex, and attach reference photos there if you have them.</p></li>
      <li><h2>Create the labels in your chat</h2><p>The AI researches the original packaging and adapts it into round labels with a light writing space. Ask for changes in that same chat, then download the label ZIP it returns.</p></li>
      <li><h2>Bring the ZIP back and print</h2><p>Open Print labels, import the ZIP, and choose your quantities. If anything needs repair, copy the repair request into the same chat and import the corrected ZIP.</p><p>Use Avery 94502: nine 2.5-inch circles on US Letter paper. Print at Actual Size / 100%, with headers and footers off. Choose Save as PDF for a printable file.</p></li>
    </ol>
    <p><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT ↗</a></p>
    <h2>Reuse the instructions</h2>
    <p>Copy prompt includes everything for a new chat. For repeated requests, download the instructions below and attach them to your chat, or add them to an AI project that supports reference files. Then use More options → Copy request only.</p>
    <p>The download is a Markdown reference file. If your chat does not have the instructions, attach them or use the complete prompt before generating.</p>
    <a className="button secondary" ref={downloadLink} download="tin-to-cellar-instructions.md">Download instructions</a>
    <h2>Why use a separate AI chat?</h2>
    <p>Use the AI account or subscription you already have, within its usual limits. This site does not run a separate paid image-generation service, which keeps it inexpensive to host or run locally.</p>
    <h2>Check the fit before printing</h2>
    <p>The prompt asks your AI to send generated labels to our review service, which returns a copy with trim and safe-area guides. It does not store the images. Your AI uses the guides to check the fit and make corrections; the clean artwork goes into your label ZIP. If the service is unavailable, the AI can make those guides itself.</p>
    <h2>What happens on this device?</h2>
    <p>Your chat creates the artwork. This app checks the ZIP and places the labels at their physical size on the printer sheet. Keeping those jobs separate lets the artwork stay independent of the sheet layout.</p>
    <p>Imported files stay in your browser. The app does not upload them or automatically open research links. Switching tabs keeps your work; reloading or closing the page clears the current print job. Keep the downloaded ZIP so you can import it again.</p>
    <p>The return link in your AI chat opens Print labels. You still download the ZIP and choose it here; the link does not transfer files. A localhost link works only on the device running this app.</p>
  </section>
}
