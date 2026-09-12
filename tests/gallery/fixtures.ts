import JSZip from 'jszip'
import { decode, encode } from 'fast-png'
import { createHash, randomUUID } from 'node:crypto'
import { makeTestManifest } from '../../src/lib/cellarpack/test-fixtures'
import { readFileSync } from 'node:fs'
import { GALLERY_NOTICE_VERSION, type GalleryLabelDraft } from '../../src/lib/gallery/types'
export const tobacco = JSON.parse(readFileSync(new URL('../../src/lib/tobacco-catalog/catalog.json', import.meta.url), 'utf8'))[0] as { id: string; maker: string; blend: string }
/** Compare all decoded pixels without generating multi-megabyte assertion diffs. */
export function decodedPixelSignature(png: Uint8Array) {
  const image = decode(png)
  return { width: image.width, height: image.height, channels: image.channels, depth: image.depth,
    sha256: createHash('sha256').update(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength)).digest('hex') }
}
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
  label.research!.sources = [{ id: 'private-original', type: 'user-provided', role: 'package-appearance', description: 'PRIVATE_RESEARCH_SENTINEL', originalFilename: 'PRIVATE_ORDER_SENTINEL.png', receivedAt: manifest.createdAt }]
  label.extensions = { 'private-notes': 'PRIVATE_EXTENSION_SENTINEL' }
  Object.assign(manifest.assets['asset-fixture'], { pixelWidth: size, pixelHeight: size, sha256: createHash('sha256').update(png).digest('hex') })
  const zip = new JSZip().file('manifest.json', JSON.stringify(manifest)).file('artwork/fixture-blend.png', png)
  const draft: GalleryLabelDraft = {
    version: 2, submissionId: randomUUID(), tobacco: { catalogId: tobacco.id },
    artworkProfileId: 'circle-2.5@1', edition: 'Synthetic test', altText: 'Original geometric test design with a blank cream writing area',
    writingArea: { shape: label.writeInAreas[0].geometry.shape, x: label.writeInAreas[0].geometry.x, y: label.writeInAreas[0].geometry.y, width: label.writeInAreas[0].geometry.width, height: label.writeInAreas[0].geometry.height },
    image: { sha256: manifest.assets['asset-fixture'].sha256, bytes: png.length, width: size, height: size },
    acknowledgement: { version: GALLERY_NOTICE_VERSION, accepted: true },
  }
  return { png: Buffer.from(png), zip: await zip.generateAsync({ type: 'nodebuffer' }), draft, manifest, pixels }
}
