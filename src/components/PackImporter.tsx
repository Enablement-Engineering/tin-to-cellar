import { useRef, useState, type DragEvent } from 'react'
import { Icon } from './Icons'
import type { ImportSummary } from './ui-model'

type PackImporterProps = {
  busy: boolean
  summary: ImportSummary | null
  onFile: (file: File) => Promise<void>
}

export function PackImporter({ busy, summary, onFile }: PackImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const acceptFile = async (file?: File) => {
    if (!file) return
    await onFile(file)
  }

  const drop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    await acceptFile(event.dataTransfer.files[0])
  }

  return (
    <section className="panel importer" aria-labelledby="import-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Local import</p>
          <h2 id="import-title">Bring back a CellarPack</h2>
        </div>
        <span className="local-chip"><Icon name="lock" size={14} /> Stays here</span>
      </div>

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
          accept=".zip,.cellarpack.zip,application/zip"
          onChange={(event) => void acceptFile(event.target.files?.[0])}
        />
        <span className="drop-icon"><Icon name="upload" size={28} /></span>
        <strong>{busy ? 'Inspecting the pack…' : 'Drop a .cellarpack.zip here'}</strong>
        <span>or choose it from this device</span>
        <button className="button secondary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          Choose CellarPack
        </button>
        <small>No upload. No source links are opened automatically.</small>
      </div>

      {!summary && (
        <div className="return-checklist">
          <p>What comes back from your agent</p>
          <ul>
            <li>Generated PNG artwork</li>
            <li>Physical label geometry</li>
            <li>Research sources and adaptation notes</li>
          </ul>
        </div>
      )}

      {summary && (
        <div className={`import-report status-${summary.status}`} aria-live="polite">
          <div className="report-topline">
            <div>
              <p>{summary.status === 'ready' ? 'Ready for the bench' : summary.status === 'partial' ? 'Usable with repairs' : 'Pack rejected'}</p>
              <h3>{summary.title}</h3>
            </div>
            <span>{summary.labels.length} usable</span>
          </div>

          {summary.issues.length > 0 && (
            <details open={summary.status === 'rejected'}>
              <summary>{summary.issues.length} validation {summary.issues.length === 1 ? 'issue' : 'issues'}</summary>
              <ul>{summary.issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul>
            </details>
          )}

          {summary.quarantined.length > 0 && (
            <div className="quarantine-note">
              <strong>{summary.quarantined.length} label {summary.quarantined.length === 1 ? 'was' : 'were'} kept off the sheet</strong>
              <ul>
                {summary.quarantined.map((label) => <li key={label.id}>{label.id}: {label.reason}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
