import { it, expect, vi } from 'vitest'
import { encode } from 'fast-png'
import { buildGalleryPack } from '../../lib/gallery/pack'
import { importCellarPack } from '../../lib/cellarpack/importer'
import type { GalleryLabelDraftV1 } from '../../lib/gallery/types'
import { buildSelectedPack } from './pack-builder'
const choices = [
  { id: '43649b43-8094-4a32-b5ee-8be75208fb63', maker: 'Maker', blend: 'One' },
  { id: '43649b43-8094-4a32-b5ee-8be75208fb64', maker: 'Maker', blend: 'Two' },
]
it('combines exports with colliding IDs into an importable pack with exact artwork and geometry', async () => {
  const artwork = encode({ width: 825, height: 825, channels: 3, data: new Uint8Array(825 * 825 * 3).fill(240) })
  const metadata: GalleryLabelDraftV1 = { version: 1, submissionId: '43649b43-8094-4a32-b5ee-8be75208fb63', catalogId: 'synthetic', proposedIdentity: null, package: 'unknown', variant: 'unknown', edition: '', description: 'Original synthetic cream label', surface: { shape: 'circle', finishedSize: { width: 2.5, height: 2.5, unit: 'in' }, bleed: { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' }, safeInset: { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' } }, writeInArea: { id: 'private-id', purpose: 'jarred-date', geometry: { shape: 'rectangle', x: .35, y: .55, width: .3, height: .1 }, background: { integratedInArtwork: true }, overlay: { mode: 'blank' } }, references: [], image: { width: 825, height: 825, sha256: '0'.repeat(64), bytes: artwork.length }, acknowledgement: { version: '2026-09-06-v2', accepted: true } }

  const exports = await Promise.all(choices.map(choice => buildGalleryPack({metadata, ...choice, packId: choice.id, createdAt: '2026-09-06T00:00:00Z'}, artwork)))
  const fetcher = vi.fn(async (url: RequestInfo | URL) => new Response(Uint8Array.from(exports[choices.findIndex(c => String(url).includes(c.id))]).buffer))
  const file = await buildSelectedPack(choices, fetcher)
  const result = await importCellarPack(await file.arrayBuffer())
  expect(result.status).toBe('ready')
  expect(result.quarantinedLabels).toHaveLength(0)
  expect(result.labels.map(l => l.label.blend)).toEqual(['One', 'Two'])
  expect(new Set(result.labels.map(l => l.id)).size).toBe(2)
  for (const label of result.labels) {
    expect(label.artwork.data).toEqual(Uint8Array.from(artwork).buffer)
    expect(label.label.surface).toEqual(metadata.surface)
    expect(label.label.writeInAreas[0].geometry).toEqual(metadata.writeInArea.geometry)
  }
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[0][0]).toContain(choices[0].id)
})
it('rejects unavailable or invalid publications instead of returning a partial pack', async () => {
  await expect(buildSelectedPack(choices, vi.fn(async () => new Response('', {status: 404})))).rejects.toThrow('Your selection is saved')
  await expect(buildSelectedPack(choices, vi.fn(async () => new Response('invalid zip')))).rejects.toThrow()
})
it('rejects empty, duplicated, oversized and malformed selections before fetching', async () => {
  const fetcher = vi.fn()
  for (const selection of [[], [choices[0], choices[0]], Array(21).fill(choices[0]), [{...choices[0], id: '../private'}]]) await expect(buildSelectedPack(selection, fetcher)).rejects.toThrow('Choose between')
  expect(fetcher).not.toHaveBeenCalled()
})
