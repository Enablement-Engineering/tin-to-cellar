import { OrderImporter } from './OrderImporter'
import type { PreparationIdentity, PreparationRow } from './PreparationWorkspace'
import '../styles/order-page.css'

type OrderPageProps = {
  rows: PreparationRow[]
  busy?: boolean
  onAdd: (identities: PreparationIdentity[]) => Promise<void>
  onBrowse: () => void
}

export function OrderPage({ rows, busy, onAdd, onBrowse }: OrderPageProps) {
  return <section className="order-page">
    <header className="page-heading order-page-heading"><div><h1>Add your blends</h1><p>Start with an image, PDF, or pasted list. Review the blends we find, then choose or create artwork for each.</p></div><button type="button" className="button quiet" onClick={onBrowse}>Browse label designs instead</button></header>
    {rows.length > 0 && <p className="order-saved-note">You have {rows.length} saved label {rows.length === 1 ? 'entry' : 'entries'}. New blends add to your selection; your existing designs and quantities stay.</p>}
    <OrderImporter standalone rows={rows} busy={busy} onAdd={onAdd} />
  </section>
}
