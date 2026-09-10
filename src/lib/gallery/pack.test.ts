import { it, expect } from 'vitest'
import { encode } from 'fast-png'
import JSZip from 'jszip'
import { buildGalleryPack } from './pack'
import { importCellarPack } from '../cellarpack/importer'
import { checkAvery94502Compatibility } from '../sheets/compatibility'
import type { GalleryLabelDraft } from './types'
it('reconstructs deterministic private-data-free CellarPack accepted by real importer and print geometry', async () => {
  const artwork = encode({ width: 825, height: 825, channels: 3, data: new Uint8Array(825 * 825 * 3).fill(240) })
  const metadata: GalleryLabelDraft = { version: 2, submissionId: '43649b43-8094-4a32-b5ee-8be75208fb63', tobacco: { catalogId: 'synthetic' }, artworkProfileId: 'circle-2.5@1', edition: '2026', altText: 'Original synthetic cream label', writingArea: { shape: 'rectangle', x: .35, y: .55, width: .3, height: .1 }, image: { width: 825, height: 825, sha256: '0'.repeat(64), bytes: artwork.length }, acknowledgement: { version: '2026-09-06-v2', accepted: true } }

  const input = { metadata, maker: 'Synthetic Maker', blend: 'Synthetic Blend', packId: '43649b43-8094-4a32-b5ee-8be75208fb63', createdAt: '2026-09-06T00:00:00Z' }
  const zip = await buildGalleryPack(input, artwork)
  expect(await buildGalleryPack(input, artwork)).toEqual(zip)
  const result = await importCellarPack(Uint8Array.from(zip).buffer)
  expect(result.issues.map(i => i.code)).not.toContain('UNKNOWN_PRINT_PRESET'); expect(result.status).toBe('ready'); expect(result.labels).toHaveLength(1)
  expect(checkAvery94502Compatibility(result.labels[0].label.surface).compatible).toBe(true)
  expect(result.labels[0].artwork.data).toEqual(Uint8Array.from(artwork).buffer)
  const manifest = await (await JSZip.loadAsync(zip)).file('manifest.json')!.async('string')
  expect(manifest).not.toContain('private note'); expect(manifest).not.toContain('private-id'); expect(manifest).not.toContain('acknowledgement')
  expect(result.labels[0].label.research).toBeUndefined()
  expect(result.labels[0].label.edition).toBe('2026')
  expect(result.labels[0].label.altText).toBe(metadata.altText)
})
