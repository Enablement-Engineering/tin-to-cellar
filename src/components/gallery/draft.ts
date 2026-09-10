import type { ImportedCellarLabel } from '../../lib/cellarpack/types'
import { GALLERY_NOTICE_VERSION, GALLERY_ARTWORK_PROFILE, type GalleryLabelDraft, type GalleryEvidence, type GalleryReceipt } from '../../lib/gallery/types'
import { parseGalleryDraft, publicReference, gallerySurface, canonicalJson } from '../../lib/gallery/schema'
import { findExactTobacco } from '../../lib/tobacco-catalog'
export const SHARING_NOTICE = 'Your ZIP is read on this device. Only labels you choose to submit are uploaded for private review. Approved labels become public so others can download and print them for personal cellaring. Authorized review tools may inspect submitted artwork.'
export const ACKNOWLEDGEMENT = 'I created or generated these labels and agree to share them through Tin to Cellar for personal cellaring.'
export type Choice = { edition: string; package: NonNullable<GalleryEvidence['package']>; variant: NonNullable<GalleryEvidence['variant']>; description: string; references: string[] }
export type Attempt = { label: ImportedCellarLabel; draft: GalleryLabelDraft; key: string; receipt?: GalleryReceipt; error?: string; retryable?: boolean }
export const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
export function references(item: ImportedCellarLabel) { return (item.label.research?.sources ?? []).filter(source => source.type === 'web' && ['package-appearance', 'variant-identification'].includes(source.role) && publicReference(source.url)) }
export function initial(item: ImportedCellarLabel): Choice { return { edition: item.label.edition ?? '', package: 'unknown', variant: 'unknown', description: item.label.altText ?? '', references: [] } }
export async function buildDraft(item: ImportedCellarLabel, choice: Choice, submissionId: string): Promise<GalleryLabelDraft> {
  const l = item.label, match = findExactTobacco(l.maker, l.blend)
  const imageHash = hex(await crypto.subtle.digest('SHA-256', item.artwork.data))
  if (imageHash !== item.artwork.asset.sha256) throw new Error('Artwork no longer matches the validated ZIP. Import the original pack again before sharing.')
  const area = l.writeInAreas[0]
  if (item.artwork.mediaType !== 'image/png' || l.writeInAreas.length !== 1 || !area) throw new Error('Sharing supports PNG labels with one blank writing area. This label can still be printed locally.')
  const expected = gallerySurface()
  if (l.surface.shape !== expected.shape || canonicalJson(l.surface.finishedSize) !== canonicalJson(expected.finishedSize) || canonicalJson(l.surface.bleed) !== canonicalJson(expected.bleed) || canonicalJson(l.surface.safeInset) !== canonicalJson(expected.safeInset) || area.purpose !== 'jarred-date' || !area.background.integratedInArtwork || area.overlay.mode !== 'blank' || (area.geometry.rotationDegrees !== undefined && area.geometry.rotationDegrees !== 0)) throw new Error('Sharing requires the supported 2.5-inch circle and blank writing area. This label can still be printed locally.')
  const chosenReferences = references(item).filter(source => source.type === 'web' && choice.references.includes(source.url)).map(source => ({ url: source.type === 'web' ? source.url : '', role: source.role as 'package-appearance' | 'variant-identification' }))
  const evidence: GalleryEvidence = { ...(choice.package !== 'unknown' ? { package: choice.package } : {}), ...(choice.variant !== 'unknown' ? { variant: choice.variant } : {}), ...(chosenReferences.length ? { references: chosenReferences } : {}) }
  const { shape, x, y, width, height, cornerRadius } = area.geometry
  return parseGalleryDraft({
    version: 2, submissionId, tobacco: match ? { catalogId: match.id } : { maker: l.maker, blend: l.blend }, artworkProfileId: GALLERY_ARTWORK_PROFILE,
    writingArea: { shape, x, y, width, height, ...(cornerRadius !== undefined ? { cornerRadius } : {}) },
    ...(choice.edition.trim() ? { edition: choice.edition.trim() } : {}), ...(choice.description.trim() ? { altText: choice.description.trim() } : {}), ...(Object.keys(evidence).length ? { evidence } : {}),
    image: { sha256: imageHash, bytes: item.artwork.data.byteLength, width: item.artwork.pixelWidth, height: item.artwork.pixelHeight }, acknowledgement: { version: GALLERY_NOTICE_VERSION, accepted: true },
  })
}
