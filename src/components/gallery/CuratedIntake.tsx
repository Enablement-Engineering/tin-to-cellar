import { useState } from 'react'
import type { ImportedCellarLabel } from '../../lib/cellarpack/types'
import { importCellarPack } from '../../lib/cellarpack/importer'
import type { GalleryLabelDraftV1, GalleryReceipt } from '../../lib/gallery/types'
import { API, errorText, request } from './client'
import { buildDraft, initial, references } from './draft'

type IntakeItem = {
  label: ImportedCellarLabel
  submissionId: string
  draft?: GalleryLabelDraftV1
  receipt?: GalleryReceipt
  error?: string
}

function choiceFor(label: ImportedCellarLabel) {
  const choice = initial(label)
  choice.references = references(label).map((source) => source.type === 'web' ? source.url : '')
  const variant = label.label.research.observedPackage.variant.toLowerCase()
  choice.variant = variant === 'current' || variant === 'historical' || variant === 'special' ? variant : 'unknown'
  choice.edition = label.label.research.observedPackage.variantDateOrEdition
  const format = label.label.research.observedPackage.format.toLowerCase()
  choice.package = format.includes('pouch') || format.includes('bag')
    ? 'pouch'
    : format.includes('box')
      ? 'box'
      : format.includes('bulk')
        ? 'bulk'
        : format.includes('tin')
          ? 'tin'
          : 'unknown'
  return choice
}

export function CuratedIntake() {
  const [items, setItems] = useState<IntakeItem[]>([])
  const [filenames, setFilenames] = useState<string[]>([])
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async (files: FileList | null) => {
    setError('')
    setAccepted(false)
    if (!files?.length) {
      setItems([])
      setFilenames([])
      return
    }
    setBusy(true)
    try {
      const imported: ImportedCellarLabel[] = []
      for (const file of Array.from(files)) {
        const result = await importCellarPack(await file.arrayBuffer())
        if (result.status !== 'ready' || result.quarantinedLabels.length || !result.labels.length) {
          throw new Error(`${file.name} is not a fully ready CellarPack. Correct every quarantined or blocking item before curated intake.`)
        }
        imported.push(...result.labels)
      }
      const ids = new Set<string>()
      const hashes = new Set<string>()
      for (const label of imported) {
        if (ids.has(label.id)) throw new Error(`Duplicate label ID in selected packs: ${label.id}`)
        if (hashes.has(label.artwork.asset.sha256)) throw new Error(`Duplicate artwork in selected packs: ${label.label.maker} ${label.label.blend}`)
        ids.add(label.id)
        hashes.add(label.artwork.asset.sha256)
      }
      setItems(imported.map((label) => ({ label, submissionId: crypto.randomUUID() })))
      setFilenames(Array.from(files, (file) => file.name))
    } catch (cause) {
      setItems([])
      setFilenames([])
      setError(errorText(cause))
    } finally {
      setBusy(false)
    }
  }

  const upload = async () => {
    if (!accepted || !items.length) return
    setBusy(true)
    setError('')
    const next = [...items]
    for (let index = 0; index < next.length; index++) {
      const attempt = next[index]
      if (attempt.receipt?.state === 'pending' || attempt.receipt?.state === 'published') continue
      try {
        const draft = attempt.draft ?? await buildDraft(attempt.label, choiceFor(attempt.label), attempt.submissionId)
        attempt.draft = draft
        const reconciliation = new FormData()
        reconciliation.set('metadata', JSON.stringify(draft))
        reconciliation.set('artwork', new Blob([attempt.label.artwork.data], { type: 'image/png' }), `${attempt.label.id}.png`)
        const reconciled = await fetch(`${API}/admin/reconcile`, {
          method: 'POST',
          body: reconciliation,
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
        })
        if (reconciled.ok) {
          attempt.receipt = await reconciled.json() as GalleryReceipt
          attempt.error = undefined
          setItems([...next])
          continue
        }
        const result = await reconciled.json().catch(() => null) as { error?: string } | null
        if (reconciled.status !== 404 || result?.error !== 'publication_not_found') {
          throw new Error(result?.error ? `Published-resource reconciliation failed (${result.error.replaceAll('_', ' ')}).` : 'Published-resource reconciliation failed.')
        }
        const reserved = await request<GalleryReceipt>('/admin/intake', { method: 'POST', body: JSON.stringify(draft) })
        let receipt = reserved
        if (['reserved', 'uploading'].includes(reserved.state)) {
          const response = await fetch(`${API}/admin/intake/${reserved.id}/artwork`, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/png' },
            body: attempt.label.artwork.data,
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
          })
          if (!response.ok) {
            const result = await response.json().catch(() => null) as { error?: string } | null
            throw new Error(result?.error ? `Curated upload failed (${result.error.replaceAll('_', ' ')}).` : 'Curated upload failed.')
          }
          receipt = await response.json() as GalleryReceipt
        }
        if (receipt.state !== 'pending' && receipt.state !== 'published') {
          throw new Error(`Unexpected curated intake state: ${receipt.state}`)
        }
        attempt.receipt = receipt
        attempt.error = undefined
      } catch (cause) {
        attempt.error = errorText(cause)
      }
      setItems([...next])
    }
    setBusy(false)
  }

  const ready = items.filter((item) => item.receipt?.state === 'pending' || item.receipt?.state === 'published').length
  return <details className="panel gallery-curated-intake">
    <summary>Curated CellarPack intake</summary>
    <p>For administrator-reviewed releases only. This updates matching public labels in place and adds new labels to private review. PNG metadata is removed without changing image pixels; downloadable packs are rebuilt.</p>
    <label>Validated CellarPacks<input type="file" accept=".zip,application/zip" multiple disabled={busy} onChange={(event) => void load(event.target.files)} /></label>
    {error && <p role="alert">{error}</p>}
    {items.length > 0 && <>
      <p>{items.length} unique labels ready from {filenames.length} {filenames.length === 1 ? 'pack' : 'packs'}.</p>
      <label className="gallery-check"><input type="checkbox" checked={accepted} disabled={busy} onChange={(event) => setAccepted(event.target.checked)} />I reviewed the source evidence, artwork, blank writing areas, and print proofs. Apply these replacements to matching public labels and add new labels to private review.</label>
      <button className="button primary" disabled={!accepted || busy || ready === items.length} onClick={() => void upload()}>{busy ? 'Preparing community resources…' : ready ? `Retry ${items.length - ready} unfinished labels` : `Prepare ${items.length} community resources`}</button>
      <p role="status">{ready} of {items.length} resources prepared or added to private review.</p>
      {items.some((item) => item.error) && <ul>{items.filter((item) => item.error).map((item) => <li key={item.submissionId}>{item.label.label.maker} {item.label.label.blend}: {item.error}</li>)}</ul>}
    </>}
  </details>
}
