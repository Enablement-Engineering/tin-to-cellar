import type { ConfiguratorState, LabelShape, WriteInMode } from './ui-model'

type ConfiguratorProps = {
  value: ConfiguratorState
  onChange: (next: ConfiguratorState) => void
}

const shapes: Array<{ value: LabelShape; label: string; glyph: string }> = [
  { value: 'circle', label: 'Circle', glyph: '●' },
  { value: 'oval', label: 'Oval', glyph: '⬭' },
  { value: 'square', label: 'Square', glyph: '■' },
  { value: 'rectangle', label: 'Rectangle', glyph: '▬' },
  { value: 'rounded-rectangle', label: 'Rounded', glyph: '▰' },
]

const writeInOptions: Array<{ value: WriteInMode; label: string }> = [
  { value: 'JARRED', label: 'Jarred + line' },
  { value: 'CELLARED', label: 'Cellared + line' },
  { value: 'LINE', label: 'Line only' },
  { value: 'BLANK', label: 'Leave blank' },
]

function update(
  value: ConfiguratorState,
  onChange: (next: ConfiguratorState) => void,
  patch: Partial<ConfiguratorState>,
) {
  onChange({ ...value, ...patch })
}

export function Configurator({ value, onChange }: ConfiguratorProps) {
  const tobaccoCount = value.tobaccos.split('\n').filter((line) => line.trim()).length

  return (
    <section className="panel configurator" aria-labelledby="configurator-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Generation brief</p>
          <h2 id="configurator-title">Describe the labels</h2>
        </div>
        <span className="count-seal" aria-label={`${tobaccoCount} tobaccos entered`}>
          {tobaccoCount || '—'}
        </span>
      </div>

      <label className="field field-wide">
        <span>Tobaccos</span>
        <span className="field-hint">One per line. Maker is useful, not required.</span>
        <textarea
          aria-label="Tobaccos"
          rows={6}
          value={value.tobaccos}
          onChange={(event) => update(value, onChange, { tobaccos: event.target.value })}
          placeholder={'A&C Petersen — Escudo Navy De Luxe\nCornell & Diehl — Pirate Kake\nG. L. Pease — Westminster'}
        />
      </label>

      {!tobaccoCount && (
        <p className="inline-note">
          Leave this empty if you want the agent to begin by asking what you are cellaring.
        </p>
      )}

      <fieldset className="field field-wide shape-picker">
        <legend>Finished label shape</legend>
        <div className="segmented-grid">
          {shapes.map((shape) => (
            <label key={shape.value} className={value.shape === shape.value ? 'is-selected' : ''}>
              <input
                type="radio"
                name="shape"
                value={shape.value}
                checked={value.shape === shape.value}
                onChange={() => {
                  const patch: Partial<ConfiguratorState> = { shape: shape.value }
                  if (shape.value === 'circle' || shape.value === 'square') patch.height = value.width
                  update(value, onChange, patch)
                }}
              />
              <span className="shape-glyph" aria-hidden="true">{shape.glyph}</span>
              <span>{shape.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field-row dimensions-row">
        <label className="field">
          <span>Width</span>
          <div className="measurement">
            <input
              aria-label="Width"
              type="number"
              min="0.5"
              max="12"
              step="0.125"
              value={value.width}
              onChange={(event) => {
                const width = Number(event.target.value)
                update(value, onChange, {
                  width,
                  ...((value.shape === 'circle' || value.shape === 'square') ? { height: width } : {}),
                })
              }}
            />
            <span>in</span>
          </div>
        </label>
        <label className="field">
          <span>Height</span>
          <div className="measurement">
            <input
              aria-label="Height"
              type="number"
              min="0.5"
              max="12"
              step="0.125"
              disabled={value.shape === 'circle' || value.shape === 'square'}
              value={value.height}
              onChange={(event) => update(value, onChange, { height: Number(event.target.value) })}
            />
            <span>in</span>
          </div>
        </label>
        <label className="field">
          <span>Bleed</span>
          <div className="measurement">
            <input
              aria-label="Bleed"
              type="number"
              min="0"
              max="0.5"
              step="0.025"
              value={value.bleed}
              onChange={(event) => update(value, onChange, { bleed: Number(event.target.value) })}
            />
            <span>in</span>
          </div>
        </label>
      </div>

      <label className="field field-wide">
        <span>Print stock preference</span>
        <select aria-label="Print stock preference" value={value.stock} onChange={(event) => update(value, onChange, { stock: event.target.value })}>
          <option value="tin-to-cellar:avery-94502@1">Avery 94502 · 2.5 in circles · 9-up</option>
          <option value="tin-to-cellar:full-sheet-letter@1">Full-sheet adhesive · US Letter</option>
          <option value="tin-to-cellar:full-sheet-a4@1">Full-sheet adhesive · A4</option>
          <option value="custom">Custom / decide in the print studio</option>
        </select>
        <small>Stock is a print-layout hint. It never changes the artwork size silently.</small>
      </label>

      <label className="field field-wide">
        <span>Web references <em>optional</em></span>
        <textarea
          aria-label="Web references"
          rows={3}
          value={value.inspirationUrls}
          onChange={(event) => update(value, onChange, { inspirationUrls: event.target.value })}
          placeholder="Paste product pages or visual references, one URL per line"
        />
      </label>

      <label className="field field-wide">
        <span>Files you plan to attach <em>optional</em></span>
        <input
          aria-label="Files you plan to attach"
          type="text"
          value={value.plannedFiles}
          onChange={(event) => update(value, onChange, { plannedFiles: event.target.value })}
          placeholder="tin-photo.jpg, family-label-scan.png"
        />
        <small>Only the filenames enter the prompt. Attach the files after ChatGPT opens.</small>
      </label>

      <fieldset className="field field-wide write-in-picker">
        <legend>Write-in treatment</legend>
        <div className="segmented-row">
          {writeInOptions.map((option) => (
            <label key={option.value} className={value.writeInMode === option.value ? 'is-selected' : ''}>
              <input
                type="radio"
                name="write-in-mode"
                value={option.value}
                checked={value.writeInMode === option.value}
                onChange={() => update(value, onChange, { writeInMode: option.value })}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field field-wide">
        <span>Additional art direction <em>optional</em></span>
        <textarea
          aria-label="Additional art direction"
          rows={3}
          value={value.artDirection}
          onChange={(event) => update(value, onChange, { artDirection: event.target.value })}
          placeholder="Keep the restrained cream and oxblood character; use the photo only for composition inspiration."
        />
      </label>
    </section>
  )
}
