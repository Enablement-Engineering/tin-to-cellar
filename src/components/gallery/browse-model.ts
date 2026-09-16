import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { resolveTobaccoId, tobaccoSearchFields } from '../../lib/tobacco-catalog'
import { request } from './client'

export const normalizeSearch = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
export const blendKey = (label: Pick<GalleryPublicLabel, 'catalogId' | 'maker' | 'blend'>) => label.catalogId ? resolveTobaccoId(label.catalogId)?.id ?? label.catalogId : `${normalizeSearch(label.maker)}|${normalizeSearch(label.blend)}`

export function searchScore(label: GalleryPublicLabel, query: string): number {
  const needle = normalizeSearch(query)
  if (!needle) return 0
  const entry = resolveTobaccoId(label.catalogId)
  const fields = [...tobaccoSearchFields(label), ...(entry ? tobaccoSearchFields(entry) : []), label.edition ?? ''].map(normalizeSearch)
  if (fields.includes(needle)) return 0
  if (normalizeSearch(`${label.maker} ${label.blend}`) === needle) return 0
  const words = fields.join(' ').split(' ')
  return needle.split(' ').every(token => words.some(word => word.startsWith(token))) ? 1 : Infinity
}

/** Finish all metadata pages before reporting counts or absence of artwork. */
export async function loadBrowseLabels(signal: AbortSignal): Promise<GalleryPublicLabel[]> {
  const labels = new Map<string, GalleryPublicLabel>()
  let cursor: string | null = null
  do {
    signal.throwIfAborted()
    const page: { labels: GalleryPublicLabel[]; nextCursor: string | null; serving: boolean } = await request(`/browse${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) })
    if (!page.serving) throw new Error('The community library is unavailable right now. Please try again later.')
    if (!Array.isArray(page.labels) || !(page.nextCursor === null || typeof page.nextCursor === 'string') || (page.nextCursor !== null && page.nextCursor <= (cursor ?? ''))) throw new Error('The design list could not be loaded completely. Please try again.')
    for (const label of page.labels) labels.set(label.id, label)
    cursor = page.nextCursor
  } while (cursor)
  return [...labels.values()]
}

export type BrowseOrder = 'recent' | 'best' | 'az' | 'shuffle'
export function browseResults(labels: GalleryPublicLabel[], query: string, maker: string, selectedBlend: string | null, order: BrowseOrder, shuffled: string[]): GalleryPublicLabel[] {
  const ranks = new Map(shuffled.map((id, index) => [id, index]))
  return labels.filter(label => (!maker || label.maker === maker) && (selectedBlend ? blendKey(label) === selectedBlend : Number.isFinite(searchScore(label, query))))
    .sort((a, b) => (order === 'best' ? searchScore(a, query) - searchScore(b, query) : order === 'az' ? a.blend.localeCompare(b.blend) || a.maker.localeCompare(b.maker) : order === 'shuffle' ? (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0) : 0) || b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
}

export function shuffleIds(labels: GalleryPublicLabel[], random = Math.random): string[] {
  const ids = labels.map(label => label.id)
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]] }
  return ids
}
