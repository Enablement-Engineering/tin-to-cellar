import JSZip from 'jszip'
import { importCellarPack } from '../../lib/cellarpack'
import type { CellarPackImportResult, CellarPackManifest, ImportedCellarLabel } from '../../lib/cellarpack/types'

import { MAX_PACK_LABELS, validChoice, type PackChoice } from './pack-selection'
const MAX_BYTES = 45 * 1024 * 1024

type PublicationDownloadOptions = { signal?: AbortSignal; fetcher?: typeof fetch }

/** Download and validate one current publication without fetching research links. */
export async function downloadPublishedPack(choice: PackChoice, { signal, fetcher = fetch }: PublicationDownloadOptions = {}): Promise<{ file: File; result: CellarPackImportResult }> {
  if (!validChoice(choice)) throw new Error('Choose a valid community label.')
  signal?.throwIfAborted()
  const timeout = AbortSignal.timeout(30000)
  const response = await fetcher(`/api/gallery/v1/labels/${choice.id}/pack`, { cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout, referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error(`${choice.maker} ${choice.blend} could not be downloaded. It may no longer be available. Retry or choose another design.`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The pack download was empty. Please try again.')
  const chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break
      size += value.length
      if (size > 19 * 1024 * 1024) { await reader.cancel(); throw new Error('This community label download is too large. Choose another design.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  signal?.throwIfAborted()
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  const result = await importCellarPack(bytes.buffer)
  signal?.throwIfAborted()
  if (result.status !== 'ready' || result.labels.length !== 1 || result.quarantinedLabels.length) throw new Error(`${choice.maker} ${choice.blend} failed its pack checks. Retry or choose another design.`)
  if (result.labels[0].artwork.mediaType !== 'image/png') throw new Error('This gallery artwork is not a PNG.')
  return { file: new File([bytes.buffer], 'community-label.cellarpack.zip', { type: 'application/zip' }), result }
}

export async function downloadPublishedLabel(choice: PackChoice, options?: PublicationDownloadOptions): Promise<ImportedCellarLabel> {
  return (await downloadPublishedPack(choice, options)).result.labels[0]
}

/** Fetch current publications only; build locally from validated public packs. */
export async function buildSelectedPack(choices: PackChoice[], fetcher: typeof fetch = fetch): Promise<File> {
  if (!choices.length || choices.length > MAX_PACK_LABELS || choices.some(c => !validChoice(c)) || new Set(choices.map(c => c.id)).size !== choices.length) throw new Error('Choose between 1 and 20 different labels.')
  const zip = new JSZip()
  const manifest: CellarPackManifest = {
    format: 'tin-to-cellar/cellarpack', schemaVersion: '0.1.0', packId: `urn:uuid:${crypto.randomUUID()}`, createdAt: new Date().toISOString(),
    title: 'Your community label pack', generator: { name: 'Tin to Cellar pack builder', version: '1.0.0' }, labels: [], assets: {},
    defaultPrintIntent: { sheetProfileId: 'tin-to-cellar:avery-94502@1', labelQuantityMode: 'one-each' },
  }
  let total = 0
  for (const choice of choices) {
    const { result: imported, file } = await downloadPublishedPack(choice, { fetcher })
    total += file.size
    if (total > MAX_BYTES) throw new Error('This pack is too large. Remove a few labels and try again.')
    const item = imported.labels[0], id = `label-${choice.id}`, assetId = `artwork-${choice.id}`, path = `artwork/${choice.id}.png`
    if (item.artwork.mediaType !== 'image/png') throw new Error('This gallery artwork is not a PNG.')
    // Each single-label export uses the same IDs. Namespace them in the combined pack.
    manifest.labels.push({ ...item.label, id, artworkAssetId: assetId })
    manifest.assets[assetId] = { ...item.artwork.asset, path }
    zip.file(path, item.artwork.data)
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  return new File([await zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' })], 'community-labels.cellarpack.zip', { type: 'application/zip' })
}
