import type { Collection } from '../lib/collection'

/** A saved request is still a selection, even before it has printable artwork. */
export function SavedPrintSelection({ rows, previewUnavailable, onChoose }: {
  rows: Collection['rows']
  previewUnavailable: boolean
  onChoose: () => void
}) {
  return <section className="panel saved-print-selection screen-only" aria-labelledby="saved-print-selection-title">
    <h2 id="saved-print-selection-title" tabIndex={-1}>Your saved selection</h2>
    <p>{rows.length} {rows.length === 1 ? 'label is' : 'labels are'} saved. {previewUnavailable ? 'The print preview is unavailable. Reload to try again.' : 'Choose artwork for these blends before printing, or import a finished label ZIP.'}</p>
    <ul>{rows.map(row => <li key={row.id}><div><strong>{row.blend}</strong>{row.maker && <small>{row.maker}</small>}</div><span className="field-hint">{row.designId ? 'Artwork saved' : row.previousDesignId ? 'Needs new artwork · previous design saved' : 'Needs artwork'}</span></li>)}</ul>
    <div className="handoff-actions">
      {previewUnavailable && <button type="button" className="button primary" onClick={() => window.location.reload()}>Reload preview</button>}
      <button type="button" className={`button ${previewUnavailable ? 'secondary' : 'primary'}`} onClick={onChoose}>Choose artwork</button>
    </div>
  </section>
}
