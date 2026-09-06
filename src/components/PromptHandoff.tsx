import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Icon } from './Icons'
import { PROTOCOL_URL, protocolInstructions } from '../lib/protocol'
import { ProofAccess } from './ProofAccess'
import { proofAccessText, type ProofLease } from '../lib/prompt/proof-access'

type PromptHandoffProps = { prompt: string; request: string; completePrompt?: string; onPrint?: () => void; proofLease?: ProofLease | null; onProofLeaseChange?: (lease: ProofLease | null) => void }
type CopyResult = { payload: string; kind: 'prompt' | 'request' | 'complete'; failed: boolean }

export function PromptHandoff({ prompt, request, completePrompt = prompt, onPrint, proofLease, onProofLeaseChange }: PromptHandoffProps) {
  const [checking, setChecking] = useState(() => !proofLease || proofLease.expiresAt <= Date.now())
  const [localLease, setLocalLease] = useState<ProofLease | null>(null)
  const lease = proofLease === undefined ? localLease : proofLease
  const setLease = onProofLeaseChange ?? setLocalLease
  const fullPrompt = prompt + proofAccessText(lease)
  const fullComplete = completePrompt + proofAccessText(lease)
  const fullRequest = request + proofAccessText(lease)
  const [result, setResult] = useState<CopyResult | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [source, setSource] = useState(false)
  const currentResult = result && result.payload === (result.kind === 'prompt' ? fullPrompt : result.kind === 'complete' ? fullComplete : fullRequest) ? result : null
  const copy = async (kind: CopyResult['kind']) => {
    const payload = (kind === 'prompt' ? prompt : kind === 'complete' ? completePrompt : request) + proofAccessText(lease)
    try {
      await navigator.clipboard.writeText(payload)
      setResult({ payload, kind, failed: false })
    } catch {
      setResult({ payload, kind, failed: true })
      setExpanded(true)
      setSource(true)
    }
  }
  const previewIsRequest = currentResult?.failed && currentResult.kind === 'request'
  const preview = currentResult?.kind === 'complete' || currentResult?.failed ? currentResult.payload : fullPrompt
  return (
    <section className="handoff" aria-labelledby="handoff-title">
      <div className="handoff-content">
      <div className="panel-heading"><h2 id="handoff-title">Create the artwork</h2></div>
      <p className="panel-intro">Download the instructions and attach the file to your AI chat. Then paste the prompt into that same chat and send both together. When your labels are ready, download the ZIP and bring it back here.</p>
      <div className="handoff-actions"><a className="button secondary" href={`data:text/markdown;charset=utf-8,${encodeURIComponent(protocolInstructions())}`} download="tin-to-cellar-instructions.md">Download instructions</a><button className="button primary" type="button" disabled={checking} onClick={() => void copy('prompt')}><Icon name="copy" />Copy prompt</button></div>
      <ProofAccess lease={lease} onChange={setLease} onPendingChange={setChecking} />
      <p className="copy-status" role="status">{currentResult ? currentResult.failed ? 'Automatic copying did not work. Select and copy the text below.' : currentResult.kind === 'prompt' ? 'Prompt copied. Attach the downloaded instructions, paste this prompt into the same chat, and send both together.' : currentResult.kind === 'complete' ? 'Complete prompt copied. Paste it into your AI chat and send it.' : 'Request copied. Paste it into the chat where you already added the Tin to Cellar instructions.' : ''}</p>
      {onPrint && <button className="button quiet" type="button" onClick={onPrint}>Already have a ZIP? Print it<Icon name="arrow" size={16} /></button>}
      </div>
      <div className="handoff-details panel">
      <p className="field-hint">The download includes this site's complete instructions. Files do not transfer to your chat automatically. You can also <a href={PROTOCOL_URL} target="_blank" rel="noopener noreferrer">read the current instructions</a>.</p>
      <p className="field-hint">Cannot attach a file? Copy the complete prompt to include your request and all the instructions in one message.</p>
      <button className="button secondary" type="button" disabled={checking} onClick={() => void copy('complete')}>Copy complete prompt</button>
      <details className="prompt-preview" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>{previewIsRequest ? 'Request to copy' : 'Read prompt'}</summary>
        <div className="prompt-view-switch" role="group" aria-label="Prompt view">
          <button type="button" aria-pressed={!source} onClick={() => setSource(false)}>Preview</button>
          <button type="button" aria-pressed={source} onClick={() => setSource(true)}>Markdown source</button>
        </div>
        {source ? <textarea aria-label={previewIsRequest ? 'Request to copy' : 'Prompt to copy'} readOnly value={preview} rows={18} onFocus={(event) => event.currentTarget.select()} /> :
          <div className="prompt-document" role="region" aria-label="Rendered prompt" tabIndex={0}>
            <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{ img: ({ alt }) => <span>{alt ?? 'Image reference'}</span>, a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{preview}</Markdown>
          </div>}
      </details>
      <details className="more-options"><summary>More options</summary><p className="field-hint">For another batch in a chat that already has the instructions, copy just your new request.</p><button className="button secondary" type="button" disabled={checking} onClick={() => void copy('request')}>Copy request only</button></details>
      </div>
    </section>
  )
}
