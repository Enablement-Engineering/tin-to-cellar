import type { ArtworkAsset, CellarPackIssueCode, ValidationIssue } from './types'

export interface ParsedImageMetadata {
  mediaType: ArtworkAsset['mediaType']
  width: number
  height: number
  alpha: boolean
  bitDepth?: number
  colorType?: number
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function parseImageMetadata(data: ArrayBuffer): ParsedImageMetadata | null {
  const bytes = new Uint8Array(data)
  if (isPng(bytes)) return parsePng(bytes)
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return parseJpeg(bytes)
  return null
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function validateImageEncoding(
  metadata: ParsedImageMetadata,
  labelId: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (metadata.mediaType === 'image/png') {
    if (metadata.bitDepth !== 8 || (metadata.colorType !== 2 && metadata.colorType !== 6)) {
      issues.push(imageIssue(
        'UNSUPPORTED_IMAGE_TYPE',
        labelId,
        'PNG artwork must be 8-bit RGB or RGBA, not grayscale or indexed color.',
      ))
    }
  }
  return issues
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 24 && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

function parsePng(bytes: Uint8Array): ParsedImageMetadata | null {
  if (bytes.byteLength < 29) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(8, false) !== 13 || view.getUint32(12, false) !== 0x49484452) return null
  const width = view.getUint32(16, false)
  const height = view.getUint32(20, false)
  const bitDepth = bytes[24]
  const colorType = bytes[25]
  if (width === 0 || height === 0) return null
  return {
    mediaType: 'image/png',
    width,
    height,
    alpha: colorType === 4 || colorType === 6,
    bitDepth,
    colorType,
  }
}

function parseJpeg(bytes: Uint8Array): ParsedImageMetadata | null {
  let offset = 2
  while (offset + 4 <= bytes.byteLength) {
    while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1
    if (offset >= bytes.byteLength) return null
    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd9 || marker === 0xda) return null
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.byteLength) return null
    const length = (bytes[offset] << 8) | bytes[offset + 1]
    if (length < 2 || offset + length > bytes.byteLength) return null
    if (isStartOfFrame(marker)) {
      if (length < 8) return null
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4]
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6]
      if (width === 0 || height === 0) return null
      return { mediaType: 'image/jpeg', width, height, alpha: false, bitDepth: bytes[offset + 2] }
    }
    offset += length
  }
  return null
}

function isStartOfFrame(marker: number): boolean {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)
}

function imageIssue(
  code: CellarPackIssueCode,
  labelId: string,
  message: string,
): ValidationIssue {
  return {
    severity: 'error',
    code,
    labelId,
    message,
    recovery: 'Regenerate the artwork as an 8-bit sRGB PNG.',
  }
}
