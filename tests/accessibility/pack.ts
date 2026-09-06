import JSZip from 'jszip'
import { encode } from 'fast-png'
import { createHash } from 'node:crypto'
import { makeTestManifest } from '../../src/lib/cellarpack/test-fixtures'

export async function printablePack() {
  const manifest = await makeTestManifest()
  const png = encode({ width: 825, height: 825, channels: 4, data: new Uint8Array(825 * 825 * 4).fill(255) })
  const label = manifest.labels[0]
  label.surface.finishedSize = { width: 2.5, height: 2.5, unit: 'in' }
  label.surface.bleed = { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' }
  label.surface.safeInset = { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' }
  Object.assign(manifest.assets['asset-fixture'], { pixelWidth: 825, pixelHeight: 825, sha256: createHash('sha256').update(png).digest('hex') })
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(manifest))
  zip.file('artwork/fixture-blend.png', png)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
