import JSZip from 'jszip'
import { importCellarPack } from '../../lib/cellarpack'
import type { CellarPackManifest } from '../../lib/cellarpack/types'

import { MAX_PACK_LABELS, validChoice, type PackChoice } from './pack-selection'
const MAX_BYTES = 45 * 1024 * 1024

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
    const response = await fetcher(`/api/gallery/v1/labels/${choice.id}/pack`, { cache: 'no-store', signal: AbortSignal.timeout(30000) })
    if (!response.ok) throw new Error(`${choice.maker} ${choice.blend} could not be downloaded. It may no longer be available. Your selection is saved; retry or remove this label.`)
    const reader = response.body?.getReader()
    if (!reader) throw new Error('The pack download was empty. Please try again.')
    const chunks: Uint8Array[] = []; let size = 0
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break
        size += value.length
        if (size > 19 * 1024 * 1024 || total + size > MAX_BYTES) { await reader.cancel(); throw new Error('This pack is too large. Remove a few labels and try again.') }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const imported = await importCellarPack(bytes.buffer)
    if (imported.status !== 'ready' || imported.labels.length !== 1 || imported.quarantinedLabels.length) throw new Error(`${choice.maker} ${choice.blend} failed its pack checks. Your selection is saved; remove it or try again.`)
    const item = imported.labels[0], id = `label-${choice.id}`, assetId = `artwork-${choice.id}`, path = `artwork/${choice.id}.png`
    if (item.artwork.mediaType !== 'image/png') throw new Error('This gallery artwork is not a PNG.')
    // Each single-label export uses the same IDs. Namespace them in the combined pack.
    manifest.labels.push({ ...item.label, id, artworkAssetId: assetId })
    manifest.assets[assetId] = { ...item.artwork.asset, path }
    zip.file(path, item.artwork.data)
    total += size
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  return new File([await zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' })], 'community-labels.cellarpack.zip', { type: 'application/zip' })
}
