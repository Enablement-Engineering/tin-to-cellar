import { encode } from 'fast-png'

const SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)
export const GALLERY_IMAGE_INPUT_LIMIT = 8 * 1024 * 1024
export const GALLERY_IMAGE_OUTPUT_LIMIT = 18 * 1024 * 1024
export async function gallerySha256(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes))), b => b.toString(16).padStart(2, '0')).join('')
}
function invalid(): never { throw new Error('unsupported_image') }
export function pngCrc(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) { crc ^= byte; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length + 12), view = new DataView(out.buffer)
  view.setUint32(0, data.length); out.set(new TextEncoder().encode(type), 4); out.set(data, 8)
  view.setUint32(data.length + 8, pngCrc(out.subarray(4, data.length + 8))); return out
}
function concatenate(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0)); let at = 0
  for (const p of parts) { out.set(p, at); at += p.length } return out
}
function encodeSrgb(width: number, height: number, data: Uint8Array, channels: number, intent = 0): Uint8Array<ArrayBuffer> {
  const encoded = encode({ width, height, data, channels, depth: 8 })
  return concatenate([encoded.subarray(0, 33), chunk('sRGB', Uint8Array.of(intent)), encoded.subarray(33)])
}
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}
/** Strict static PNG decode. Ancillary payloads are never decompressed or retained. */
export async function normalizeGalleryImage(input: Uint8Array) {
  if (input.length > GALLERY_IMAGE_INPUT_LIMIT || input.length < 57 || !SIGNATURE.every((b, i) => input[i] === b)) invalid()
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength)
  let at = 8, width = 0, height = 0, channels = 0, intent = 0, seenData = false, endedData = false, ended = false
  const dataParts: Uint8Array[] = [], seen = new Set<string>()
  while (at < input.length) {
    if (at + 12 > input.length) invalid()
    const length = view.getUint32(at), end = at + 12 + length
    if (end > input.length) invalid()
    const type = new TextDecoder().decode(input.subarray(at + 4, at + 8)), data = input.subarray(at + 8, end - 4)
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type) || pngCrc(input.subarray(at + 4, end - 4)) !== view.getUint32(end - 4)) invalid()
    if (at === 8 && type !== 'IHDR') invalid()
    if (type === 'IHDR') {
      if (seen.has(type) || length !== 13 || at !== 8) invalid()
      width = view.getUint32(at + 8); height = view.getUint32(at + 12)
      if (width < 825 || width > 2048 || width !== height || data[8] !== 8 || ![2, 6].includes(data[9]) || data[10] || data[11] || data[12]) invalid()
      channels = data[9] === 6 ? 4 : 3
    } else if (type === 'IDAT') {
      if (endedData) invalid()
      seenData = true; dataParts.push(data)
    } else if (type === 'IEND') {
      if (!seenData || length !== 0 || end !== input.length) invalid()
      ended = true
    } else {
      if (seenData) endedData = true
      if (['acTL', 'fcTL', 'fdAT', 'iCCP', 'cICP', 'mDCV', 'cLLI', 'tRNS'].includes(type)) invalid()
      if (type === 'sRGB') { if (seenData || seen.has(type) || length !== 1 || data[0] > 3) invalid(); intent = data[0] }
      else if (type === 'gAMA') { if (seenData || seen.has(type) || length !== 4 || view.getUint32(at + 8) !== 45455) invalid() }
      else if (type === 'cHRM') {
        const values = [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000]
        if (seenData || seen.has(type) || length !== 32 || values.some((v, i) => view.getUint32(at + 8 + i * 4) !== v)) invalid()
      } else if (type === 'PLTE') { if (seenData || seen.has(type) || !length || length % 3 || length > 768) invalid() }
      else if ((input[at + 4] & 32) === 0) invalid()
    }
    seen.add(type); at = end
  }
  if (!ended) invalid()
  // Untagged RGB PNG follows the application's sRGB submission contract. Explicit conflicting profiles are rejected above.
  const expected = height * (width * channels + 1), inflated = new Uint8Array(expected)
  const compressed = concatenate(dataParts)
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'))
  const reader = stream.getReader(); let written = 0
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; if (written + value.length > expected) { await reader.cancel(); invalid() } inflated.set(value, written); written += value.length }
  } catch { invalid() }
  if (written !== expected) invalid()
  const stride = width * channels, pixels = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (stride + 1)]; if (filter > 4) invalid()
    for (let x = 0; x < stride; x++) {
      const pos = y * stride + x, a = x >= channels ? pixels[pos - channels] : 0, b = y ? pixels[pos - stride] : 0, c = y && x >= channels ? pixels[pos - stride - channels] : 0
      pixels[pos] = inflated[y * (stride + 1) + x + 1] + (filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c))
    }
  }
  const artwork = encodeSrgb(width, height, pixels, channels, intent)
  if (artwork.length > GALLERY_IMAGE_OUTPUT_LIMIT) invalid()
  const size = 320, thumb = new Uint8Array(size * size * 4), scale = width / size
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let alpha = 0, red = 0, green = 0, blue = 0
    for (let sy = Math.floor(y * scale); sy < Math.ceil((y + 1) * scale); sy++) for (let sx = Math.floor(x * scale); sx < Math.ceil((x + 1) * scale); sx++) {
      const weight = (Math.min(sx + 1, (x + 1) * scale) - Math.max(sx, x * scale)) * (Math.min(sy + 1, (y + 1) * scale) - Math.max(sy, y * scale))
      const pos = (sy * width + sx) * channels, a = (channels === 4 ? pixels[pos + 3] : 255) * weight
      alpha += a; red += pixels[pos] * a; green += pixels[pos + 1] * a; blue += pixels[pos + 2] * a
    }
    const pos = (y * size + x) * 4
    thumb[pos] = alpha ? Math.round(red / alpha) : 0; thumb[pos + 1] = alpha ? Math.round(green / alpha) : 0; thumb[pos + 2] = alpha ? Math.round(blue / alpha) : 0; thumb[pos + 3] = Math.round(alpha / (scale * scale))
  }
  const thumbnail = encodeSrgb(size, size, thumb, 4, intent)
  return { artwork, thumbnail, sha256: await gallerySha256(artwork), thumbnailSha256: await gallerySha256(thumbnail), width, height, alpha: channels === 4 }
}
