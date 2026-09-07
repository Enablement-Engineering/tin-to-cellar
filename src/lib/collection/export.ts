import JSZip from 'jszip'
import { importCellarPack } from '../cellarpack/importer'
import type { CellarPackManifest } from '../cellarpack/types'
import { assertCollection } from './validation'
import { CollectionError, type Collection } from './types'

/** Ready artwork only: pending requests and print quantities are not a backup. */
export async function exportCollection(collection: Collection): Promise<File> {
  assertCollection(collection)
  const selected = [...new Set(collection.rows.flatMap(row => row.designId ? [row.designId] : []))]
  if (!selected.length) throw new CollectionError('invalid', 'Choose at least one ready label to download.')
  const zip = new JSZip()
  const manifest: CellarPackManifest = { format: 'tin-to-cellar/cellarpack', schemaVersion: '0.1.0', packId: `urn:uuid:${crypto.randomUUID()}`, createdAt: new Date().toISOString(), title: 'Your labels', generator: { name: 'Tin to Cellar collection exporter', version: '1.0.0' }, labels: [], assets: {}, defaultPrintIntent: { sheetProfileId: 'tin-to-cellar:avery-94502@1', labelQuantityMode: 'one-each' } }
  const assets = new Map<string, string>()
  selected.forEach((id, index) => {
    const item = collection.designs[id].item
    const hash = item.artwork.asset.sha256
    let assetId = assets.get(hash)
    if (!assetId) {
      assetId = `artwork-${assets.size + 1}`
      assets.set(hash, assetId)
      const path = `artwork/${assetId}.${item.artwork.mediaType === 'image/png' ? 'png' : 'jpg'}`
      manifest.assets[assetId] = { ...item.artwork.asset, path }
      zip.file(path, item.artwork.data)
    }
    manifest.labels.push({ ...item.label, id: `label-${index + 1}`, artworkAssetId: assetId })
  })
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  const bytes = await zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' })
  const checked = await importCellarPack(bytes)
  if (checked.status !== 'ready' || checked.quarantinedLabels.length || checked.labels.length !== selected.length) throw new CollectionError('invalid', 'The combined download did not pass its ZIP checks. Your saved labels are unchanged; keep the original ZIPs.')
  return new File([bytes], 'your-labels.cellarpack.zip', { type: 'application/zip' })
}
