import JSZip from 'jszip'
import { encode } from 'fast-png'
import { createHash, randomUUID } from 'node:crypto'
import { makeTestManifest } from '../../src/lib/cellarpack/test-fixtures'
import { readFileSync } from 'node:fs'
import { GALLERY_NOTICE_VERSION, type GalleryLabelDraftV1 } from '../../src/lib/gallery/types'
export const tobacco = JSON.parse(readFileSync(new URL('../../src/lib/tobacco-catalog/catalog.json', import.meta.url), 'utf8'))[0] as { id: string; maker: string; blend: string }
export async function fixture(size = 1024, variation = 0) {
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = (y * size + x) * 4
    const panel = x > size * .3 && x < size * .7 && y > size * .43 && y < size * .57
    pixels.set(panel ? [250, 245, 220, 255] : [30 + variation, 95 + Math.floor(x * 80 / size), 90 + Math.floor(y * 90 / size), 255], n)
  }
  const png = encode({ width: size, height: size, channels: 4, data: pixels })
  const manifest = await makeTestManifest()
  const label = manifest.labels[0]
  label.maker = tobacco.maker; label.blend = tobacco.blend
  label.surface.finishedSize = { width: 2.5, height: 2.5, unit: 'in' }
  label.surface.bleed = { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' }
  label.surface.safeInset = { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' }
  label.research.sources = [{ id: 'private-original', type: 'user-provided', role: 'package-appearance', description: 'PRIVATE_RESEARCH_SENTINEL', originalFilename: 'PRIVATE_ORDER_SENTINEL.png', receivedAt: manifest.createdAt }]
  label.extensions = { 'private-notes': 'PRIVATE_EXTENSION_SENTINEL' }
  Object.assign(manifest.assets['asset-fixture'], { pixelWidth: size, pixelHeight: size, sha256: createHash('sha256').update(png).digest('hex') })
  const zip = new JSZip().file('manifest.json', JSON.stringify(manifest)).file('artwork/fixture-blend.png', png)
  const draft: GalleryLabelDraftV1 = {
    version: 1, submissionId: randomUUID(), catalogId: tobacco.id, proposedIdentity: null,
    package: 'tin', variant: 'unknown', edition: 'Synthetic test', description: 'Original geometric test design with a blank cream writing area',
    surface: label.surface, writeInArea: { ...label.writeInAreas[0], background: { integratedInArtwork: true } }, references: [],
    image: { sha256: manifest.assets['asset-fixture'].sha256, bytes: png.length, width: size, height: size },
    acknowledgement: { version: GALLERY_NOTICE_VERSION, accepted: true },
  }
  return { png: Buffer.from(png), zip: await zip.generateAsync({ type: 'nodebuffer' }), draft, manifest, pixels }
}
