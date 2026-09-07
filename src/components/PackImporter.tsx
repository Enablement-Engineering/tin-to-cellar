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
    if (busy) return
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
          <h2 id="import-title">Add artwork</h2>
        </div>
      </div>

      <p className="field-hint">Add finished artwork to your labels. You’ll review additions and any replacements before saving.</p>

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
        <button className="button secondary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          Choose ZIP
        </button>
      </div>

      <p className="import-privacy"><Icon name="lock" size={15} />Importing automatically shares structured AI feedback, ZIP-check results, and eligible package-source links. Those links may appear in public source suggestions. This does not share your artwork. Process notes require a separate sharing action. <a href="/privacy">Privacy details</a></p>


      {summary && (summary.status !== 'ready' || summary.issues.length > 0 || summary.quarantined.length > 0) && (
        <div className={`import-report status-${summary.status}`}>
          <div className="report-topline">
            <div>
              <p>{summary.status === 'ready' ? 'Labels ready to print' : summary.status === 'partial' ? 'Some labels need repair' : 'ZIP needs repair'}</p>
              <h3>{summary.title}</h3>
            </div>
            <span>{summary.labels.length} {summary.labels.length === 1 ? 'label' : 'labels'} ready</span>
          </div>

          {summary.issues.length > 0 && (
            <details open={summary.status === 'rejected'}>
              <summary>{summary.issues.length} {summary.issues.length === 1 ? 'issue' : 'issues'} to review</summary>
              <ul>{summary.issues.map((issue, index) => <li key={`${issue}-${index}`}>{issue}</li>)}</ul>
            </details>
          )}

          {summary.quarantined.length > 0 && (
            <div className="quarantine-note">
              <strong>{summary.quarantined.length} {summary.quarantined.length === 1 ? 'label was' : 'labels were'} left off the sheet</strong>
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
