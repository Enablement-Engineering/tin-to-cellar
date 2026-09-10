import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Icon } from './Icons'

type PromptHandoffProps = { prompt: string; request: string; copyLabel?: string; copied?: boolean; busy?: boolean; onCopy?: () => Promise<string>; onCopyLatest?: () => Promise<string>; onCopied?: (payload: string) => void }
type CopyResult = { payload: string; source: string; failed: boolean }

export function PromptHandoff({ prompt, request, copyLabel = 'Copy instructions', copied = false, busy, onCopy, onCopyLatest, onCopied }: PromptHandoffProps) {
  const copyButton = useRef<HTMLButtonElement>(null)
  const restoreCopyFocus = useRef(false)
  const [result, setResult] = useState<CopyResult | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [source, setSource] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  useEffect(() => {
    if (!busy && !saving && restoreCopyFocus.current) {
      restoreCopyFocus.current = false
      copyButton.current?.focus()
    }
  }, [busy, saving])
  const currentResult = result && (result.payload === prompt || result.source === prompt) ? result : null
  const copy = async (latest = false) => {
    if (busy || saving) return
    let payload = prompt
    setSaving(true); setSaveError('')
    const prepare = latest ? onCopyLatest : onCopy
    if (prepare) {
      try { payload = await prepare() }
      catch (error) { setSaveError(error instanceof Error ? error.message : 'Your request could not be saved. Try copying again before leaving this page.'); setSaving(false); return }
    }
    try {
      await navigator.clipboard.writeText(payload)
      setResult({ payload, source: prompt, failed: false })
      onCopied?.(payload)
    } catch {
      setResult({ payload, source: prompt, failed: true })
      setExpanded(true)
      setSource(true)
    } finally { restoreCopyFocus.current = latest; setSaving(false) }
  }
  const preview = source ? currentResult?.payload ?? prompt : request
  return (
    <section className="handoff" aria-labelledby="handoff-title">
      <div className="handoff-content">
      <div className="creation-step-heading"><span className="creation-step-number" aria-hidden="true">2</span><h2 id="handoff-title" tabIndex={-1}>Create in your AI chat</h2></div>
      <ol className="creation-chat-instructions"><li>Copy the instructions below.</li><li>Open your AI chat, paste the instructions, and send.</li><li>When the artwork is ready, download the label ZIP it produces.</li></ol>
      <p className="field-hint">Creating the images and ZIP may take several minutes. This page does not start or track your AI chat.</p>
      <div className="handoff-actions"><button ref={copyButton} className={`button ${copied || currentResult && !currentResult.failed ? 'secondary' : 'primary'}`} type="button" disabled={busy || saving} onClick={() => void copy()}><Icon name="copy" />{saving ? 'Preparing request…' : copyLabel}</button></div>
      {onCopyLatest && <div className="handoff-update"><p>Updated instructions are available. Keep the saved copy for your existing chat, or use the update to start a new chat with the same request.</p><button type="button" className="button secondary" disabled={busy || saving} onClick={() => void copy(true)}>Copy updated instructions for a new chat</button></div>}
      {saveError && <p role="alert">{saveError}</p>}
      <p className="copy-status" role="status">{currentResult?.failed ? 'Automatic copying did not work. Select and copy the text below.' : copied || currentResult ? 'Copied. Open your AI chat, paste, and send. Return here with the finished ZIP.' : ''}</p>
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
