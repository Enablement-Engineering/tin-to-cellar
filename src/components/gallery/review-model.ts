import type { GalleryLabelDraft, GalleryReviewRecord } from '../../lib/gallery/types'
import { galleryCatalogId } from '../../lib/gallery/schema'
import { TOBACCO_CATALOG } from '../../lib/tobacco-catalog'

export const MAX_REVIEW_BATCH = 24
export type ReviewAction = 'save' | 'approve' | 'reject' | 'republish' | 'unpublish' | 'refresh'
export type ReviewFilters = { state: string; search: string; mappingNeeded: boolean }
export const initialFilters: ReviewFilters = { state: 'pending', search: '', mappingNeeded: false }
export function reviewName(record: GalleryReviewRecord) {
  const tobacco = record.metadata?.tobacco
  const catalog = tobacco && 'catalogId' in tobacco ? TOBACCO_CATALOG.find(item => item.id === tobacco.catalogId) : null
  const maker = record.maker ?? catalog?.maker ?? (tobacco && 'maker' in tobacco ? tobacco.maker : '')
  const blend = record.blend ?? catalog?.blend ?? (tobacco && 'blend' in tobacco ? tobacco.blend : record.id)
  return `${maker} ${blend}`.trim()
}
export function reviewQuery(filters: ReviewFilters, cursor?: string) {
  return new URLSearchParams({ state: filters.state, ...(filters.search ? { search: filters.search } : {}), ...(filters.mappingNeeded ? { mappingNeeded: 'true' } : {}), ...(cursor ? { cursor } : {}) })
}
export function matchesReview(record: GalleryReviewRecord, filters: ReviewFilters) {
  return record.state === filters.state && (!filters.mappingNeeded || record.mappingNeeded) && reviewName(record).toLowerCase().includes(filters.search.toLowerCase())
}
export function approvalBlocker(record: GalleryReviewRecord, draft: GalleryLabelDraft | null, imageReady: boolean, conflict = false) {
  if (conflict) return 'This submission changed. Reload it before reviewing again.'
  if (!draft) return 'Artwork and metadata are unavailable.'
  if (JSON.stringify(draft) !== JSON.stringify(record.metadata)) return 'Save corrections before approving.'
  if (!galleryCatalogId(draft)) return 'Choose a tobacco match before approving.'
  if (!record.digest) return 'This submission is not ready for approval. Reload its status.'
  if (!imageReady) return 'Waiting for the artwork to load. If it fails, reload the submission.'
  return ''
}
export function decisionBody(record: GalleryReviewRecord, action: ReviewAction, reason: string, draft?: GalleryLabelDraft | null) {
  return JSON.stringify({ expectedVersion: record.version, ...(action === 'save' ? { metadata: draft } : action === 'approve' ? { digest: record.digest } : action === 'reject' ? { reason } : {}) })
}
