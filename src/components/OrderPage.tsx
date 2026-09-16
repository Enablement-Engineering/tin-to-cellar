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
    <header className="page-heading order-page-heading"><div><h1>Add your blends</h1><p>Start with an order, a screenshot, or a blend list. Check the names before choosing artwork.</p></div><button type="button" className="button quiet" onClick={onBrowse}>Browse label designs instead</button></header>
    {rows.length > 0 && <p className="order-saved-note">{rows.length} {rows.length === 1 ? 'label already saved' : 'labels already saved'}. Adding blends keeps your existing designs and print quantities.</p>}
    <OrderImporter standalone rows={rows} busy={busy} onAdd={onAdd} />
  </section>
}
