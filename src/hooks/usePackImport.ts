import { useMemo, useRef, useState } from 'react'
import { planImport, applyImport, type Collection, type CollectionOrigin, type ImportCandidate, type ImportDecisions, type ImportPlan } from '../lib/collection'
import type { CellarPackImportResult } from '../lib/cellarpack'
import type { Retrospective } from '../lib/feedback/retrospective'
import type { PackChoice } from '../components/gallery/pack-selection'
import { preparePackImport } from '../lib/import-workflow/prepare'

function defaultDecisions(plan: ImportPlan): ImportDecisions {
  return Object.fromEntries(plan.entries.map(entry => [entry.designId, entry.kind === 'fill' ? { action: 'replace', rowId: entry.matchRowIds[0] } : { action: entry.kind === 'add' ? 'add' : 'skip' }]))
}
const importReviewKey = (collection: Collection, candidate: ImportCandidate) => JSON.stringify([candidate.receipt.id, collection.handoff?.id, collection.rows.map(row => [row.id, row.revision, row.designId])])

type Options = {
  collection: Collection
  ready: boolean
  commit: (change: (current: Collection) => Collection) => Promise<Collection>
  onStart: () => void
  onImported: () => void
}

/** Own the pending review independently of saved collection state.
 * Review choices are invalidated whenever the collection or handoff changes.
 */
export function usePackImport({ collection, ready, commit, onStart, onImported }: Options) {
  const [importing, setImporting] = useState(false)
  const importBusy = useRef(false)
  const [candidate, setCandidate] = useState<ImportCandidate | null>(null)
  const review = useMemo(() => candidate ? planImport(collection, candidate) : null, [collection, candidate])
  const reviewKey = candidate ? importReviewKey(collection, candidate) : ''
  const [reviewChoices, setReviewChoices] = useState<{ key: string; values: ImportDecisions } | null>(null)
  const decisions = reviewChoices?.key === reviewKey ? reviewChoices.values : review ? defaultDecisions(review) : {}
  const reviewInvalidated = reviewChoices !== null && reviewChoices.key !== reviewKey
  const setDecisions = (values: ImportDecisions) => setReviewChoices({ key: reviewKey, values })
  const [notice, setNotice] = useState('')
  const [importError, setImportError] = useState('')
  const [importLoadError, setImportLoadError] = useState(false)
  const [receiptId, setReceiptId] = useState<string | null>(null)
  const [freshReceipts, setFreshReceipts] = useState<Set<string>>(() => new Set())
  const [notes, setNotes] = useState<Record<string, Retrospective>>({})
  const [diagnosticWarnings, setDiagnosticWarnings] = useState<Record<string, boolean>>({})
  const saveCandidate = async (incoming: ImportCandidate, plan: ImportPlan, choices: ImportDecisions) => {
    const saved = await commit(current => applyImport(current, plan, choices))
    if (incoming.receipt.contribution && !collection.receipts.some(receipt => receipt.id === incoming.receipt.id || receipt.contribution?.submissionId === incoming.receipt.contribution?.submissionId)) setFreshReceipts(previous => new Set(previous).add(incoming.receipt.id))
    setReceiptId(incoming.receipt.id); setCandidate(null)
    const count = saved.rows.filter(row => row.designId).length
    setNotice(`${incoming.receipt.repairPrompt ? incoming.designs.length ? 'Some labels need repair. ' : 'ZIP needs repair. ' : ''}${count} ${count === 1 ? 'label' : 'labels'} ready.`)
    return saved
  }
  const processResult = async (result: CellarPackImportResult, title: string, origin: CollectionOrigin, publicationId?: string, rowId?: string) => {
    const { incoming, retrospective, diagnosticWarning } = await preparePackImport(result, title, origin, publicationId)
    if (retrospective) setNotes(previous => ({ ...previous, [incoming.receipt.id]: retrospective }))
    setDiagnosticWarnings(previous => ({ ...previous, [incoming.receipt.id]: diagnosticWarning }))
    const plan = planImport(collection, incoming)
    if (origin === 'gallery' && incoming.designs.length === 1) {
      const choices = defaultDecisions(plan)
      const entry = plan.entries[0]
      if (entry && (rowId || entry.kind !== 'duplicate')) choices[entry.designId] = rowId ? { action: 'replace', rowId } : { action: 'add' }
      await saveCandidate(incoming, plan, choices)
    } else if (!incoming.designs.length) await saveCandidate(incoming, plan, {})
    else { setCandidate(incoming); setReviewChoices({ key: importReviewKey(collection, incoming), values: defaultDecisions(plan) }) }
  }
  const handlePack = async (file: File, origin: CollectionOrigin = 'local') => {
    if (importBusy.current || !ready) return
    importBusy.current = true; setImporting(true); setImportError(''); setImportLoadError(false); onStart(); setNotice('')
    try {
      const { importCellarPack } = await import('../lib/cellarpack')
      await processResult(await importCellarPack(await file.arrayBuffer()), file.name, origin)
      onImported()
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'The selected ZIP could not be read.'
      if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)) setImportLoadError(true)
      else setImportError(message)
    } finally { importBusy.current = false; setImporting(false) }
  }
  const chooseCommunity = async (choice: PackChoice, rowId?: string) => {
    if (importBusy.current || !ready) throw new Error('Wait for the current label to finish saving, then try again.')
    importBusy.current = true; setImporting(true); setImportError('')
    try { const { downloadPublishedPack } = await import('../components/gallery/pack-builder'); const { file, result } = await downloadPublishedPack(choice); await processResult(result, file.name, 'gallery', choice.id, rowId) }
    finally { importBusy.current = false; setImporting(false) }
  }
  const refreshDecisions = () => { if (review) setDecisions(defaultDecisions(review)) }
  return { importing, candidate, setCandidate, review, decisions, setDecisions, reviewInvalidated, refreshDecisions,
    notice, setNotice, importError, setImportError, importLoadError, receiptId, setReceiptId,
    freshReceipts, setFreshReceipts, notes, setNotes, diagnosticWarnings, saveCandidate, handlePack, chooseCommunity }
}
