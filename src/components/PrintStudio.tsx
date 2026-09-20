import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { LabelArtwork } from './LabelArtwork'
import { Icon } from './Icons'
import type { PrintLabel, PrintSettings } from './ui-model'
import { AVERY_94502_PROFILE, getPrintSheetProfile, PRINT_SHEET_PROFILES } from '../lib/sheets/profiles'
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
  onPrintRequested?: () => void
}

export function PrintStudio({ labels, quantities, onQuantityChange, settings, onSettingsChange, saving = false, intake, onPrintRequested }: PrintStudioProps) {
  const { page, firstSlot, offset } = settings
  const setPage = (page: number) => onSettingsChange({ page })
  const setFirstSlot = (firstSlot: number) => onSettingsChange({ firstSlot })
  const setOffset = (offset: Partial<PrintSettings['offset']>) => onSettingsChange({ offset })
  const copies = labels.flatMap((label) => Array.from({ length: quantities[label.id] ?? 1 }, () => label))
  const maxFor = (id: string) => Math.min(99, Math.max(0, 450 - copies.length + (quantities[id] ?? 1)))
  const profile = getPrintSheetProfile(settings.sheetProfileId) ?? AVERY_94502_PROFILE
  const metric = profile.page.unit === 'mm'
  const paperName = metric ? 'A4' : 'US Letter'
  // Saved offsets stay in inches; preview coordinates use the selected profile's unit.
  const unitsPerInch = metric ? 25.4 : 1
  const previewOffset = { x: offset.x * unitsPerInch, y: offset.y * unitsPerInch }
  const changePaper = (sheetProfileId: string) => onSettingsChange({ sheetProfileId, page: 0, firstSlot: 1, offset: { x: 0, y: 0 } })
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
    if (mode === 'labels') {
      try { onPrintRequested?.() } catch { /* Optional counts must not prevent printing. */ }
    }
    window.print()
  }
  const position = (slot: typeof profile.slots[number], preview = false): CSSProperties =>
    fixedSlotPosition(profile, slot, preview ? previewOffset : undefined)
  return (
    <section className="simple-print" aria-label="Print labels">
      <style>{`@page { size: ${profile.page.width}${profile.page.unit} ${profile.page.height}${profile.page.unit}; margin: 0; }`}</style>
      <div className="print-job-actions screen-only" aria-label="Print job actions">
        <p role="status">{saving ? 'Saving print changes…' : `${copies.length} ${copies.length === 1 ? 'label' : 'labels'} · ${copies.length ? pageCount : 0} ${pageCount === 1 && copies.length ? 'sheet' : 'sheets'}`}</p>
        <button className="button primary" disabled={saving || !copies.length} type="button" onClick={() => print('labels')}><Icon name="print" />Print {copies.length} {copies.length === 1 ? 'label' : 'labels'}</button>
      </div>
      <p className="pending-print-notice">Print changes are still saving. Close this dialog and print again when saving finishes.</p>
      <div className="print-job screen-only">
        <div className="print-sidebar">
        {intake}
        <div className="panel quantity-panel">
          <h2 tabIndex={-1}>Your labels</h2><p>Set the number of copies for each design. Use zero to leave a label off this print job.</p>
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
          <label className="field print-paper-field">Label paper <select aria-label="Label paper" aria-describedby="paper-hint" value={profile.id} onChange={event => changePaper(event.target.value)}>{PRINT_SHEET_PROFILES.map(stock => <option key={stock.id} value={stock.id}>{stock.name}</option>)}</select></label>
          <p className="field-hint" id="paper-hint">Match the product code on your pack. Both options use 63.5 mm (2.5-inch) circles. Changing paper resets the starting slot and alignment.</p>
          <details className="alignment-options"><summary>Paper and alignment</summary>
            <label>Start at slot <select aria-describedby="slot-hint" aria-label="Start at slot" value={firstSlot} onChange={(event) => setFirstSlot(Number(event.target.value))}>{Array.from({ length: profile.slots.length }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>
            <p className="field-hint" id="slot-hint">For a partly used sheet, choose the first unused slot. Slots run left to right, then down.</p>
            <div className="offset-grid">{(['x', 'y'] as const).map((axis) => <label key={axis}>{axis === 'x' ? 'Horizontal' : 'Vertical'} adjustment ({metric ? 'mm' : 'in'})<input aria-describedby="offset-hint" aria-label={`${axis === 'x' ? 'Horizontal' : 'Vertical'} adjustment`} type="number" min={metric ? -6.35 : -0.25} max={metric ? 6.35 : 0.25} step="0.01" value={Number((offset[axis] * unitsPerInch).toFixed(4))} onChange={(event) => setOffset({ [axis]: Math.max(-0.25, Math.min(0.25, (Number(event.target.value) || 0) / unitsPerInch)) })} /></label>)}</div>
            <p className="field-hint" id="offset-hint">Positive values move labels right or down. Negative values move them left or up.</p>
            <button className="button secondary" type="button" disabled={saving} onClick={() => print('calibration')}><Icon name="guide" size={17} />Print alignment sheet</button>
            <p className="field-hint">Print a test on plain paper at Actual Size / 100%. Check that the ruler measures {metric ? '50 mm' : 'two inches'}, then hold the sheet behind your label stock to compare the circles.</p>
          </details>
          <p className="field-hint">In the print dialog, choose {paperName}, no margins, and Actual Size / 100%. Turn off headers and footers. Choose Save as PDF to keep a copy of the sheets.</p>
          <p className="field-hint">Check alignment on plain paper before using label stock. Open Paper and alignment if you need to adjust the position.</p>
        </div>
        </div>
        <div className="sheet-stage">
          <div className="sheet-meta"><span role="status">{copies.length} {copies.length === 1 ? 'label' : 'labels'} · {copies.length ? pageCount : 0} {copies.length && pageCount === 1 ? 'sheet' : 'sheets'}</span><span>{paperName} · {profile.slots.length} labels per sheet</span></div>
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
        <p className="proof-title">Tin to Cellar · {profile.name} · Actual Size / 100%</p>
        <div className="calibration-print-ruler" style={{ width: metric ? '50mm' : '2in' }}><span>0</span><span>{metric ? '50 mm' : '2 inches'}</span></div>
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
