import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Icon } from './Icons'

type PromptHandoffProps = { prompt: string; request: string; onPrint?: () => void }
type CopyResult = { payload: string; failed: boolean }

export function PromptHandoff({ prompt, request, onPrint }: PromptHandoffProps) {
  const [result, setResult] = useState<CopyResult | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [source, setSource] = useState(false)
  const currentResult = result && result.payload === prompt ? result : null
  const copy = async () => {
    const payload = prompt
    try {
      await navigator.clipboard.writeText(payload)
      setResult({ payload, failed: false })
    } catch {
      setResult({ payload, failed: true })
      setExpanded(true)
      setSource(true)
    }
  }
  const preview = source ? prompt : request
  return (
    <section className="handoff" aria-labelledby="handoff-title">
      <div className="handoff-content">
      <div className="panel-heading"><h2 id="handoff-title">Create the artwork</h2></div>
      <p className="panel-intro">Copy the prompt, paste it into your AI chat, and send. The prompt includes everything your AI needs. Bring the finished ZIP back here to print.</p>
      <p className="field-hint">Generating the images and creating the ZIP may take several minutes.</p>
      <div className="handoff-actions"><button className="button primary" type="button" onClick={() => void copy()}><Icon name="copy" />Copy prompt</button></div>
      <p className="copy-status" role="status">{currentResult ? currentResult.failed ? 'Automatic copying did not work. Select and copy the text below.' : 'Prompt and all instructions copied. Paste into your AI chat and send.' : ''}</p>
      {onPrint && <button className="button quiet" type="button" onClick={onPrint}>Already have a ZIP? Print it<Icon name="arrow" size={16} /></button>}
      </div>
      <div className="handoff-details">
      <details className="prompt-preview" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>Read prompt</summary>
        <p className="handoff-inspection-note">Preview shows your request. Full copied text includes the protocol, schemas and proof program sent with it.</p>
        <div className="prompt-view-switch" role="group" aria-label="Prompt view">
          <button type="button" aria-pressed={!source} onClick={() => setSource(false)}>Preview</button>
          <button type="button" aria-pressed={source} onClick={() => setSource(true)}>Full copied text</button>
        </div>
        {source ? <textarea aria-label="Prompt to copy" readOnly value={preview} rows={18} onFocus={(event) => event.currentTarget.select()} /> :
          <div className="prompt-document" role="region" aria-label="Rendered prompt" tabIndex={0}>
            <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{ img: ({ alt }) => <span>{alt ?? 'Image reference'}</span>, a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{preview}</Markdown>
          </div>}

      </details>
      </div>
    </section>
  )
}
