import { useMemo } from 'react'
import { Icon } from './Icons'
import { LabelArtwork } from './LabelArtwork'
import type { Calibration, LabelInstance, WorkbenchLabel, WriteInMode } from './ui-model'
import { AVERY_94502_PROFILE } from '../lib/sheets'

type PrintStudioProps = {
  labels: WorkbenchLabel[]
  instances: LabelInstance[]
  mode: WriteInMode
  calibration: Calibration
  onCalibrationChange: (value: Calibration) => void
  onBack: () => void
}

export function PrintStudio({ labels, instances, mode, calibration, onCalibrationChange, onBack }: PrintStudioProps) {
  const labelById = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels])
  const pages = Math.max(1, Math.ceil(instances.length / 9))

  const printCalibration = () => {
    document.body.dataset.printMode = 'calibration'
    window.print()
    delete document.body.dataset.printMode
  }

  const printLabels = () => {
    document.body.dataset.printMode = 'labels'
    window.print()
    delete document.body.dataset.printMode
  }

  return (
    <section className="print-studio" aria-labelledby="print-title">
      <div className="section-heading wide-heading screen-only">
        <div>
          <button className="back-link" type="button" onClick={onBack}>← Back to the bench</button>
          <p className="eyebrow">Output check</p>
          <h2 id="print-title">Measure once. Then print.</h2>
          <p>Print the calibration page on plain paper before using sticker stock.</p>
        </div>
      </div>

      <div className="print-layout screen-only">
        <section className="calibration-card" aria-labelledby="calibration-title">
          <div className="calibration-mark" aria-hidden="true">
            <span className="crosshair horizontal" />
            <span className="crosshair vertical" />
            <span className="calibration-ruler"><b>0</b><i /><b>2 in</b></span>
          </div>
          <div>
            <p className="eyebrow">Plain-paper proof</p>
            <h3 id="calibration-title">Calibration sheet</h3>
            <p>Print at <strong>100% / Actual Size</strong>. Measure the two-inch ruler and hold the paper behind an empty label sheet to check alignment.</p>
            <button className="button secondary" type="button" onClick={printCalibration}><Icon name="print" /> Print calibration</button>
          </div>
        </section>

        <section className="offset-card" aria-labelledby="offset-title">
          <p className="eyebrow">Printer correction</p>
          <h3 id="offset-title">Alignment offsets</h3>
          <div className="offset-grid">
            <label>X offset <div className="measurement"><input type="number" step="0.01" value={calibration.x} onChange={(event) => onCalibrationChange({ ...calibration, x: Number(event.target.value) })} /><span>in</span></div></label>
            <label>Y offset <div className="measurement"><input type="number" step="0.01" value={calibration.y} onChange={(event) => onCalibrationChange({ ...calibration, y: Number(event.target.value) })} /><span>in</span></div></label>
            <label>Scale <div className="measurement"><input type="number" min="0.95" max="1.05" step="0.001" value={calibration.scale} onChange={(event) => onCalibrationChange({ ...calibration, scale: Number(event.target.value) })} /><span>×</span></div></label>
          </div>
          <p className="field-hint">Correct printer-driver scaling first. Use scale correction only after measuring the calibration ruler.</p>
        </section>

        <section className="final-output-card" aria-labelledby="final-output-title">
          <p className="eyebrow">Production output</p>
          <h3 id="final-output-title">Avery 94502 · {pages} {pages === 1 ? 'page' : 'pages'}</h3>
          <ol className="print-checklist">
            <li>US Letter paper selected</li>
            <li>Portrait orientation</li>
            <li>Scale set to 100% or Actual Size</li>
            <li>Headers and footers turned off</li>
            <li>Background graphics enabled</li>
          </ol>
          <button className="button primary" type="button" onClick={printLabels}><Icon name="print" /> Print label sheet</button>
          <p className="save-pdf-note"><Icon name="download" size={16} /> To make a PDF, choose <strong>Save as PDF</strong> in the print dialog. The physical page dimensions are preserved.</p>
        </section>
      </div>

      <div className="calibration-print" aria-hidden="true">
        <h1>Tin to Cellar calibration · Avery 94502</h1>
        <p>Print at 100% / Actual Size. Disable Fit, Shrink, or Scale to fit.</p>
        <div className="calibration-print-ruler"><span>0</span><i /><span>2 inches</span></div>
        <div className="calibration-outline"><span>Align this page behind an empty label sheet</span></div>
      </div>

      <div className="production-pages" style={{ '--offset-x': `${calibration.x}in`, '--offset-y': `${calibration.y}in`, '--print-scale': calibration.scale } as React.CSSProperties}>
        {Array.from({ length: pages }, (_, pageIndex) => (
          <div className="production-page" key={`page-${pageIndex}`}>
            {AVERY_94502_PROFILE.slots.map((slot, slotIndex) => {
              const instance = instances[pageIndex * 9 + slotIndex]
              const label = instance?.labelId ? labelById.get(instance.labelId) : undefined
              return (
                <div
                  className="production-slot"
                  key={instance?.instanceId ?? `blank-${slotIndex}`}
                  style={{
                    left: `${slot.x}${AVERY_94502_PROFILE.page.unit}`,
                    top: `${slot.y}${AVERY_94502_PROFILE.page.unit}`,
                    width: `${slot.width}${AVERY_94502_PROFILE.page.unit}`,
                    height: `${slot.height}${AVERY_94502_PROFILE.page.unit}`,
                  }}
                >
                  {label && instance && <LabelArtwork label={label} zoom={instance.zoom} x={instance.x} y={instance.y} mode={mode} />}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
