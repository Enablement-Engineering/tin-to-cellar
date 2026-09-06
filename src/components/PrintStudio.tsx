import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { LabelArtwork } from './LabelArtwork'
import { Icon } from './Icons'
import type { PrintLabel, PrintSettings } from './ui-model'
import { AVERY_94502_PROFILE } from '../lib/sheets'

type PrintStudioProps = {
  labels: PrintLabel[]
  quantities: Record<string, number>
  onQuantityChange: (id: string, value: number) => void
  settings: PrintSettings
  onSettingsChange: (settings: PrintSettings) => void
  intake?: ReactNode
}

export function PrintStudio({ labels, quantities, onQuantityChange, settings, onSettingsChange, intake }: PrintStudioProps) {
  const { page, firstSlot, offset } = settings
  const setPage = (page: number) => onSettingsChange({ ...settings, page })
  const setFirstSlot = (firstSlot: number) => onSettingsChange({ ...settings, firstSlot })
  const setOffset = (offset: PrintSettings['offset']) => onSettingsChange({ ...settings, offset })
  const copies = labels.flatMap((label) => Array.from({ length: quantities[label.id] ?? 1 }, () => label))
  const maxFor = (id: string) => Math.min(99, Math.max(0, 450 - copies.length + (quantities[id] ?? 1)))
  const instances: Array<PrintLabel | null> = [...Array.from({ length: firstSlot - 1 }, () => null), ...copies]
  const pageCount = Math.max(1, Math.ceil(instances.length / 9))
  const currentPage = Math.min(page, pageCount - 1)
  const offsetStyle = { '--offset-x': `${offset.x}in`, '--offset-y': `${offset.y}in` } as CSSProperties
  useEffect(() => {
    const prepare = () => {
      if (!document.body.dataset.printMode && copies.length > 0) document.body.dataset.printMode = 'labels'
    }
    const reset = () => { delete document.body.dataset.printMode }
    window.addEventListener('beforeprint', prepare)
    window.addEventListener('afterprint', reset)
    return () => {
      window.removeEventListener('beforeprint', prepare)
      window.removeEventListener('afterprint', reset)
      reset()
    }
  }, [copies.length])
  const print = (mode: 'labels' | 'calibration') => {
    document.body.dataset.printMode = mode
    window.print()
  }
  const position = (slot: typeof AVERY_94502_PROFILE.slots[number], preview = false): CSSProperties => ({
    left: preview ? `${(slot.x + offset.x) / 8.5 * 100}%` : `${slot.x}in`,
    top: preview ? `${(slot.y + offset.y) / 11 * 100}%` : `${slot.y}in`,
    width: preview ? `${slot.width / 8.5 * 100}%` : `${slot.width}in`,
    height: preview ? `${slot.height / 11 * 100}%` : `${slot.height}in`,
  })
  return (
    <section className="simple-print" aria-label="Print labels">
      <div className="print-job screen-only">
        <div className="print-sidebar">
        {intake}
        <div className="panel quantity-panel">
          <h2 tabIndex={-1}>Your labels</h2><p>Choose how many of each to print. Set a quantity to zero to leave it out.</p>
          {labels.map((label) => <div className="quantity-row" key={label.id}>
            <div className="label-thumbnail"><LabelArtwork label={label} /></div>
            <div><strong>{label.blend}</strong><small>{label.maker}</small></div>
            <div className="quantity-control">
              <button type="button" aria-label={`Fewer ${label.blend}`} disabled={(quantities[label.id] ?? 1) === 0} onClick={() => onQuantityChange(label.id, (quantities[label.id] ?? 1) - 1)}>−</button>
              <input aria-label={`Quantity for ${label.blend}`} type="number" min="0" max={maxFor(label.id)} value={quantities[label.id] ?? 1} onChange={(event) => onQuantityChange(label.id, Math.max(0, Math.min(maxFor(label.id), Math.floor(Number(event.target.value) || 0))))} />
              <button type="button" aria-label={`More ${label.blend}`} disabled={(quantities[label.id] ?? 1) >= maxFor(label.id)} onClick={() => onQuantityChange(label.id, (quantities[label.id] ?? 1) + 1)}>+</button>
            </div>
          </div>)}
          {copies.length >= 450 && <p className="field-hint">This batch has 450 labels, the limit for one print job. Reduce some quantities to add others.</p>}
          <details className="alignment-options"><summary>Paper and alignment</summary>
            <p>Avery 94502 · US Letter · 2.5-inch circles</p>
            <label>Start at slot <select aria-describedby="slot-hint" aria-label="Start at slot" value={firstSlot} onChange={(event) => setFirstSlot(Number(event.target.value))}>{Array.from({ length: 9 }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>
            <p className="field-hint" id="slot-hint">Slots run left to right, then down. Use this for a partly used first sheet.</p>
            <div className="offset-grid">{(['x', 'y'] as const).map((axis) => <label key={axis}>{axis === 'x' ? 'Horizontal' : 'Vertical'} adjustment (in)<input aria-describedby="offset-hint" aria-label={`${axis === 'x' ? 'Horizontal' : 'Vertical'} adjustment`} type="number" min="-0.25" max="0.25" step="0.01" value={offset[axis]} onChange={(event) => setOffset({ ...offset, [axis]: Math.max(-0.25, Math.min(0.25, Number(event.target.value) || 0)) })} /></label>)}</div>
            <p className="field-hint" id="offset-hint">Positive values move labels right or down. Negative values move them left or up.</p>
            <button className="button secondary" type="button" onClick={() => print('calibration')}><Icon name="guide" size={17} />Print alignment sheet</button>
            <p className="field-hint">Print on plain paper at Actual Size. The ruler should measure two inches. Hold it behind your label stock to check the nine circles.</p>
          </details>
          <div className="print-action"><button className="button primary" disabled={!copies.length} type="button" onClick={() => print('labels')}><Icon name="print" />Print {copies.length} {copies.length === 1 ? 'label' : 'labels'}</button><p>Choose US Letter and Actual Size or 100% scale. Turn off headers and footers. To save a PDF, choose Save as PDF.</p></div>
        </div>
        </div>
        <div className="sheet-stage">
          <div className="sheet-meta"><span role="status">{copies.length} {copies.length === 1 ? 'label' : 'labels'} · {copies.length ? pageCount : 0} {copies.length && pageCount === 1 ? 'sheet' : 'sheets'}</span><span>Avery 94502</span></div>
          {pageCount > 1 && <div className="page-controls"><button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>Previous sheet</button><span>Sheet {currentPage + 1} of {pageCount}</span><button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount - 1}>Next sheet</button></div>}
          <p className="visually-hidden" role="status">Preview sheet {currentPage + 1} of {pageCount}</p>
          <div className="avery-sheet simple-sheet" role="region" aria-label={`Preview sheet ${currentPage + 1}`}>
            {AVERY_94502_PROFILE.slots.map((slot, index) => {
              const label = instances[currentPage * 9 + index]
              return <div className="preview-slot" role="img" aria-label={`Slot ${index + 1}: ${label ? `${label.maker} — ${label.blend}` : 'empty'}`} key={index} style={position(slot, true)}>{label ? <LabelArtwork label={label} /> : <span className="empty-preview">{index + 1}</span>}</div>
            })}
          </div>
        </div>
      </div>
      <div className="calibration-print" style={offsetStyle} aria-hidden="true">
        <p className="proof-title">Tin to Cellar · Avery 94502 · Actual Size / 100%</p>
        <div className="calibration-print-ruler"><span>0</span><span>2 inches</span></div>
        <div className="print-coordinate-layer">{AVERY_94502_PROFILE.slots.map((slot, index) => <div className="proof-slot" key={index} style={position(slot)}><span>{index + 1}</span></div>)}</div>
      </div>
      <div className="production-pages" style={offsetStyle}>
        {copies.length > 0 && Array.from({ length: pageCount }, (_, pageIndex) => <div className="production-page" key={pageIndex}><div className="print-coordinate-layer">{AVERY_94502_PROFILE.slots.map((slot, index) => {
          const label = instances[pageIndex * 9 + index]
          return <div className="production-slot" key={index} style={position(slot)}>{label && <LabelArtwork label={label} />}</div>
        })}</div></div>)}
      </div>
    </section>
  )
}
