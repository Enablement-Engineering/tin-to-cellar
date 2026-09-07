import { findExactTobacco, resolveTobaccoId } from '../tobacco-catalog'
import { assertCollection } from './validation'
import { CollectionError, type Collection, type CollectionHandoff, type CollectionPrintSettings, type CollectionRow, type ReceiptDelivery, type RequestInput } from './types'

export function createCollection(): Collection {
  return { version: 1, id: crypto.randomUUID(), revision: 0, rows: [], designs: {}, receipts: [], handoff: null, printSettings: { page: 0, firstSlot: 1, offset: { x: 0, y: 0 } } }
}

export function newRow(input: RequestInput): CollectionRow {
  const canonical = input.catalogId ? resolveTobaccoId(input.catalogId) : undefined
  if (input.catalogId && !canonical) throw new CollectionError('invalid', 'This blend is no longer in the catalog. Choose its current identity or enter a custom blend.')
  return { id: crypto.randomUUID(), revision: 0, catalogId: canonical?.id ?? null, maker: (canonical?.maker ?? input.maker).trim(), blend: (canonical?.blend ?? input.blend).trim(), edition: input.edition?.trim() ?? '', notes: input.notes?.trim() ?? '', quantity: 1, designId: null, createRequested: false }
}

/** Commands retain the committed revision; only the storage transaction advances it. */
export function addRequests(collection: Collection, requests: RequestInput[]): Collection {
  const rows = [...collection.rows]
  for (const input of requests) {
    const row = newRow(input)
    if (rows.some(existing => existing.catalogId === row.catalogId && existing.maker === row.maker && existing.blend === row.blend && existing.edition === row.edition && existing.notes === row.notes)) continue
    rows.push(row)
  }
  return finish({ ...collection, rows })
}

export function updateRow(collection: Collection, id: string, patch: Partial<Pick<CollectionRow, 'maker' | 'blend' | 'catalogId' | 'edition' | 'notes' | 'quantity' | 'createRequested'>>): Collection {
  if (!collection.rows.some(row => row.id === id)) throw new CollectionError('conflict', 'This label changed in another view. Refresh your labels and try again.')
  return finish({ ...collection, rows: collection.rows.map(row => {
    if (row.id !== id) return row
    const next = { ...row, ...patch }
    const identityChanged = ['maker', 'blend', 'catalogId', 'edition'].some(key => next[key as keyof CollectionRow] !== row[key as keyof CollectionRow])
    if (identityChanged) next.designId = null
    // Quantities do not change which artwork a prepared request was asking for.
    const requestChanged = identityChanged || next.notes !== row.notes || next.createRequested !== row.createRequested
    return { ...next, revision: row.revision + Number(requestChanged) }
  }) })
}

export function removeRow(collection: Collection, id: string): Collection { return finish({ ...collection, rows: collection.rows.filter(row => row.id !== id) }) }
export function setPrintSettings(collection: Collection, printSettings: CollectionPrintSettings): Collection { return finish({ ...collection, printSettings }) }
export function setHandoff(collection: Collection, handoff: CollectionHandoff | null): Collection { return finish({ ...collection, handoff }) }
export function setReceiptDelivery(collection: Collection, id: string, delivery: ReceiptDelivery): Collection {
  const submissionId = collection.receipts.find(receipt => receipt.id === id)?.contribution?.submissionId
  return finish({ ...collection, receipts: collection.receipts.map(receipt => receipt.id === id || submissionId && receipt.contribution?.submissionId === submissionId ? { ...receipt, delivery } : receipt) })
}

export function finish(collection: Collection): Collection {
  const selected = new Set(collection.rows.flatMap(row => row.designId ? [row.designId] : []))
  const blobs = new Map<string, ArrayBuffer>()
  const designs = Object.fromEntries(Object.entries(collection.designs).filter(([id]) => selected.has(id)).map(([id, design]) => {
    const artwork = design.item.artwork
    const data = blobs.get(artwork.asset.sha256) ?? artwork.data
    blobs.set(artwork.asset.sha256, data)
    return [id, { ...design, item: { ...design.item, artwork: { ...artwork, data } } }]
  }))
  const next = { ...collection, designs }
  assertCollection(next)
  return next
}

export function identityForDesign(maker: string, blend: string): RequestInput {
  const catalog = findExactTobacco(maker, blend)
  return { catalogId: catalog?.id ?? null, maker, blend }
}
