import { useMemo, useState, type DragEvent } from 'react'
import { Icon } from './Icons'
import { LabelArtwork } from './LabelArtwork'
import type { LabelInstance, WorkbenchLabel, WriteInMode } from './ui-model'
import { AVERY_94502_PROFILE } from '../lib/sheets'

type WorkbenchProps = {
  labels: WorkbenchLabel[]
  instances: LabelInstance[]
  mode: WriteInMode
  onModeChange: (mode: WriteInMode) => void
  onInstancesChange: (instances: LabelInstance[]) => void
  onProceed: () => void
}

function reorder(items: LabelInstance[], from: number, to: number) {
  const next = [...items]
  const [moved] = next.splice(from, 1)
  if (!moved) return items
  next.splice(to, 0, moved)
  return next
}

export function Workbench({ labels, instances, mode, onModeChange, onInstancesChange, onProceed }: WorkbenchProps) {
  const [selected, setSelected] = useState(0)
  const [page, setPage] = useState(0)
  const [guides, setGuides] = useState(false)
  const [dragged, setDragged] = useState<number | null>(null)
  const labelById = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels])
  const pageCount = Math.max(1, Math.ceil(instances.length / AVERY_94502_PROFILE.slots.length))
  const pageStart = page * AVERY_94502_PROFILE.slots.length
  const active = instances[selected]
  const activeLabel = active?.labelId ? labelById.get(active.labelId) : undefined

  const updateInstance = (index: number, patch: Partial<LabelInstance>) => {
    onInstancesChange(instances.map((instance, instanceIndex) => instanceIndex === index ? { ...instance, ...patch } : instance))
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= instances.length) return
    onInstancesChange(reorder(instances, from, to))
    setSelected(to)
    setPage(Math.floor(to / AVERY_94502_PROFILE.slots.length))
  }

  const duplicate = (index: number) => {
    const source = instances[index]
    if (!source) return
    const next = [...instances]
    next.splice(index + 1, 0, { ...source, instanceId: crypto.randomUUID() })
    onInstancesChange(next)
    setSelected(index + 1)
    setPage(Math.floor((index + 1) / AVERY_94502_PROFILE.slots.length))
  }

  const remove = (index: number) => {
    const next = instances.filter((_, instanceIndex) => instanceIndex !== index)
    const nextSelected = Math.max(0, Math.min(index, next.length - 1))
    onInstancesChange(next)
    setSelected(nextSelected)
    setPage(Math.min(Math.floor(nextSelected / AVERY_94502_PROFILE.slots.length), Math.max(0, Math.ceil(next.length / AVERY_94502_PROFILE.slots.length) - 1)))
  }

  const addBlank = () => {
    const index = instances.length
    onInstancesChange([...instances, { instanceId: crypto.randomUUID(), labelId: null, zoom: 1, x: 0, y: 0 }])
    setSelected(index)
    setPage(Math.floor(index / AVERY_94502_PROFILE.slots.length))
  }

  const showPage = (nextPage: number) => {
    const boundedPage = Math.max(0, Math.min(nextPage, pageCount - 1))
    const firstInstance = boundedPage * AVERY_94502_PROFILE.slots.length
    setPage(boundedPage)
    if (instances[firstInstance]) setSelected(firstInstance)
  }

  const dropAt = (event: DragEvent<HTMLButtonElement>, index: number) => {
    event.preventDefault()
    if (dragged !== null) move(dragged, index)
    setDragged(null)
  }

  if (!labels.length) return null

  return (
    <section className="workbench-section" aria-labelledby="workbench-title">
      <div className="section-heading wide-heading">
        <div>
          <p className="eyebrow">Print bench</p>
          <h2 id="workbench-title">Compose the sheet</h2>
          <p>Artwork stays untouched. These controls only change this print arrangement.</p>
        </div>
        <button className="button primary" type="button" onClick={onProceed}><Icon name="print" /> Review print</button>
      </div>

      <div className="workbench-layout">
        <aside className="bench-tools" aria-label="Sheet controls">
          <div className="tool-group">
            <p className="tool-label">Sheet</p>
            <strong>Avery 94502</strong>
            <span>US Letter · 9 × 2.5 in circles</span>
          </div>

          <div className="tool-group">
            <label className="toggle-line">
              <span><Icon name="guide" /> Guides</span>
              <input type="checkbox" checked={guides} onChange={(event) => setGuides(event.target.checked)} />
            </label>
          </div>

          <fieldset className="tool-group overlay-tools">
            <legend>Write-in overlay</legend>
            {(['JARRED', 'CELLARED', 'LINE', 'BLANK'] as WriteInMode[]).map((option) => (
              <label key={option}>
                <input type="radio" name="bench-overlay" checked={mode === option} onChange={() => onModeChange(option)} />
                <span>{option === 'LINE' ? 'Line only' : option === 'BLANK' ? 'Blank surface' : option}</span>
              </label>
            ))}
          </fieldset>

          <div className="tool-group">
            <button className="button quiet full" type="button" onClick={addBlank}>+ Add blank slot</button>
          </div>

          {active && (
            <div className="tool-group selected-tools">
              <p className="tool-label">Selected slot {selected + 1}</p>
              {activeLabel ? <strong>{activeLabel.blend}</strong> : <strong>Blank slot</strong>}
              {activeLabel && (
                <>
                  <label>
                    Zoom <output>{Math.round(active.zoom * 100)}%</output>
                    <input type="range" min="1" max="1.8" step="0.02" value={active.zoom} onChange={(event) => updateInstance(selected, { zoom: Number(event.target.value) })} />
                  </label>
                  <label>
                    Horizontal crop <output>{active.x > 0 ? '+' : ''}{active.x}%</output>
                    <input type="range" min="-30" max="30" step="1" value={active.x} onChange={(event) => updateInstance(selected, { x: Number(event.target.value) })} />
                  </label>
                  <label>
                    Vertical crop <output>{active.y > 0 ? '+' : ''}{active.y}%</output>
                    <input type="range" min="-30" max="30" step="1" value={active.y} onChange={(event) => updateInstance(selected, { y: Number(event.target.value) })} />
                  </label>
                  <button className="text-button" type="button" onClick={() => updateInstance(selected, { zoom: 1, x: 0, y: 0 })}>Reset crop</button>
                </>
              )}
              <div className="instance-actions">
                <button type="button" onClick={() => duplicate(selected)} disabled={!activeLabel}><Icon name="duplicate" /><span>Duplicate</span></button>
                <button type="button" onClick={() => remove(selected)}><Icon name="trash" /><span>Remove</span></button>
              </div>
            </div>
          )}
        </aside>

        <div className="sheet-stage">
          <div className="sheet-meta" aria-live="polite">
            <span>Page {page + 1} of {pageCount}</span>
            <span>{instances.filter((item) => item.labelId).length} labels · {instances.filter((item) => !item.labelId).length} blanks</span>
          </div>
          {pageCount > 1 && (
            <div className="page-controls" aria-label="Sheet pages">
              <button type="button" onClick={() => showPage(page - 1)} disabled={page === 0}>← Previous</button>
              <span>Sheet {page + 1}</span>
              <button type="button" onClick={() => showPage(page + 1)} disabled={page === pageCount - 1}>Next →</button>
            </div>
          )}
          <ol className="avery-sheet" aria-label="Avery 94502 label sheet">
            {AVERY_94502_PROFILE.slots.map((slot, index) => {
              const globalIndex = pageStart + index
              const instance = instances[globalIndex]
              const label = instance?.labelId ? labelById.get(instance.labelId) : undefined
              const isSelected = selected === globalIndex && Boolean(instance)
              return (
                <li
                  key={instance?.instanceId ?? `empty-${index}`}
                  style={{
                    left: `${(slot.x / AVERY_94502_PROFILE.page.width) * 100}%`,
                    top: `${(slot.y / AVERY_94502_PROFILE.page.height) * 100}%`,
                    width: `${(slot.width / AVERY_94502_PROFILE.page.width) * 100}%`,
                    height: `${(slot.height / AVERY_94502_PROFILE.page.height) * 100}%`,
                  }}
                >
                  <button
                    className={`sheet-slot ${isSelected ? 'is-selected' : ''} ${!label ? 'is-empty' : ''}`}
                    type="button"
                    draggable={Boolean(instance)}
                    onDragStart={() => setDragged(globalIndex)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropAt(event, globalIndex)}
                    onClick={() => instance && setSelected(globalIndex)}
                    aria-label={label ? `Slot ${globalIndex + 1}, ${label.blend}` : `Slot ${globalIndex + 1}, blank`}
                    aria-pressed={isSelected}
                  >
                    {label && instance ? <LabelArtwork label={label} zoom={instance.zoom} x={instance.x} y={instance.y} mode={mode} guides={guides} /> : <span className="blank-mark">{instance ? 'Blank' : `Slot ${globalIndex + 1}`}</span>}
                  </button>
                  {instance && (
                    <div className="slot-move-controls" aria-label={`Move slot ${globalIndex + 1}`}>
                      <button type="button" onClick={() => move(globalIndex, globalIndex - 1)} disabled={globalIndex === 0} aria-label={`Move slot ${globalIndex + 1} earlier`}>←</button>
                      <button type="button" onClick={() => move(globalIndex, globalIndex + 1)} disabled={globalIndex === instances.length - 1} aria-label={`Move slot ${globalIndex + 1} later`}>→</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          <div className="sheet-ruler" aria-hidden="true"><span>0</span><i /><span>8.5 in</span></div>
        </div>

        <aside className="provenance-panel" aria-label="Artwork provenance">
          <div className="provenance-heading"><Icon name="research" /><span>Research record</span></div>
          {activeLabel ? (
            <>
              <p className="maker">{activeLabel.maker}</p>
              <h3>{activeLabel.blend}</h3>
              <span className={`research-status ${activeLabel.researchStatus === 'complete' ? 'is-complete' : ''}`}>{activeLabel.researchStatus}</span>
              <dl>
                <div><dt>Observed variant</dt><dd>{activeLabel.variant}</dd></div>
                <div><dt>Adaptation</dt><dd>{activeLabel.adaptationSummary}</dd></div>
              </dl>
              <div className="source-list">
                <p className="tool-label">Sources</p>
                {activeLabel.sources.length ? activeLabel.sources.map((source) => (
                  <div className="source-item" key={source.id}>
                    <span>{source.role ?? 'Package appearance'}</span>
                    {source.url ? <a href={source.url} target="_blank" rel="noreferrer" onClick={(event) => {
                      if (!window.confirm('Open this research source in a new tab? Tin to Cellar never fetches it automatically.')) event.preventDefault()
                    }}>{source.title}</a> : <strong>{source.title}</strong>}
                  </div>
                )) : <p className="empty-copy">No source links were included.</p>}
              </div>
              {activeLabel.warnings.length > 0 && <div className="warning-list"><strong>Label warnings</strong><ul>{activeLabel.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
            </>
          ) : <p className="empty-copy">Select a label to inspect the package research that informed it. Sources never appear in print.</p>}
        </aside>
      </div>
    </section>
  )
}
