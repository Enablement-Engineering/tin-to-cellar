import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { LabelArtwork } from './LabelArtwork'
import { Icon } from './Icons'
import type { PrintLabel, PrintSettings } from './ui-model'
import { AVERY_94502_PROFILE } from '../lib/sheets/profiles'
import { fixedSlotPosition, paginateFixedSheet } from '../lib/sheets/fixed-layout'

export type PrintSettingsPatch = Partial<Omit<PrintSettings, 'offset'>> & { offset?: Partial<PrintSettings['offset']> }

type PrintStudioProps = {
  labels: PrintLabel[]
  quantities: Record<string, number>
  onQuantityChange: (id: string, value: number | { delta: number }) => void
  settings: PrintSettings
  onSettingsChange: (settings: PrintSettingsPatch) => void
  saving?: boolean
  intake?: ReactNode
}

export function PrintStudio({ labels, quantities, onQuantityChange, settings, onSettingsChange, saving = false, intake }: PrintStudioProps) {
  const { page, firstSlot, offset } = settings
  const setPage = (page: number) => onSettingsChange({ page })
  const setFirstSlot = (firstSlot: number) => onSettingsChange({ firstSlot })
  const setOffset = (offset: Partial<PrintSettings['offset']>) => onSettingsChange({ offset })
  const copies = labels.flatMap((label) => Array.from({ length: quantities[label.id] ?? 1 }, () => label))
  const maxFor = (id: string) => Math.min(99, Math.max(0, 450 - copies.length + (quantities[id] ?? 1)))
  const profile = AVERY_94502_PROFILE
  const pages = paginateFixedSheet(copies, firstSlot, profile)
  const pageCount = pages.length
  const sheetStyle = { width: `${profile.page.width}${profile.page.unit}`, height: `${profile.page.height}${profile.page.unit}` }
  const currentPage = Math.min(page, pageCount - 1)
  const offsetStyle = { '--offset-x': `${offset.x}in`, '--offset-y': `${offset.y}in` } as CSSProperties
  useEffect(() => {
    const prepare = () => {
      if (saving) { document.body.dataset.printMode = 'pending'; return }
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
  }, [copies.length, saving])
  const print = (mode: 'labels' | 'calibration') => {
    if (saving) return
    document.body.dataset.printMode = mode
    window.print()
  }
  const position = (slot: typeof profile.slots[number], preview = false): CSSProperties =>
    fixedSlotPosition(profile, slot, preview ? offset : undefined)
  return (
    <section className="simple-print" aria-label="Print labels">
      <div className="print-job-actions screen-only" aria-label="Print job actions">
        <p role="status">{saving ? 'Saving print changes…' : `${copies.length} ${copies.length === 1 ? 'label' : 'labels'} · ${copies.length ? pageCount : 0} ${pageCount === 1 && copies.length ? 'sheet' : 'sheets'}`}</p>
        <button className="button primary" disabled={saving || !copies.length} type="button" onClick={() => print('labels')}><Icon name="print" />Print {copies.length} {copies.length === 1 ? 'label' : 'labels'}</button>
      </div>
      <p className="pending-print-notice">Print changes are still saving. Close this dialog and print again when saving finishes.</p>
      <div className="print-job screen-only">
        <div className="print-sidebar">
        {intake}
        <div className="panel quantity-panel">
          <h2 tabIndex={-1}>Your labels</h2><p>Choose how many of each to print. Set a quantity to zero to leave it out.</p>
          {labels.map((label) => <div className="quantity-row" key={label.id}>
            <div className="label-thumbnail"><LabelArtwork label={label} /></div>
            <div><strong>{label.blend}</strong><small>{label.maker}</small></div>
            <div className="quantity-control">
              <button type="button" aria-label={`Fewer ${label.blend}`} disabled={(quantities[label.id] ?? 1) === 0} onClick={() => onQuantityChange(label.id, { delta: -1 })}>−</button>
              <input aria-label={`Quantity for ${label.blend}`} type="number" min="0" max={maxFor(label.id)} value={quantities[label.id] ?? 1} onChange={(event) => onQuantityChange(label.id, Math.max(0, Math.min(maxFor(label.id), Math.floor(Number(event.target.value) || 0))))} />
              <button type="button" aria-label={`More ${label.blend}`} disabled={(quantities[label.id] ?? 1) >= maxFor(label.id)} onClick={() => onQuantityChange(label.id, { delta: 1 })}>+</button>
            </div>
          </div>)}
          {copies.length >= 450 && <p className="field-hint">This batch has 450 labels, the limit for one print job. Reduce some quantities to add others.</p>}
          <details className="alignment-options"><summary>Paper and alignment</summary>
            <p>Avery 94502 · US Letter · 2.5-inch circles</p>
            <label>Start at slot <select aria-describedby="slot-hint" aria-label="Start at slot" value={firstSlot} onChange={(event) => setFirstSlot(Number(event.target.value))}>{Array.from({ length: profile.slots.length }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>
            <p className="field-hint" id="slot-hint">Slots run left to right, then down. Use this for a partly used first sheet.</p>
            <div className="offset-grid">{(['x', 'y'] as const).map((axis) => <label key={axis}>{axis === 'x' ? 'Horizontal' : 'Vertical'} adjustment (in)<input aria-describedby="offset-hint" aria-label={`${axis === 'x' ? 'Horizontal' : 'Vertical'} adjustment`} type="number" min="-0.25" max="0.25" step="0.01" value={offset[axis]} onChange={(event) => setOffset({ [axis]: Math.max(-0.25, Math.min(0.25, Number(event.target.value) || 0)) })} /></label>)}</div>
            <p className="field-hint" id="offset-hint">Positive values move labels right or down. Negative values move them left or up.</p>
            <button className="button secondary" type="button" disabled={saving} onClick={() => print('calibration')}><Icon name="guide" size={17} />Print alignment sheet</button>
            <p className="field-hint">Print on plain paper at Actual Size. The ruler should measure two inches. Hold it behind your label stock to check the nine circles.</p>
          </details>
          <p className="field-hint">Choose US Letter, no margins, and Actual Size / 100%. Turn off headers and footers. Use Paper and alignment to check a plain-paper sheet first. To save a PDF, choose Save as PDF.</p>
        </div>
        </div>
        <div className="sheet-stage">
          <div className="sheet-meta"><span role="status">{copies.length} {copies.length === 1 ? 'label' : 'labels'} · {copies.length ? pageCount : 0} {copies.length && pageCount === 1 ? 'sheet' : 'sheets'}</span><span>Avery 94502</span></div>
          {pageCount > 1 && <div className="page-controls"><button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>Previous sheet</button><span>Sheet {currentPage + 1} of {pageCount}</span><button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount - 1}>Next sheet</button></div>}
          <p className="visually-hidden" role="status">Preview sheet {currentPage + 1} of {pageCount}</p>
          <div className="avery-sheet simple-sheet" style={{ aspectRatio: `${profile.page.width} / ${profile.page.height}` }} role="region" aria-label={`Preview sheet ${currentPage + 1}`}>
            {profile.slots.map((slot, index) => {
              const label = pages[currentPage][index]
              return <div className="preview-slot" role="img" aria-label={`Slot ${index + 1}: ${label ? `${label.maker} — ${label.blend}` : 'empty'}`} key={index} style={position(slot, true)}>{label ? <LabelArtwork label={label} /> : <span className="empty-preview">{index + 1}</span>}</div>
            })}
          </div>
        </div>
      </div>
      <div className="calibration-print" style={{ ...sheetStyle, ...offsetStyle }} aria-hidden="true">
        <p className="proof-title">Tin to Cellar · Avery 94502 · Actual Size / 100%</p>
        <div className="calibration-print-ruler"><span>0</span><span>2 inches</span></div>
        <div className="print-coordinate-layer">{profile.slots.map((slot, index) => <div className="proof-slot" key={index} style={position(slot)}><span>{index + 1}</span></div>)}</div>
      </div>
      <div className="production-pages" style={offsetStyle}>
        {copies.length > 0 && Array.from({ length: pageCount }, (_, pageIndex) => <div className="production-page" style={sheetStyle} key={pageIndex}><div className="print-coordinate-layer">{profile.slots.map((slot, index) => {
          const label = pages[pageIndex][index]
          return <div className="production-slot" key={index} style={position(slot)}>{label && <LabelArtwork label={label} />}</div>
        })}</div></div>)}
      </div>
    </section>
  )
}
