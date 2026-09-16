import { addRequests, updateRow } from './commands'
import { applyImport, planImport } from './import'
import { CollectionError, type Collection, type ImportCandidate, type RequestInput } from './types'

/** A manual entry is saved in one transaction, with an explicit artwork path. */
export function addManualLabel(collection: Collection, identity: RequestInput, choice: 'ai' | ImportCandidate): Collection {
  const next = addRequests(collection, [identity])
  const row = next.rows.find(row => !collection.rows.some(existing => existing.id === row.id))
  if (!row) throw new CollectionError('conflict', 'This blend is already saved. Cancel and change its artwork in your labels.')
  if (choice === 'ai') return updateRow(next, row.id, { createRequested: true })
  const design = choice.designs[0]
  if (choice.designs.length !== 1 || design.item.label.maker !== row.maker || design.item.label.blend !== row.blend) {
    throw new CollectionError('invalid', 'This design does not match the selected blend. Choose another design.')
  }
  const plan = planImport(next, choice)
  return applyImport(next, plan, { [design.id]: { action: 'replace', rowId: row.id } })
}
