import type { ReactNode } from 'react'
import { useResponsiveDockAnimation } from '../hooks/useResponsiveDockAnimation'

export function SelectionSummary({ selectedCount, readyCount, creationCount = 0, onView, onPrint, busy, children, animateDock = false }: {
  selectedCount: number; readyCount: number; creationCount?: number; onView?: () => void; onPrint?: () => void; busy?: boolean; children?: ReactNode
  animateDock?: boolean
}) {
  const ref = useResponsiveDockAnimation(animateDock)
  return <div ref={ref} className="preparation-summary review-navigation" aria-label="Selection summary">
    <p role="status" aria-atomic="true"><strong>{selectedCount} selected</strong> · {readyCount} ready to print{creationCount > 0 && <> · {creationCount} to create with AI</>}{selectedCount > readyCount + creationCount && <> · {selectedCount - readyCount - creationCount} need artwork</>}</p>
    <div className="selection-actions">
      {onView && <button type="button" className="button secondary" onClick={onView}>View your labels</button>}
      {children}
      {readyCount > 0 && onPrint && <button type="button" className={`button ${children ? 'secondary' : 'primary'}`} disabled={busy} onClick={onPrint}>Review &amp; print</button>}
    </div>
  </div>
}
