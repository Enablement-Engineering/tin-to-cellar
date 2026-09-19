import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CopyFeedbackIcon } from './Icons'

// Keep the launch URL generic. The complete, versioned instructions and the
// user's label request remain in the copied payload, never in the URL.
const chatGPTStarter = `I'm here to make jar labels with Tin to Cellar. Give me a warm, easygoing welcome starting with "Howdy!" and invite me to paste the instructions I just copied. Use your own words and a little personality; keep it to a sentence or two in everyday language. Then wait for the instructions before starting any label work.`
const chatGPTUrl = `https://chatgpt.com/?${new URLSearchParams({ prompt: chatGPTStarter })}`

type PromptHandoffProps = { prompt: string; request: string; copied?: boolean; busy?: boolean; onCopy?: () => Promise<string>; onCopyLatest?: () => Promise<string>; onCopied?: (payload: string) => void; onCopyResult?: (result: 'copied' | 'preparation-failed' | 'clipboard-failed') => void }
type CopyResult = { payload: string; source: string; failed: boolean }

export function PromptHandoff({ prompt, copied = false, busy, onCopy, onCopyLatest, onCopied, onCopyResult }: PromptHandoffProps) {
  const observe = (result: 'copied' | 'preparation-failed' | 'clipboard-failed') => { try { onCopyResult?.(result) } catch { /* Optional measurement. */ } }
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
  const copySucceeded = !saving && !saveError && (currentResult ? !currentResult.failed : copied)
  const copy = async (latest = false) => {
    if (busy || saving) return
    let payload = prompt
    setSaving(true); setSaveError('')
    const prepare = latest ? onCopyLatest : onCopy
    if (prepare) {
      try { payload = await prepare() }
      catch (error) { observe('preparation-failed'); setSaveError(error instanceof Error ? error.message : 'Your request could not be saved. Try copying again before leaving this page.'); setSaving(false); return }
    }
    try {
      await navigator.clipboard.writeText(payload)
      setResult({ payload, source: prompt, failed: false })
      observe('copied')
      onCopied?.(payload)
    } catch {
      observe('clipboard-failed')
      setResult({ payload, source: prompt, failed: true })
      setExpanded(true)
      setSource(true)
    } finally { restoreCopyFocus.current = latest; setSaving(false) }
  }
  const preview = currentResult?.payload ?? prompt
  return (
    <section className="handoff" aria-labelledby="handoff-title">
      <div className="handoff-content">
      <h2 id="handoff-title" tabIndex={-1}>Create in your AI chat</h2>
      <p>Paste these instructions into ChatGPT. Bring back the finished ZIP to print.</p>
      <p className="field-hint">Each label may take a few minutes.</p>
      <div className="handoff-actions">
        <button ref={copyButton} className={`button ${copySucceeded ? 'secondary' : 'primary'}`} type="button" disabled={busy || saving} onClick={() => void copy()}><CopyFeedbackIcon copied={copySucceeded} />{saving ? 'Preparing request…' : 'Copy instructions'}</button>
        {copySucceeded && !busy && <a className="button primary" href={chatGPTUrl} target="_blank" rel="noopener noreferrer">Open ChatGPT <span aria-hidden="true">↗</span><span className="visually-hidden"> (opens in a new tab)</span></a>}
      </div>
      {onCopyLatest && <div className="handoff-update"><p>Newer instructions are available for a new chat. Use your saved instructions to continue an existing chat.</p><button type="button" className="button secondary" disabled={busy || saving} onClick={() => void copy(true)}>Copy updated instructions for a new chat</button></div>}
      {saveError && <p role="alert">{saveError}</p>}
      <p className="copy-status" role="status">{currentResult?.failed ? 'Automatic copying did not work. Select and copy the text below.' : copySucceeded ? 'Copied. Open ChatGPT or your preferred AI chat, paste, and send. Return here with the finished ZIP.' : ''}</p>
      </div>
      <div className="handoff-details">
      <details className="prompt-preview">
        <summary>More help</summary>
        <p>Check the packaging photo for each blend in your chat. If it is the one you want, use Copy Image and paste it into the chat. Review each label, then download the finished label ZIP.</p>
        <p>These instructions are designed for ChatGPT. Other AI chats may also work if they can browse the web, inspect and generate images, run code, and return downloadable ZIP files. Your chat runs separately from this page.</p>
        <p>The AI creates and checks each label and may try again to correct problems. Larger requests take longer because labels are made one at a time.</p>
      </details>
      <details className="prompt-preview" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>Read prompt</summary>
        <p className="handoff-inspection-note">Both views show the complete prompt, including your blends, design notes, and instructions for creating, checking, and packaging the labels.</p>
        <div className="prompt-view-switch" role="group" aria-label="Prompt view">
          <button type="button" aria-pressed={!source} onClick={() => setSource(false)}>Preview</button>
          <button type="button" aria-pressed={source} onClick={() => setSource(true)}>Full copied text</button>
        </div>
        {source ? <textarea aria-label="Prompt to copy" readOnly value={preview} rows={18} onFocus={(event) => event.currentTarget.select()} /> :
          <div className="prompt-document" role="region" aria-label="Rendered prompt" tabIndex={0}>
            <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{ pre: ({ children }) => <pre tabIndex={0} role="group" aria-label="Prompt code block">{children}</pre>, img: ({ alt }) => <span>{alt ?? 'Image reference'}</span>, a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> }}>{preview}</Markdown>
          </div>}

      </details>
      </div>
    </section>
  )
}
