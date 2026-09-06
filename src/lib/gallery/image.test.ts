import { describe, it, expect } from 'vitest'
import { deflateSync } from "node:zlib"
import { encode, decode } from 'fast-png'
import { normalizeGalleryImage, pngCrc, gallerySha256 } from './image'
const pixels = () => { const data = new Uint8Array(825 * 825 * 4); for (let i = 0; i < data.length; i += 4) { data[i] = (i / 4) % 255; data[i + 1] = 71; data[i + 2] = 202; data[i + 3] = i % 12 ? 255 : 0 } return data }
export function syntheticArtwork() { return encode({ width: 825, height: 825, channels: 4, data: pixels() }) }
function addChunk(input: Uint8Array, type: string, data: Uint8Array) {
  const c = new Uint8Array(data.length + 12), view = new DataView(c.buffer)
  view.setUint32(0, data.length); c.set(new TextEncoder().encode(type), 4); c.set(data, 8); view.setUint32(c.length - 4, pngCrc(c.subarray(4, c.length - 4)))
  const out = new Uint8Array(input.length + c.length); out.set(input.subarray(0, 33)); out.set(c, 33); out.set(input.subarray(33), 33 + c.length); return out
}
describe('gallery PNG processing', () => {
  it('preserves every RGBA pixel including hidden RGB, strips text, declares sRGB, and produces alpha-aware thumbnail', async () => {
    const source = addChunk(syntheticArtwork(), 'tEXt', new TextEncoder().encode('private\0secret'))
    const result = await normalizeGalleryImage(source)
    expect(Array.from(decode(result.artwork).data)).toEqual(Array.from(pixels()))
    expect(new TextDecoder().decode(result.artwork)).not.toContain('secret')
    expect(new TextDecoder().decode(result.artwork.subarray(37, 41))).toBe('sRGB')
    const thumb = decode(result.thumbnail)
    expect(thumb.width).toBe(320); expect(thumb.height).toBe(320)
    expect(thumb.data[1]).toBe(71); expect(thumb.data[2]).toBe(202)
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
  })
  it('rejects corrupted CRC, animation, profiles, trailing data, excessive dimensions and truncated inflation', async () => {
    const png = syntheticArtwork(), corrupt = Uint8Array.from(png); corrupt[40] ^= 1
    const variants = [corrupt, addChunk(png, 'acTL', new Uint8Array(8)), addChunk(png, 'iCCP', Uint8Array.of(1)), addChunk(png, 'gAMA', Uint8Array.of(0,0,0,1)), new Uint8Array([...png, 0]), encode({ width: 1, height: 1, channels: 4, data: new Uint8Array(4) })]
    for (const v of variants) await expect(normalizeGalleryImage(v)).rejects.toThrow('unsupported_image')
    const wrongDimensions = Uint8Array.from(png), view = new DataView(wrongDimensions.buffer)
    view.setUint32(16, 826); view.setUint32(20, 826); view.setUint32(29, pngCrc(wrongDimensions.subarray(12,29)))
    await expect(normalizeGalleryImage(wrongDimensions)).rejects.toThrow('unsupported_image')
  })
})

it("rejects excess decompressed scanlines, invalid filters and appended zlib streams", async () => {
  const png = syntheticArtwork()
  for (const mode of ["excess", "filter", "trailing"]) {
    const raw = new Uint8Array(825 * (825 * 4 + 1) + (mode === "excess" ? 1 : 0))
    if (mode === "filter") raw[0] = 5
    let compressed = new Uint8Array(deflateSync(raw))
    if (mode === "trailing") compressed = new Uint8Array([...compressed, ...deflateSync(new Uint8Array(1))])
    const base = new Uint8Array(45); base.set(png.subarray(0, 33)); base.set(png.subarray(png.length - 12), 33)
    const crafted = addChunk(base, "IDAT", compressed)
    await expect(normalizeGalleryImage(crafted)).rejects.toThrow("unsupported_image")
  }
})
it('processes a maximum-size 2048px original fixture without pixel or dimension changes', async () => {
  const data = new Uint8Array(2048 * 2048 * 4)
  let seed = 123456789
  for (let i = 0; i < data.length; i += 4) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; data[i] = seed & 255; data[i + 1] = 80; data[i + 2] = 180; data[i + 3] = 255 }
  const input = encode({ width: 2048, height: 2048, channels: 4, data })
  expect(input.length).toBeLessThan(8 * 1024 * 1024)
  const start = performance.now(), output = await normalizeGalleryImage(input)
  const elapsed = performance.now() - start
  expect(await gallerySha256(new Uint8Array(decode(output.artwork).data.buffer))).toBe(await gallerySha256(data))
  expect(output.width).toBe(2048); expect(output.artwork.length).toBeLessThan(18 * 1024 * 1024)
  console.info(`gallery-max-image local elapsed=${Math.round(elapsed)}ms input=${input.length} canonical=${output.artwork.length} thumbnail=${output.thumbnail.length}`)
}, 15000)
