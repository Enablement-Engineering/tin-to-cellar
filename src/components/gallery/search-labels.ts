import type { GalleryPublicLabel } from '../../lib/gallery/types'
import { request } from './client'

type LabelPage = { labels: GalleryPublicLabel[]; nextCursor: string | null }
export type ExactLabelPage = LabelPage & { serving: boolean }

// Shared across rows so a long order cannot open an unbounded request burst.
let activeLookups = 0
const lookupQueue: Array<() => void> = []
function lookupSlot(signal?: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const aborted = () => {
      const index = lookupQueue.indexOf(start)
      if (index >= 0) lookupQueue.splice(index, 1)
      reject(signal?.reason ?? new DOMException('Lookup cancelled.', 'AbortError'))
    }
    const start = () => {
      signal?.removeEventListener('abort', aborted)
      activeLookups++
      resolve(() => {
        activeLookups--
        lookupQueue.shift()?.()
      })
    }
    if (signal?.aborted) { aborted(); return }
    signal?.addEventListener('abort', aborted, { once: true })
    if (activeLookups < 4) start()
    else lookupQueue.push(start)
  })
}

/** Exact, independently paginated lookup; fuzzy discovery limits do not apply. */
export async function searchExactLabels(catalogId: string, cursor?: string, signal?: AbortSignal): Promise<ExactLabelPage> {
  if (!catalogId.trim() || catalogId.length > 200) throw new Error('Choose a blend before checking community designs.')
  const release = await lookupSlot(signal)
  try {
    signal?.throwIfAborted()
    const params = new URLSearchParams({ geometry: 'circle-2.5', catalogId, ...(cursor ? { cursor } : {}) })
    const timeout = AbortSignal.timeout(15000)
    const page = await request<ExactLabelPage>(`/labels?${params}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
    if (typeof page.serving !== 'boolean' || !Array.isArray(page.labels) || !(page.nextCursor === null || typeof page.nextCursor === 'string')) throw new Error('Community designs could not be checked. Please try again.')
    if (!page.serving) return { serving: false, labels: [], nextCursor: null }
    if (page.labels.some(label => label.catalogId !== catalogId)) throw new Error('Community designs did not match this blend. Please try again.')
    return page
  } finally { release() }
}

// null browses all blends; [] means the typed query has no matching suggestions.
export async function searchLabels(catalogIds: string[] | null, cursor?: string, signal?: AbortSignal): Promise<LabelPage> {
  const ids = catalogIds === null ? [''] : [...new Set(catalogIds)].slice(0, 8)
  const pages = await Promise.all(ids.map(catalogId => {
    const params = new URLSearchParams({ geometry: 'circle-2.5', ...(catalogId ? { catalogId } : {}), ...(cursor ? { cursor } : {}) })
    return request<LabelPage & { serving?: boolean }>(`/labels?${params}`, { signal })
  }))
  if (pages.some(page => page.serving === false)) throw new Error('The community library is unavailable right now. Please try again later.')
  // Each endpoint uses the same ascending ID cursor. Merge before taking a page
  // so designs from every matching blend remain reachable through More labels.
  const merged = [...new Map(pages.flatMap(page => page.labels).map(label => [label.id, label])).values()]
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const labels = merged.slice(0, 24)
  const more = merged.length > 24 || pages.some(page => page.nextCursor)
  return { labels, nextCursor: more && labels.length ? labels[labels.length - 1].id : null }
}
