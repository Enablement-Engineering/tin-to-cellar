import { TOBACCO_CATALOG, formatTobacco } from '../tobacco-catalog'
import { parseSource, type SourceObservation } from '../contributions'
import { normalizeTobaccos } from './assessment'
import type { PromptProjectInput } from './types'

export function requestedCatalogEntries(tobaccos: PromptProjectInput['tobaccos']) {
  const names = normalizeTobaccos(tobaccos).map(item => item.maker ? formatTobacco({ maker: item.maker, blend: item.blend }) : item.blend)
  return TOBACCO_CATALOG.filter(item => names.includes(formatTobacco(item))).slice(0, 100)
}

export async function loadSavedSources(tobaccos: PromptProjectInput['tobaccos'], signal: AbortSignal): Promise<SourceObservation[]> {
  const results = await Promise.all(requestedCatalogEntries(tobaccos).map(async entry => {
    try {
      const response = await fetch(`/api/labels/sources?catalogId=${encodeURIComponent(entry.id)}`, { signal })
      if (!response.ok) return []
      const data = await response.json()
      if (data?.catalogId !== entry.id || !Array.isArray(data.sources)) return []
      return data.sources.slice(0, 5).flatMap((item: Record<string, unknown>) => {
        if (!item || typeof item !== 'object') return []
        const { checkedAt: _checkedAt, ...observation } = item
        void _checkedAt
        const source = parseSource(observation)
        return source?.catalogId === entry.id && source.status === 'valid' ? [source] : []
      })
    } catch { return [] }
  }))
  return results.flat()
}
