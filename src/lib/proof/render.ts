import { decode, encode, hasPngSignature } from 'fast-png'

import { DEFAULT_PROOF_GEOMETRY, MAX_PROOF_BYTES, MAX_PROOF_SIZE, proofGeometry } from './geometry'
export { DEFAULT_PROOF_GEOMETRY, MAX_PROOF_BYTES, MAX_PROOF_SIZE, proofGeometry } from './geometry'

// Limit expansion before the decoder runs; discard ancillary metadata from review copies.
async function boundedPng(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length > MAX_PROOF_BYTES || bytes.length < 33 || !hasPngSignature(bytes)) throw new Error('Expected a PNG of at most 8 MiB.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const width = view.getUint32(16), height = view.getUint32(20)
  if (width !== height || width < 128 || width > MAX_PROOF_SIZE) throw new Error('Use a square PNG from 128 to 2048 pixels. Resize a review copy if needed; retain the original for printing.')
  if (bytes[24] !== 8 || ![2, 6].includes(bytes[25]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) throw new Error('Use a non-interlaced 8-bit RGB or RGBA PNG.')
  const kept = [bytes.slice(0, 8)], compressed: Uint8Array[] = []
  let offset = 8, ended = false, headers = 0
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    if (offset + length + 12 > bytes.length) throw new Error('Truncated PNG chunk.')
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (offset === 8 && (type !== 'IHDR' || length !== 13)) throw new Error('Invalid PNG header.')
    if (type === 'IHDR' && ++headers !== 1) throw new Error('Duplicate PNG header.')
    if (['acTL', 'fcTL', 'fdAT'].includes(type)) throw new Error('Animated PNGs are unsupported.')
    if (['IHDR', 'IDAT', 'IEND'].includes(type)) kept.push(bytes.slice(offset, offset + length + 12))
    else if (type[0] === type[0].toUpperCase() && type !== 'PLTE') throw new Error('Unsupported PNG chunk.')
    if (type === 'IDAT') compressed.push(bytes.slice(offset + 8, offset + 8 + length))
    offset += length + 12
    if (type === 'IEND') { ended = true; break }
  }
  if (!ended || !compressed.length || offset !== bytes.length) throw new Error('Incomplete PNG or trailing data.')
  const expected = height * (1 + width * (bytes[25] === 6 ? 4 : 3))
  const reader = new Blob(compressed as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate')).getReader()
  let expanded = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      expanded += value.length
      if (expanded > expected) { await reader.cancel(); throw new Error('PNG expands beyond its declared dimensions.') }
    }
  } finally { reader.releaseLock() }
  if (expanded !== expected) throw new Error('PNG pixel data does not match dimensions.')
  const result = new Uint8Array(kept.reduce((n, part) => n + part.length, 0))
  let pos = 0
  for (const part of kept) { result.set(part, pos); pos += part.length }
  return result
}

export async function renderProof(bytes: Uint8Array, geometry = DEFAULT_PROOF_GEOMETRY) {
  proofGeometry(new URLSearchParams(Object.entries(geometry).map(([key, value]) => [key, String(value)])))
  const png = decode(await boundedPng(bytes), { checkCrc: true })
  const size = png.width, center = size / 2
  const scale = size / (geometry.diameter + 2 * geometry.bleed)
  const trimRadius = geometry.diameter / 2 * scale
  const safeRadius = (geometry.diameter / 2 - geometry.safe) * scale
  const halfStroke = Math.max(1, size / 600)
  const out = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dst = (y * size + x) * 4, src = (y * size + x) * png.channels
    const alpha = png.channels === 4 ? Number(png.data[src + 3]) / 255 : 1
    for (let c = 0; c < 3; c++) out[dst + c] = Math.round(Number(png.data[src + c]) * alpha + 255 * (1 - alpha))
    out[dst + 3] = 255
    const radius = Math.hypot(x + 0.5 - center, y + 0.5 - center)
    if (radius > trimRadius) for (let c = 0; c < 3; c++) out[dst + c] = Math.round(out[dst + c] * 0.3 + 240 * 0.7)
    const trim = Math.abs(radius - trimRadius) <= halfStroke
    const safe = Math.abs(radius - safeRadius) <= halfStroke && Math.floor((Math.atan2(y + 0.5 - center, x + 0.5 - center) + Math.PI) * safeRadius / (halfStroke * 5)) % 2 === 0
    if (trim || safe) { out[dst] = trim ? 0 : 220; out[dst + 1] = trim ? 175 : 0; out[dst + 2] = trim ? 220 : 160 }
  }
  return { png: encode({ width: size, height: size, data: out, channels: 4, depth: 8 }), width: size, trimRadius, safeRadius }
}
