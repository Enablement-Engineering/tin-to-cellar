import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Icon } from './Icons'
import type { ImportSummary } from './ui-model'

type PackImporterProps = {
  busy: boolean
  summary: ImportSummary | null
  onFile: (file: File) => Promise<void>
  compact?: boolean
  history?: ReactNode
}

export function PackImporter({ busy, summary, onFile, compact = false, history }: PackImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const acceptFile = async (file?: File) => {
    if (!file) return
    if (busy) return
    await onFile(file)
  }

  const drop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    await acceptFile(event.dataTransfer.files[0])
  }

  return (
    <section className={compact ? 'importer importer-compact' : 'panel importer'} aria-labelledby={compact ? undefined : 'import-title'} aria-label={compact ? 'Finished artwork ZIP' : undefined}>
      {!compact && <><div className="panel-heading">
        <div>
          <h2 id="import-title">Add artwork</h2>
        </div>
      </div>

      <p className="field-hint">Choose a CellarPack, the label ZIP from your AI chat or a previous download. Review additions and replacements before saving.</p></>}

      <div
        className={`drop-zone ${dragging ? 'is-dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        <input
          ref={inputRef}
          type="file"
          tabIndex={-1}
          aria-label="Label ZIP"
          disabled={busy}
          accept=".zip,.cellarpack.zip,application/zip"
          onChange={(event) => { void acceptFile(event.target.files?.[0]); event.target.value = '' }}
        />
        <span className="drop-icon"><Icon name="upload" size={28} /></span>
        <strong>{busy ? 'Checking your labels…' : 'Drop your label ZIP here'}</strong>
        <span>or choose it from this device</span>
        <button className={`button ${compact ? 'primary' : 'secondary'}`} type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {compact ? 'Choose finished ZIP' : 'Choose ZIP'}
        </button>
      </div>

      <p className="import-privacy"><Icon name="lock" size={15} />Your ZIP and artwork stay on this device. Importing automatically shares structured AI feedback, file-check results, and eligible public packaging links. Those links may be suggested to other users. Process notes are shared only when you choose. If you enable optional usage measurement, import outcomes and locally matched request milestones can also be counted. <a href="/privacy">Privacy and data choices</a></p>


      <ImportReport summary={summary} />
      {history}
    </section>
  )
}

export function ImportReport({ summary, showReady = false, historical = false }: { summary: ImportSummary | null; showReady?: boolean; historical?: boolean }) {
  return <>
      {summary && (showReady || summary.status !== 'ready' || summary.issues.length > 0 || summary.quarantined.length > 0) && (
        <div className={`import-report status-${summary.status}${historical ? ' import-report-historical' : ''}`}>
          <div className="report-topline">
            {historical && <span className="report-status-icon"><Icon name={summary.status === 'ready' ? 'check' : 'alert'} size={18} /></span>}
            <div>
              <p>{historical ? summary.status === 'ready' ? 'File checks passed' : 'File checks need attention' : summary.status === 'ready' ? 'Labels ready to print' : summary.status === 'partial' ? 'Some labels need repair' : 'ZIP needs repair'}</p>
              <h3>{summary.title}</h3>
            </div>
            {!historical && <span>{summary.labels.length} {summary.labels.length === 1 ? 'label' : 'labels'} ready</span>}
          </div>

          {summary.issues.length > 0 && (
            <details open={historical || summary.status === 'rejected'}>
              <summary>{summary.issues.length} {summary.issues.length === 1 ? 'issue' : 'issues'} to review</summary>
              <ul>{summary.issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul>
            </details>
          )}

          {summary.quarantined.length > 0 && (
            <div className="quarantine-note">
              <strong>{summary.quarantined.length} {summary.quarantined.length === 1 ? 'label was' : 'labels were'} {historical ? 'excluded from this import' : 'left off the sheet'}</strong>
              <ul>
                {summary.quarantined.map((label) => <li key={label.id}>{label.id}: {label.reason}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
  </>
}
