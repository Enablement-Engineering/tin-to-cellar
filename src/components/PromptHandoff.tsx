import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Icon } from './Icons'
import { ProofAccess } from './ProofAccess'
import { proofAccessText, type ProofLease } from '../lib/prompt/proof-access'

type PromptHandoffProps = { prompt: string; request: string }
type CopyResult = { payload: string; kind: 'prompt' | 'request'; failed: boolean }

export function PromptHandoff({ prompt, request }: PromptHandoffProps) {
  const [lease, setLease] = useState<ProofLease | null>(null)
  const fullPrompt = prompt + proofAccessText(lease)
  const fullRequest = request + proofAccessText(lease)
  const [result, setResult] = useState<CopyResult | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [source, setSource] = useState(false)
  const currentResult = result && result.payload === (result.kind === 'prompt' ? fullPrompt : fullRequest) ? result : null
  const copy = async (kind: CopyResult['kind']) => {
    const payload = (kind === 'prompt' ? prompt : request) + proofAccessText(lease)
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
  const preview = previewIsRequest ? currentResult.payload : fullPrompt
  return (
    <section className="panel handoff" aria-labelledby="handoff-title">
      <div className="panel-heading"><h2 id="handoff-title">Create the artwork</h2></div>
      <p className="panel-intro">Paste this into your AI chat, then bring the label ZIP back here.</p>
      <ProofAccess lease={lease} onChange={setLease} />
      <div className="handoff-actions"><button className="button primary" type="button" onClick={() => void copy('prompt')}><Icon name="copy" />Copy prompt</button></div>
      <p className="copy-status" role="status">{currentResult ? currentResult.failed ? 'Copy was unavailable. Select and copy the text below.' : currentResult.kind === 'prompt' ? 'Prompt copied with all instructions. Paste it into your AI chat and press Send.' : 'Request copied. Use it in a chat that already has the Tin to Cellar instructions.' : ''}</p>
      <details className="more-options"><summary>More options</summary><p className="field-hint">Already added the reusable instructions to your chat? Copy only this label request. If the instructions are missing, the AI will ask for them before generating.</p><button className="button secondary" type="button" onClick={() => void copy('request')}>Copy request only</button></details>
      <details className="prompt-preview" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>{previewIsRequest ? 'Request to copy' : 'Read full prompt'}</summary>
        <div className="prompt-view-switch" role="group" aria-label="Prompt view">
          <button type="button" aria-pressed={!source} onClick={() => setSource(false)}>Preview</button>
          <button type="button" aria-pressed={source} onClick={() => setSource(true)}>Markdown source</button>
        </div>
        {source ? <textarea aria-label={previewIsRequest ? 'Request to copy' : 'Full prompt'} readOnly value={preview} rows={18} onFocus={(event) => event.currentTarget.select()} /> :
          <div className="prompt-document" role="region" aria-label="Rendered prompt" tabIndex={0}>
            <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{ img: ({ alt }) => <span>{alt ?? 'Image reference'}</span>, a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{preview}</Markdown>
          </div>}
      </details>
    </section>
  )
}
