import { useState } from 'react'
import type { CollectionDesign, ImportReceipt } from '../lib/collection/types'
import { formatTobacco } from '../lib/tobacco-catalog'
import { ImportReport } from './PackImporter'
import { ProtocolWarning } from './ProtocolWarning'
import { CopyFeedbackIcon } from './Icons'

export function ReceiptReport({ receipt }: { receipt: ImportReceipt }) {
  const [copyStatus, setCopyStatus] = useState('')
  const [copied, setCopied] = useState(false)
  const [showRepair, setShowRepair] = useState(false)
  const issues = receipt.issues.filter(issue => issue.code !== 'MISSING_PREVIEW')
  const needsRepair = receipt.repairPrompt || receipt.quarantined.length || issues.some(issue => issue.severity === 'error' || issue.severity === 'fatal')
  const copyRepair = async () => {
    setCopied(false)
    try {
      await navigator.clipboard.writeText(receipt.repairPrompt)
      setCopied(true)
      setCopyStatus('Copied. Paste this into the same AI chat, then add the corrected ZIP.')
    } catch {
      setShowRepair(true)
      setCopyStatus('Select and copy the repair request below, then paste it into the same chat.')
    }
  }
  return <div className="receipt-report">
    <ImportReport historical showReady summary={{
      title: receipt.title, status: needsRepair ? 'partial' : 'ready', labels: [],
      issues: issues.map(issue => [issue.message, issue.recovery].filter(Boolean).join(' ')),
      quarantined: receipt.quarantined,
    }} />
    <ProtocolWarning context={receipt.protocolContext} feedback={receipt.contribution?.feedback} compact />
    {receipt.repairPrompt && <div className="repair-panel import-repair">
      <p>Request corrections in the AI chat that made this ZIP, then import the corrected file.</p>
      <button className="button secondary" type="button" onClick={() => void copyRepair()}><CopyFeedbackIcon copied={copied} />Copy repair request</button>
      <p className="copy-status" role="status">{copyStatus}</p>
      {showRepair && <textarea aria-label="Repair request" readOnly value={receipt.repairPrompt} rows={8} onFocus={event => event.currentTarget.select()} />}
    </div>}
  </div>
}

export function ImportHistory({ receipts, designs }: { receipts: ImportReceipt[]; designs: Record<string, CollectionDesign> }) {
  const [receiptId, setReceiptId] = useState('')
  const receipt = receipts.find(item => item.id === receiptId) ?? receipts.at(-1)
  if (!receipt) return null
  return <details className="import-history">
    <summary>Import history</summary>
    <div className="import-history-content">
      <label>Previous import<select value={receipt.id} onChange={event => setReceiptId(event.target.value)}>
        {receipts.map((item, index) => {
          const blends = [...new Set(Object.values(designs).filter(design => design.receiptId === item.id).map(design => formatTobacco(design.item.label)))]
          const name = blends.length ? blends.slice(0, 2).join(', ') + (blends.length > 2 ? ` + ${blends.length - 2} more` : '') : item.title
          return <option key={item.id} value={item.id}>{index + 1}. {name}</option>
        })}
      </select></label>
      <p className="field-hint">Imported <time dateTime={receipt.createdAt}>{new Date(receipt.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></p>
      <ReceiptReport key={receipt.id} receipt={receipt} />
    </div>
  </details>
}
