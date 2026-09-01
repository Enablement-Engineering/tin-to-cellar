import { useState } from 'react'
import { Icon } from './Icons'

type PromptHandoffProps = {
  prompt: string
  codexPrompt: string
  chatGptUrl: string
  hasPlannedFiles: boolean
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
}

export function PromptHandoff({ prompt, codexPrompt, chatGptUrl, hasPlannedFiles }: PromptHandoffProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const longUrl = chatGptUrl.length > 7000

  const copy = async (label: string, value: string) => {
    try {
      await copyText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      setCopied('Copy failed — select the prompt below')
    }
  }

  return (
    <section className="panel handoff" aria-labelledby="handoff-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Agent handoff</p>
          <h2 id="handoff-title">Take the brief to your agent</h2>
        </div>
        <span className="local-chip"><Icon name="lock" size={14} /> Prompt only</span>
      </div>

      <p className="panel-intro">
        The agent will inspect real package art before generating, integrate a light writing surface, and return a CellarPack for this studio.
      </p>

      {hasPlannedFiles && (
        <div className="handoff-warning" role="note">
          <strong>Attachments stay behind.</strong> The prompt will ask you to add your named files after ChatGPT opens.
        </div>
      )}

      {longUrl && (
        <div className="handoff-warning" role="alert">
          This brief makes an unusually long link. Copy the prompt instead to avoid browser truncation.
        </div>
      )}

      <div className="handoff-actions">
        <a className="button primary" href={chatGptUrl} target="_blank" rel="noreferrer">
          <Icon name="spark" /> Create in ChatGPT
        </a>
        <button className="button secondary" type="button" onClick={() => copy('Prompt copied', prompt)}>
          <Icon name="copy" /> Copy prompt
        </button>
        <button className="button quiet" type="button" onClick={() => copy('Codex prompt copied', codexPrompt)}>
          Copy for Codex
        </button>
      </div>

      <div aria-live="polite" className="copy-status">{copied ?? '\u00A0'}</div>

      <div className="prompt-preview">
        <div className="prompt-preview-heading">
          <span>Exact prompt</span>
          <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
            {expanded ? 'Collapse' : 'Read full prompt'}
          </button>
        </div>
        <pre className={expanded ? 'is-expanded' : ''} tabIndex={0}>{prompt}</pre>
      </div>
    </section>
  )
}
