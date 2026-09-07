import JSZip from 'jszip'
import { encode } from 'fast-png'
import { importCellarPack } from '../cellarpack/importer'
import { makeTestManifest } from '../cellarpack/test-fixtures'
import type { CellarPackManifest } from '../cellarpack/types'
import { sha256 } from './validation'

const artwork = Uint8Array.from(encode({ width: 825, height: 825, channels: 3, data: new Uint8Array(825 * 825 * 3).fill(240) })).buffer
export async function collectionFixture(mutate?: (manifest: CellarPackManifest) => void) {
  const manifest = await makeTestManifest()
  const label = manifest.labels[0]
  label.surface.finishedSize = { width: 2.5, height: 2.5, unit: 'in' }
  label.surface.bleed = { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' }
  manifest.assets['asset-fixture'] = { ...manifest.assets['asset-fixture'], pixelWidth: 825, pixelHeight: 825, sha256: await sha256(artwork), alpha: false }
  mutate?.(manifest)
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(manifest))
  for (const asset of Object.values(manifest.assets)) zip.file(asset.path, artwork)
  return importCellarPack(await zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' }))
}
