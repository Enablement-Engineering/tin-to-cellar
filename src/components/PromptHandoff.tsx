import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Icon } from './Icons'
import { PROTOCOL_HTML_URL, protocolInstructions } from '../lib/protocol'
import { ProofAccess } from './ProofAccess'
import { proofAccessText, type ProofLease } from '../lib/prompt/proof-access'

type PromptHandoffProps = { prompt: string; request: string; completePrompt?: string; onPrint?: () => void; proofLease?: ProofLease | null; onProofLeaseChange?: (lease: ProofLease | null) => void }
type CopyResult = { payload: string; kind: 'hosted' | 'request' | 'complete'; failed: boolean }

export function PromptHandoff({ prompt, request, completePrompt = prompt, onPrint, proofLease, onProofLeaseChange }: PromptHandoffProps) {
  const [checking, setChecking] = useState(() => !proofLease || proofLease.expiresAt <= Date.now())
  const [localLease, setLocalLease] = useState<ProofLease | null>(null)
  const lease = proofLease === undefined ? localLease : proofLease
  const setLease = onProofLeaseChange ?? setLocalLease
  const payloads = { hosted: prompt + proofAccessText(lease), complete: completePrompt + proofAccessText(lease), request: request + proofAccessText(lease) }
  const [result, setResult] = useState<CopyResult | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [source, setSource] = useState(false)
  const currentResult = result && result.payload === payloads[result.kind] ? result : null
  const copy = async (kind: CopyResult['kind']) => {
    const payload = payloads[kind]
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
  const preview = currentResult?.failed ? currentResult.payload : source ? currentResult?.payload ?? payloads.hosted : prompt
  return (
    <section className="handoff" aria-labelledby="handoff-title">
      <div className="handoff-content">
      <div className="panel-heading"><h2 id="handoff-title">Create the artwork</h2></div>
      <p className="panel-intro">Copy the prompt, paste it into your AI chat, and send. Your AI will read the current instructions from this site. Bring the finished ZIP back here to print.</p>
      <p className="field-hint">Generating the images and creating the ZIP may take several minutes.</p>
      <div className="handoff-actions"><button className="button primary" type="button" disabled={checking} onClick={() => void copy('hosted')}><Icon name="copy" />Copy prompt</button></div>
      <ProofAccess lease={lease} onChange={setLease} onPendingChange={setChecking} />
      <p className="copy-status" role="status">{currentResult ? currentResult.failed ? 'Automatic copying did not work. Select and copy the text below.' : currentResult.kind === 'complete' ? 'Prompt and all instructions copied. Paste into your AI chat and send.' : currentResult.kind === 'hosted' ? 'Prompt copied. Paste into your AI chat and send.' : 'Request copied. Paste it into the chat where you already added the Tin to Cellar instructions.' : ''}</p>
      {onPrint && <button className="button quiet" type="button" onClick={onPrint}>Already have a ZIP? Print it<Icon name="arrow" size={16} /></button>}
      </div>
      <div className="handoff-details">
      <details className="prompt-preview" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>{previewIsRequest ? 'Request to copy' : 'Read prompt'}</summary>
        <p className="handoff-inspection-note">The prompt links to the <a href={PROTOCOL_HTML_URL} target="_blank" rel="noopener noreferrer">current instructions</a>. Choose Full copied text to inspect the exact text of your most recent copy.</p>
        <div className="prompt-view-switch" role="group" aria-label="Prompt view">
          <button type="button" aria-pressed={!source} onClick={() => setSource(false)}>Preview</button>
          <button type="button" aria-pressed={source} onClick={() => setSource(true)}>Full copied text</button>
        </div>
        {source ? <textarea aria-label={previewIsRequest ? 'Request to copy' : 'Prompt to copy'} readOnly value={preview} rows={18} onFocus={(event) => event.currentTarget.select()} /> :
          <div className="prompt-document" role="region" aria-label="Rendered prompt" tabIndex={0}>
            <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{ img: ({ alt }) => <span>{alt ?? 'Image reference'}</span>, a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{preview}</Markdown>
          </div>}
        <div className="handoff-reuse"><p className="field-hint">If your AI cannot read the instructions, copy the complete prompt and paste it into the same chat.</p><button className="handoff-text-action" type="button" disabled={checking} onClick={() => void copy('complete')}>Copy complete prompt</button><p className="field-hint">For a chat that already has the instructions, copy just the request. Or download the instructions and attach them with your request.</p><button className="handoff-text-action" type="button" disabled={checking} onClick={() => void copy('request')}>Copy request only</button><a href={`data:text/markdown;charset=utf-8,${encodeURIComponent(protocolInstructions())}`} download="tin-to-cellar-instructions.md">Download instructions</a></div>
      </details>
      </div>
    </section>
  )
}
