import type { ConfiguratorState } from './ui-model'
import { TobaccoPicker } from './TobaccoPicker'
import { OrderImporter } from './OrderImporter'

type ConfiguratorProps = { value: ConfiguratorState; onChange: (next: ConfiguratorState) => void }

export function Configurator({ value, onChange }: ConfiguratorProps) {
  return (
    <section className="panel configurator" aria-labelledby="configurator-title">
      <div className="panel-heading"><div><p className="eyebrow">Step 1</p><h1 id="configurator-title">Make a prompt</h1></div><span className="spec-line">2.5 in circles</span></div>
      <TobaccoPicker value={value.tobaccos} onChange={(tobaccos) => onChange({ ...value, tobaccos })} />
      <OrderImporter onAdd={(names) => onChange({ ...value, tobaccos: [...new Set([...value.tobaccos.split('\n'), ...names].map((name) => name.trim()).filter(Boolean))].join('\n') })} />
      <label className="field field-wide"><span>Special requests <em>optional</em></span><textarea aria-label="Special requests" rows={3} value={value.artDirection} onChange={(event) => onChange({ ...value, artDirection: event.target.value })} placeholder="A particular tin edition, a reference link, or a detail to keep" /></label>
      <p className="field-hint">Include only blend names and label requests. Leave out personal names, contact details, order numbers and account information.</p>
      <p className="field-hint spec-line">Avery 94502 · 2.5-inch circles · US Letter</p>
    </section>
  )
}
