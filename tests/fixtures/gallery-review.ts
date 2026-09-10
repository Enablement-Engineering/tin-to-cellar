import type { GalleryReviewRecord } from '../../src/lib/gallery/types'
export function reviewFixture(id = '11111111-1111-4111-8111-111111111111', blend = 'Blend A'): GalleryReviewRecord {
  return {
    id, state: 'pending', version: 2, expiresAt: '2026-10-01T00:00:00Z', deletionDue: null, digest: 'a'.repeat(64), publicationId: null,
    createdAt: '2026-09-01T12:00:00Z', maker: 'Maker', blend, mappingNeeded: false, canonicalHash: 'b'.repeat(64), metadataHash: 'c'.repeat(64), uploadedHash: 'd'.repeat(64), publishedIdentity: null,
    validation: { format: 'gallery-v2', geometry: 'circle-2.5', imageValidated: true, visualReviewRequired: true },
    metadata: { version: 2, submissionId: id, tobacco: { catalogId: 'cornell-and-diehl-briar-fox' }, artworkProfileId: 'circle-2.5@1', writingArea: { shape: 'rectangle', x: .3, y: .6, width: .4, height: .1 }, edition: blend, altText: `${blend} artwork`, evidence: { references: [{ url: 'https://example.org/fixture-product', role: 'package-appearance' }] }, image: { sha256: 'd'.repeat(64), bytes: 10000, width: 825, height: 825 }, acknowledgement: { version: '2026-09-06-v2', accepted: true } },
  }
}
