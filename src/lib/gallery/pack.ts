import JSZip from 'jszip'
import type { CellarPackManifest } from '../cellarpack/types'
import { gallerySurface, galleryWriteInArea, parseGalleryDraft, uuid } from './schema'
import type { GalleryLabelDraft } from './types'
import { gallerySha256 } from './image'

/** Reconstruct from reviewed fields, never from an original manifest or ZIP. */
export async function buildGalleryPack(input: { metadata: GalleryLabelDraft; maker: string; blend: string; packId: string; createdAt: string }, artwork: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const { maker, blend, createdAt } = input
  const m = parseGalleryDraft(input.metadata)
  if (!uuid(input.packId.replace(/^urn:uuid:/, '')) || !Number.isFinite(Date.parse(createdAt)) || !maker.trim() || !blend.trim()) throw new Error('invalid_gallery_pack')
  const manifest: CellarPackManifest = {
    format: 'tin-to-cellar/cellarpack', schemaVersion: '0.1.0',
    packId: input.packId.startsWith('urn:uuid:') ? input.packId : `urn:uuid:${input.packId}`, createdAt,
    generator: { name: 'Tin to Cellar community pack exporter', version: '1.0.0' },
    labels: [{ id: 'shared-label', maker, blend, artworkAssetId: 'artwork',
      surface: gallerySurface(),
      writeInAreas: [galleryWriteInArea(m)],
      ...(m.edition ? { edition: m.edition } : {}),
      ...(m.altText ? { altText: m.altText } : {}),

    }],
    assets: { artwork: { path: 'artwork/label.png', mediaType: 'image/png', pixelWidth: m.image.width, pixelHeight: m.image.height, sha256: await gallerySha256(artwork), colorSpace: 'sRGB', alpha: artwork[25] === 6 } },
    defaultPrintIntent: { sheetProfileId: 'tin-to-cellar:avery-94502@1', labelQuantityMode: 'one-each' },
  }
  const zip = new JSZip(), date = new Date('2000-01-01T00:00:00Z')
  zip.file('manifest.json', JSON.stringify(manifest, null, 2) + '\n', { date, createFolders: false })
  zip.file('artwork/label.png', artwork, { date, createFolders: false })
  return Uint8Array.from(await zip.generateAsync({ type: 'uint8array', compression: 'STORE', platform: 'DOS' }))
}
