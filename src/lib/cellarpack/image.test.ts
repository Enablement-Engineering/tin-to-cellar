import { afterEach, describe, expect, it, vi } from 'vitest'
import { deflateSync } from 'node:zlib'
import { parseImageMetadata, validateImageDecoding } from './image'
import { testPng } from './test-fixtures'

function chunk(type: string, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(data.length + 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, data.length)
  bytes.set(new TextEncoder().encode(type), 4)
  bytes.set(data, 8)
  let crc = 0xffffffff
  for (const byte of bytes.subarray(4, bytes.length - 4)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0)
  return bytes
}

function pngWithScanline(raw: Uint8Array): ArrayBuffer {
  const header = testPng().slice(0, 33)
  const idat = chunk('IDAT', deflateSync(raw))
  const end = chunk('IEND', new Uint8Array())
  const bytes = new Uint8Array(header.length + idat.length + end.length)
  bytes.set(header); bytes.set(idat, header.length); bytes.set(end, header.length + idat.length)
  return bytes.buffer
}

async function decode(bytes: ArrayBuffer) {
  const metadata = parseImageMetadata(bytes)
  if (!metadata) throw new Error('Missing metadata')
  return validateImageDecoding(bytes, metadata)
}

afterEach(() => vi.unstubAllGlobals())

describe('complete artwork validation', () => {
  it('accepts complete PNG pixel data', async () => {
    await expect(decode(testPng().buffer)).resolves.toBeUndefined()
  })
  it('rejects a broken chunk checksum', async () => {
    const bytes = testPng()
    bytes[bytes.length - 1] ^= 1
    await expect(decode(bytes.buffer)).rejects.toThrow('checksum')
  })
  it('rejects invalid filters and incomplete or excessive scanline data', async () => {
    await expect(decode(pngWithScanline(new Uint8Array([5, 1, 2, 3, 4])))).rejects.toThrow('filter')
    await expect(decode(pngWithScanline(new Uint8Array([0, 1, 2])))).rejects.toThrow('Truncated')
    await expect(decode(pngWithScanline(new Uint8Array([0, 1, 2, 3, 4, 0])))).rejects.toThrow('Oversized')
  })
  it('rejects browser/header dimension disagreement and closes the bitmap', async () => {
    const close = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 2, height: 1, close }))
    await expect(decode(testPng().buffer)).rejects.toThrow('dimensions disagree')
    expect(close).toHaveBeenCalledOnce()
  })
  it('uses HTMLImageElement.decode when createImageBitmap is unavailable', async () => {
    const decodeImage = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('createImageBitmap', undefined)
    class FallbackImage {
      naturalWidth = 1
      naturalHeight = 1
      src = ''
      decode() { return decodeImage() }
    }
    vi.stubGlobal('Image', FallbackImage)
    await expect(decode(testPng().buffer)).resolves.toBeUndefined()
    expect(decodeImage).toHaveBeenCalledOnce()
  })
})
