import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { request } from './client'

type LabelPage = { labels: GalleryPublicLabel[]; nextCursor: string | null }

// null browses all blends; [] means the typed query has no matching suggestions.
export async function searchLabels(catalogIds: string[] | null, cursor?: string, signal?: AbortSignal): Promise<LabelPage> {
  const ids = catalogIds === null ? [''] : [...new Set(catalogIds)].slice(0, 8)
  const pages = await Promise.all(ids.map(catalogId => {
    const params = new URLSearchParams({ geometry: 'circle-2.5', ...(catalogId ? { catalogId } : {}), ...(cursor ? { cursor } : {}) })
    return request<LabelPage>(`/labels?${params}`, { signal })
  }))
  // Each endpoint uses the same ascending ID cursor. Merge before taking a page
  // so designs from every matching blend remain reachable through More labels.
  const merged = [...new Map(pages.flatMap(page => page.labels).map(label => [label.id, label])).values()]
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const labels = merged.slice(0, 24)
  const more = merged.length > 24 || pages.some(page => page.nextCursor)
  return { labels, nextCursor: more && labels.length ? labels[labels.length - 1].id : null }
}
