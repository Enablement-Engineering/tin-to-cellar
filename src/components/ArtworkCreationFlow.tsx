import { useRef, useState, type ReactNode } from 'react'
import { RowNotes, type PreparationRow } from './PreparationWorkspace'
import '../styles/artwork-creation.css'

export function ArtworkCreationFlow({ rows, copied, generic, handoff, intake, onBack, onNotes }: {
  rows: PreparationRow[]; copied: boolean; generic: boolean
  handoff: ReactNode; intake: ReactNode; onBack: () => void
  onNotes: (id: string, notes: string) => Promise<void>
}) {
  const [importOpen, setImportOpen] = useState(false)
  const returnHeading = useRef<HTMLHeadingElement>(null)
  const openReturn = () => { setImportOpen(true); returnHeading.current?.focus(); returnHeading.current?.scrollIntoView({ block: 'start' }) }
  return <section className="artwork-creation-page screen-only" aria-labelledby="creation-flow-title">
    <button type="button" className="button quiet creation-back" onClick={onBack}>Back to your labels</button>
    <header className="page-heading"><h1 id="creation-flow-title">Create artwork</h1></header>
    {!rows.length && !generic ? <div className="panel"><h2>Choose labels for new artwork</h2><p>Go to your labels and choose which blends need new designs.</p><button className="button primary" onClick={onBack}>Go to your labels</button></div> : <>
      {rows.length > 0 && <section className="panel creation-review" aria-labelledby="creation-review-title">
        <h2 id="creation-review-title">{rows.length} {rows.length === 1 ? 'label' : 'labels'} to create</h2>
        <ul className="creation-review-list" aria-label="Requested artwork">{rows.map(row => <li key={row.id}>
          <div className="creation-request-row"><div><strong>{row.blend}</strong><span>{row.maker}</span>{row.previousDesignId && <small>Previous design saved · left off the print sheet</small>}</div></div>
          <details className="creation-notes"><summary>Design notes{row.notes ? ' · added' : ' · optional'}</summary><RowNotes row={row} onNotes={onNotes} /></details>
        </li>)}</ul>
      </section>}
      <div className="creation-copy-step">{handoff}</div>
    </>}
    <section className="panel creation-return" aria-labelledby="creation-return-title">
      <h2 ref={returnHeading} tabIndex={-1} id="creation-return-title">Bring back your artwork</h2>
      <p>Import the finished label ZIP to review your designs and print.</p>
      {importOpen || copied ? intake : <button className="button secondary" onClick={openReturn}>I already have a finished ZIP</button>}
    </section>
  </section>
}
