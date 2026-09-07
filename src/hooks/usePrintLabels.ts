import { useEffect, useState } from 'react'
import type { Collection } from '../lib/collection'
import type { PrintLabel } from '../components/ui-model'

export function usePrintLabels(collection: Collection): { labels: PrintLabel[]; error: string } {
  const [labels, setLabels] = useState<PrintLabel[]>([])
  const [error, setError] = useState('')
  // Keep URLs stable across quantity/settings/receipt changes and navigation.
  const selected = collection.rows.map(row => `${row.id}:${row.designId ?? ''}`).join('|')
  useEffect(() => {
    const urls: string[] = []
    try {
      const next = collection.rows.flatMap(row => {
      const design = row.designId ? collection.designs[row.designId] : undefined
      if (!design) return []
      const item = design.item
      const imageUrl = URL.createObjectURL(new Blob([item.artwork.data], { type: item.artwork.mediaType }))
      urls.push(imageUrl)
      const surface = item.label.surface
      const ratio = (value: number, dimension: number) => (value * (surface.bleed.unit === 'mm' ? 1 / 25.4 : 1)) / (dimension * (surface.finishedSize.unit === 'mm' ? 1 / 25.4 : 1))
      return [{ id: row.id, maker: item.label.maker, blend: item.label.blend, imageUrl, imageFrame: {
        left: -ratio(surface.bleed.left, surface.finishedSize.width) * 100,
        top: -ratio(surface.bleed.top, surface.finishedSize.height) * 100,
        width: (1 + ratio(surface.bleed.left + surface.bleed.right, surface.finishedSize.width)) * 100,
        height: (1 + ratio(surface.bleed.top + surface.bleed.bottom, surface.finishedSize.height)) * 100,
      } }]
    })
      setLabels(next)
      setError('')
    } catch {
      // A partial projection has no registered effect cleanup yet.
      urls.forEach(url => URL.revokeObjectURL(url))
      urls.length = 0
      setLabels([])
      setError('Label previews could not be opened. Your saved labels are unchanged. Reload to try again.')
    }
    return () => urls.forEach(url => URL.revokeObjectURL(url))
    // Geometry is immutable for a design ID; quantities do not recreate artwork.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])
  return { labels, error }
}
