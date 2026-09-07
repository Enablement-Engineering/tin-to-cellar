import { it, expect, vi } from 'vitest'
import { encode } from 'fast-png'
import { buildGalleryPack } from '../../lib/gallery/pack'
import type { GalleryLabelDraftV1 } from '../../lib/gallery/types'
import { downloadPublishedPack } from './pack-builder'
const choices = [
  { id: '43649b43-8094-4a32-b5ee-8be75208fb63', maker: 'Maker', blend: 'One' },
  { id: '43649b43-8094-4a32-b5ee-8be75208fb64', maker: 'Maker', blend: 'Two' },
]
it('downloads a publication with exact artwork and validated geometry', async () => {
  const artwork = encode({ width: 825, height: 825, channels: 3, data: new Uint8Array(825 * 825 * 3).fill(240) })
  const metadata: GalleryLabelDraftV1 = { version: 1, submissionId: '43649b43-8094-4a32-b5ee-8be75208fb63', catalogId: 'synthetic', proposedIdentity: null, package: 'unknown', variant: 'unknown', edition: '', description: 'Original synthetic cream label', surface: { shape: 'circle', finishedSize: { width: 2.5, height: 2.5, unit: 'in' }, bleed: { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' }, safeInset: { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' } }, writeInArea: { id: 'private-id', purpose: 'jarred-date', geometry: { shape: 'rectangle', x: .35, y: .55, width: .3, height: .1 }, background: { integratedInArtwork: true }, overlay: { mode: 'blank' } }, references: [], image: { width: 825, height: 825, sha256: '0'.repeat(64), bytes: artwork.length }, acknowledgement: { version: '2026-09-06-v2', accepted: true } }

  const exports = await Promise.all(choices.map(choice => buildGalleryPack({metadata, ...choice, packId: choice.id, createdAt: '2026-09-06T00:00:00Z'}, artwork)))
  const fetcher = vi.fn(async (url: RequestInfo | URL) => new Response(Uint8Array.from(exports[choices.findIndex(c => String(url).includes(c.id))]).buffer))
  const publication = await downloadPublishedPack(choices[0], { fetcher })
  expect(await publication.file.arrayBuffer()).toEqual(Uint8Array.from(exports[0]).buffer)
  expect(publication.result.manifest?.labels[0].id).toBe('shared-label')
  expect(publication.result.labels[0].artwork.data).toEqual(Uint8Array.from(artwork).buffer)
  expect(publication.result.labels[0].label.surface).toEqual(metadata.surface)
  expect(publication.result.labels[0].label.writeInAreas[0].geometry).toEqual(metadata.writeInArea.geometry)
  expect(fetcher).toHaveBeenCalledOnce()
})
it('cancels an oversized single-publication stream before importing its bytes', async () => {
  const cancel = vi.fn()
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(20 * 1024 * 1024)) }, cancel })
  await expect(downloadPublishedPack(choices[0], { fetcher: vi.fn(async () => new Response(stream)) })).rejects.toThrow('too large')
  expect(cancel).toHaveBeenCalledOnce()
})
it('rejects unavailable or invalid publications instead of returning a partial pack', async () => {
  await expect(downloadPublishedPack(choices[0], { fetcher: vi.fn(async () => new Response('', {status: 404})) })).rejects.toThrow('could not be downloaded')
  await expect(downloadPublishedPack(choices[0], { fetcher: vi.fn(async () => new Response('invalid zip')) })).rejects.toThrow()
})
it('rejects malformed publication choices before fetching', async () => {
  const fetcher = vi.fn()
  await expect(downloadPublishedPack({...choices[0], id: '../private'}, { fetcher })).rejects.toThrow('Choose a valid')
  expect(fetcher).not.toHaveBeenCalled()
})
