import { useMemo, useRef, useState } from 'react'
import { CollectionError, planImport, applyImport, type Collection, type CollectionOrigin, type ImportCandidate, type ImportDecisions, type ImportPlan } from '../lib/collection'
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
  onGalleryAdded?: (rows: Collection['rows']) => void
}

/** Own the pending review independently of saved collection state.
 * Review choices are invalidated whenever the collection or handoff changes.
 */
export function usePackImport({ collection, ready, commit, onStart, onImported, onGalleryAdded }: Options) {
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
  // Cancel is a review-only transition. It never writes the saved collection.
  const cancelImport = () => {
    if (importBusy.current) return
    setCandidate(null)
    setReviewChoices(null)
    setImportError('')
    setImportLoadError(false)
    setNotice('Import canceled. Your saved selection is unchanged.')
  }
  const saveIncoming = async (incoming: ImportCandidate, change: (current: Collection) => Collection) => {
    let galleryRows: Collection['rows'] = []
    const saved = await commit(current => {
      const next = change(current)
      const galleryDesigns = new Set(incoming.designs.filter(design => design.origin === 'gallery').map(design => design.id))
      galleryRows = next.rows.filter(row => row.designId && galleryDesigns.has(row.designId) && !current.rows.some(previous => previous.id === row.id && previous.designId))
      return next
    })
    if (galleryRows.length) {
      try { onGalleryAdded?.(galleryRows) } catch { /* Optional collection counts cannot undo a saved label. */ }
    }
    if (incoming.receipt.contribution && !collection.receipts.some(receipt => receipt.id === incoming.receipt.id || receipt.contribution?.submissionId === incoming.receipt.contribution?.submissionId)) setFreshReceipts(previous => new Set(previous).add(incoming.receipt.id))
    setReceiptId(incoming.receipt.id); setCandidate(null); setReviewChoices(null)
    const count = saved.rows.filter(row => row.designId).length
    const remaining = saved.rows.filter(row => row.createRequested).map(row => row.blend)
    setNotice(`${incoming.receipt.repairPrompt ? incoming.designs.length ? 'Some labels need repair. ' : 'ZIP needs repair. ' : ''}${count} ${count === 1 ? 'label' : 'labels'} ready.${remaining.length ? ` Artwork still requested for: ${remaining.join(', ')}.` : ''}`)
    return saved
  }
  const saveCandidate = (incoming: ImportCandidate, plan: ImportPlan, choices: ImportDecisions) => saveIncoming(incoming, current => applyImport(current, plan, choices))
  const replaceCandidate = (incoming: ImportCandidate, plan: ImportPlan) => saveIncoming(incoming, current => {
    if (plan.candidate !== incoming || !incoming.designs.length) throw new CollectionError('invalid', 'This pack has no reviewed artwork to replace your labels with.')
    if (current.id !== plan.collectionId || current.revision !== plan.baseRevision) throw new CollectionError('conflict', 'Your saved labels changed while this pack was being reviewed. Review the updated pack before replacing anything.')
    // Build the entire replacement before the single storage transaction. Receipts
    // retain their history and diagnostic ownership even when artwork is replaced.
    const empty: Collection = { ...current, rows: [], designs: {}, handoff: null, printSettings: { page: 0, firstSlot: 1, offset: { x: 0, y: 0 } } }
    return applyImport(empty, planImport(empty, incoming))
  })
  const processResult = async (result: CellarPackImportResult, title: string, origin: CollectionOrigin, publicationId?: string, target?: { id: string; revision: number }) => {
    const { incoming, retrospective, diagnosticWarning } = await preparePackImport(result, title, origin, publicationId)
    if (retrospective) setNotes(previous => ({ ...previous, [incoming.receipt.id]: retrospective }))
    setDiagnosticWarnings(previous => ({ ...previous, [incoming.receipt.id]: diagnosticWarning }))
    const reviewIncoming = () => {
      const plan = planImport(collection, incoming)
      setCandidate(incoming)
      setReviewChoices({ key: importReviewKey(collection, incoming), values: defaultDecisions(plan) })
    }
    if (origin === 'gallery' && incoming.designs.length === 1) {
      const initialEntry = planImport(collection, incoming).entries[0]
      const initialTarget = target && collection.rows.find(row => row.id === target.id)
      if (initialEntry.kind === 'choice' || initialTarget?.designId && initialTarget.designId !== initialEntry.designId) { reviewIncoming(); return }
      await saveIncoming(incoming, current => {
        if (current.id !== collection.id || target && !current.rows.some(row => row.id === target.id && row.revision === target.revision)) throw new CollectionError('conflict', 'The requested label changed while its design downloaded. Review the label and choose a design again.')
        const plan = planImport(current, incoming)
        const choices = defaultDecisions(plan)
        const entry = plan.entries[0]
        const targetRow = target && current.rows.find(row => row.id === target.id)
        if (entry.kind === 'choice' || targetRow?.designId && targetRow.designId !== entry.designId) throw new CollectionError('conflict', 'Your saved artwork changed while this design downloaded. Choose it again to review the replacement.')
        // Exact unfinished matches use the same default fill rule from both
        // entry paths. Existing artwork needs a separate review decision.
        if (entry && target) choices[entry.designId] = { action: 'replace', rowId: target.id }
        return applyImport(current, plan, choices)
      })
    } else if (!incoming.designs.length) await saveIncoming(incoming, current => applyImport(current, planImport(current, incoming), {}))
    else {
      reviewIncoming()
      // Trying the bundled template is already an explicit selection. An empty
      // collection needs no merge decision; validate and save before previewing.
      if (origin === 'example' && result.status === 'ready' && collection.rows.length === 0) {
        await saveIncoming(incoming, current => {
          if (current.id !== collection.id || current.rows.length > 0) throw new CollectionError('conflict', 'Your saved selection changed while the template loaded. Review this pack before adding or replacing labels.')
          return applyImport(current, planImport(current, incoming))
        })
      }
    }
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
    const target = rowId ? collection.rows.find(row => row.id === rowId) : undefined
    if (rowId && !target) throw new CollectionError('conflict', 'The requested label is no longer available. Review your labels and try again.')
    importBusy.current = true; setImporting(true); setImportError('')
    try { const { downloadPublishedPack } = await import('../components/gallery/pack-builder'); const { file, result } = await downloadPublishedPack(choice); await processResult(result, file.name, 'gallery', choice.id, target ? { id: target.id, revision: target.revision } : undefined) }
    finally { importBusy.current = false; setImporting(false) }
  }
  const refreshDecisions = () => { if (review) setDecisions(defaultDecisions(review)) }
  return { importing, candidate, setCandidate, cancelImport, review, decisions, setDecisions, reviewInvalidated, refreshDecisions,
    notice, setNotice, importError, setImportError, importLoadError, receiptId, setReceiptId,
    freshReceipts, setFreshReceipts, notes, setNotes, diagnosticWarnings, saveCandidate, replaceCandidate, handlePack, chooseCommunity }
}
