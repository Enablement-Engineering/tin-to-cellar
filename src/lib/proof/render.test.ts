import { describe, expect, it } from 'vitest'
import { decode, encode } from 'fast-png'
import { proofGeometry, renderProof } from './render'

function fixture(size = 220) { return encode({ width: size, height: size, channels: 3, depth: 8, data: new Uint8Array(size * size * 3).fill(80) }) }
describe('review proof geometry', () => {
  it('places 2.5-inch trim and 2.25-inch safe circles on the 2.75-inch canvas without changing the original', async () => {
    const input = fixture(), original = input.slice()
    const proof = await renderProof(input)
    expect(proof.trimRadius).toBe(100)
    expect(proof.safeRadius).toBe(90)
    expect(input).toEqual(original)
    const image = decode(proof.png)
    const rgb = (x: number, y: number) => Array.from(image.data.slice((y * 220 + x) * 4, (y * 220 + x) * 4 + 3))
    expect(rgb(110, 110)).toEqual([80, 80, 80])
    expect(rgb(0, 0)).toEqual([192, 192, 192])
    expect(rgb(209, 110)).toEqual([0, 175, 220])
    expect(image.width).toBe(220)
  })
  it('uses actual physical geometry instead of hardcoded pixels', async () => {
    const proof = await renderProof(fixture(), { diameter: 3, bleed: 0.25, safe: 0.2 })
    expect(proof.trimRadius).toBeCloseTo(220 * 1.5 / 3.5)
    expect(proof.safeRadius).toBeCloseTo(220 * 1.3 / 3.5)
  })
  it('rejects invalid parameters and unsupported or corrupted files', async () => {
    for (const query of ['diameter=NaN', 'safe=2', 'bleed=-1', 'url=https://example.com', 'diameter=']) expect(() => proofGeometry(new URLSearchParams(query))).toThrow()
    await expect(renderProof(new Uint8Array(30))).rejects.toThrow()
    await expect(renderProof(fixture(64))).rejects.toThrow('128 to 2048')
    const corrupt = fixture(); corrupt[29] ^= 1
    await expect(renderProof(corrupt)).rejects.toThrow()
    const mismatch = fixture(); mismatch[19] = 200; mismatch[23] = 200
    await expect(renderProof(mismatch)).rejects.toThrow('expands beyond')
  })
})

it('bundles an Avery overlay with transparent safe interior and correctly placed trim', async () => {
  const { readFile } = await import('node:fs/promises')
  const image = decode(await readFile(new URL('../../../worker/avery-94502-proof-overlay.png', import.meta.url)))
  expect(image.width).toBe(1254)
  expect(image.height).toBe(1254)
  const pixel = (x: number, y: number) => Array.from(image.data.slice((y * 1254 + x) * 4, (y * 1254 + x) * 4 + 4))
  expect(pixel(627, 627)).toEqual([0, 0, 0, 0])
  expect(pixel(1196, 627)).toEqual([0, 175, 220, 255])
  expect(pixel(0, 0)).toEqual([240, 240, 240, 179])
})
