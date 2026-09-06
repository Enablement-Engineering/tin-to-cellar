import JSZip from 'jszip'
import type { CellarPackManifest } from '../cellarpack/types'
import { parseGalleryDraft, uuid } from './schema'
import type { GalleryLabelDraftV1 } from './types'
import { gallerySha256 } from './image'

/** Reconstruct from reviewed fields, never from an original manifest or ZIP. */
export async function buildGalleryPack(input: { metadata: GalleryLabelDraftV1; maker: string; blend: string; packId: string; createdAt: string }, artwork: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const { maker, blend, createdAt } = input
  const m = parseGalleryDraft(input.metadata)
  if (!uuid(input.packId.replace(/^urn:uuid:/, '')) || !Number.isFinite(Date.parse(createdAt)) || !maker.trim() || !blend.trim()) throw new Error('invalid_gallery_pack')
  const unknown = 'Not recorded in the shared label'
  const manifest: CellarPackManifest = {
    format: 'tin-to-cellar/cellarpack', schemaVersion: '0.1.0',
    packId: input.packId.startsWith('urn:uuid:') ? input.packId : `urn:uuid:${input.packId}`, createdAt,
    generator: { name: 'Tin to Cellar community pack exporter', version: '1.0.0' },
    labels: [{ id: 'shared-label', maker, blend, artworkAssetId: 'artwork',
      surface: { shape: m.surface.shape, finishedSize: { width: m.surface.finishedSize.width, height: m.surface.finishedSize.height, unit: m.surface.finishedSize.unit }, bleed: { top: m.surface.bleed.top, right: m.surface.bleed.right, bottom: m.surface.bleed.bottom, left: m.surface.bleed.left, unit: m.surface.bleed.unit }, safeInset: { top: m.surface.safeInset.top, right: m.surface.safeInset.right, bottom: m.surface.safeInset.bottom, left: m.surface.safeInset.left, unit: m.surface.safeInset.unit } },
      writeInAreas: [{ id: 'jarred-date', purpose: 'jarred-date', geometry: { shape: m.writeInArea.geometry.shape, x: m.writeInArea.geometry.x, y: m.writeInArea.geometry.y, width: m.writeInArea.geometry.width, height: m.writeInArea.geometry.height, ...(m.writeInArea.geometry.cornerRadius === undefined ? {} : { cornerRadius: m.writeInArea.geometry.cornerRadius }) }, background: { integratedInArtwork: true }, overlay: { mode: 'blank' } }],
      research: { status: 'limited', observedPackage: { format: m.package, variant: m.variant, variantDateOrEdition: m.edition || 'unknown' }, visualAnalysis: { palette: [unknown], motifs: [], border: unknown, typography: unknown, hierarchy: unknown, style: unknown },
        sources: m.references.length ? m.references.map((ref, index) => ({ id: `reference-${index + 1}`, type: 'user-provided' as const, role: ref.role, description: `Contributor-selected public package reference: ${ref.url}. No independent retrieval is claimed.`, receivedAt: createdAt })) : [{ id: 'contributor', type: 'user-provided', role: 'package-appearance', description: 'Contributor-supplied label; no public package reference was included.', receivedAt: createdAt }],
        adaptationSummary: 'Community-submitted jar label; private research was not included.', limitations: 'Gallery review does not certify the original AI research.' },
    }],
    assets: { artwork: { path: 'artwork/label.png', mediaType: 'image/png', pixelWidth: m.image.width, pixelHeight: m.image.height, sha256: await gallerySha256(artwork), colorSpace: 'sRGB', alpha: artwork[25] === 6 } },
    defaultPrintIntent: { sheetProfileId: 'tin-to-cellar:avery-94502@1', labelQuantityMode: 'one-each' },
  }
  const zip = new JSZip(), date = new Date('2000-01-01T00:00:00Z')
  zip.file('manifest.json', JSON.stringify(manifest, null, 2) + '\n', { date, createFolders: false })
  zip.file('artwork/label.png', artwork, { date, createFolders: false })
  return Uint8Array.from(await zip.generateAsync({ type: 'uint8array', compression: 'STORE', platform: 'DOS' }))
}
