import { it, expect, vi } from 'vitest'
import { encode } from 'fast-png'
import { buildGalleryPack } from '../../lib/gallery/pack'
import { gallerySurface } from '../../lib/gallery/schema'
import { reviewFixture } from '../../../tests/fixtures/gallery-review'
import { downloadPublishedPack } from './pack-builder'
const choices = [
  { id: '43649b43-8094-4a32-b5ee-8be75208fb63', maker: 'Maker', blend: 'One' },
  { id: '43649b43-8094-4a32-b5ee-8be75208fb64', maker: 'Maker', blend: 'Two' },
]
it('downloads a publication with exact artwork and validated geometry', async () => {
  const artwork = encode({ width: 825, height: 825, channels: 3, data: new Uint8Array(825 * 825 * 3).fill(240) })
  const metadata = reviewFixture(choices[0].id).metadata!
  metadata.image.bytes = artwork.length

  const exports = await Promise.all(choices.map(choice => buildGalleryPack({metadata, ...choice, packId: choice.id, createdAt: '2026-09-06T00:00:00Z'}, artwork)))
  const fetcher = vi.fn(async (url: RequestInfo | URL) => new Response(Uint8Array.from(exports[choices.findIndex(c => String(url).includes(c.id))]).buffer))
  const publication = await downloadPublishedPack(choices[0], { fetcher })
  expect(await publication.file.arrayBuffer()).toEqual(Uint8Array.from(exports[0]).buffer)
  expect(publication.result.manifest?.labels[0].id).toBe('shared-label')
  expect(publication.result.labels[0].artwork.data).toEqual(Uint8Array.from(artwork).buffer)
  expect(publication.result.labels[0].label.surface).toEqual(gallerySurface())
  expect(publication.result.labels[0].label.writeInAreas[0].geometry).toEqual(metadata.writingArea)
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
