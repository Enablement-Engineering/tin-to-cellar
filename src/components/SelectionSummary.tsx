import type { ReactNode } from 'react'

export function SelectionSummary({ selectedCount, readyCount, creationCount = 0, onView, onPrint, busy, children }: {
  selectedCount: number; readyCount: number; creationCount?: number; onView?: () => void; onPrint?: () => void; busy?: boolean; children?: ReactNode
}) {
  return <div className="preparation-summary review-navigation" aria-label="Selection summary">
    <p role="status" aria-atomic="true"><strong>{creationCount ? `${creationCount} selected for creation` : `${selectedCount} selected`}</strong> · {readyCount} ready to print · {Math.max(0, selectedCount - readyCount)} need artwork</p>
    <div className="selection-actions">
      {onView && <button type="button" className="button secondary" onClick={onView}>View your labels</button>}
      {children}
      {readyCount > 0 && onPrint && <button type="button" className={`button ${children ? 'secondary' : 'primary'}`} disabled={busy} onClick={onPrint}>Review &amp; print</button>}
    </div>
  </div>
}
