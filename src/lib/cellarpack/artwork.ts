import { normalizeZipPath } from './archive'
import { parseImageMetadata, sha256Hex, validateImageEncoding, validateImageDecoding } from './image'
import { isBlocking } from './issues'
import type { ArtworkAsset, CellarLabel, ValidationIssue } from './types'

const MAX_PIXELS_PER_IMAGE = 64_000_000
export const MAX_PIXELS_PER_PACK = 250_000_000

export async function importArtwork(
  label: CellarLabel,
  assets: Record<string, ArtworkAsset>,
  entries: Map<string, Uint8Array>,
  issues: ValidationIssue[],
  remainingPixels: number,
) {
  const asset = Object.hasOwn(assets, label.artworkAssetId) ? assets[label.artworkAssetId] : undefined
  if (!asset) {
    issues.push(blocking('MISSING_ARTWORK', label.id, `Asset ${label.artworkAssetId} is not declared.`))
    return null
  }
  const normalized = normalizeZipPath(asset.path)
  if (!normalized.ok || !normalized.path.startsWith('artwork/')) {
    issues.push(blocking('ASSET_PATH_MISMATCH', label.id, 'Artwork must use a safe path beneath artwork/.'))
    return null
  }
  const entry = entries.get(normalized.path)
  if (!entry) {
    issues.push(blocking('MISSING_ARTWORK', label.id, `Artwork file ${normalized.path} is missing.`))
    return null
  }

  let data: ArrayBuffer
  try {
    data = Uint8Array.from(entry).buffer
  } catch {
    issues.push(blocking('MISSING_ARTWORK', label.id, `Artwork file ${normalized.path} could not be decoded.`))
    return null
  }
  const metadata = parseImageMetadata(data)
  if (!metadata) {
    issues.push(blocking('UNSUPPORTED_IMAGE_TYPE', label.id, 'Artwork is not a supported PNG or JPEG image.'))
    return null
  }
  issues.push(...validateImageEncoding(metadata, label.id))
  if (metadata.mediaType !== asset.mediaType) {
    issues.push(blocking('UNSUPPORTED_IMAGE_TYPE', label.id, 'Artwork signature does not match its declared media type.'))
  }
  if (metadata.width !== asset.pixelWidth || metadata.height !== asset.pixelHeight) {
    issues.push(blocking(
      'IMAGE_DIMENSION_MISMATCH',
      label.id,
      `Artwork is ${metadata.width}×${metadata.height}, but the manifest declares ${asset.pixelWidth}×${asset.pixelHeight}.`,
    ))
  }
  const pixelCount = metadata.width * metadata.height
  if (pixelCount > MAX_PIXELS_PER_IMAGE || metadata.width > 8192 || metadata.height > 8192) {
    issues.push(blocking('IMAGE_LIMIT_EXCEEDED', label.id, 'Artwork exceeds the 64-megapixel or 8192-pixel dimension limit.'))
  }
  if (pixelCount > remainingPixels) {
    issues.push(blocking('IMAGE_LIMIT_EXCEEDED', label.id, 'Artwork exceeds the remaining 250-megapixel pack budget.'))
  }
  if (!issues.some(isBlocking)) {
    try {
      await validateImageDecoding(data, metadata)
    } catch {
      issues.push(blocking('UNSUPPORTED_IMAGE_TYPE', label.id, 'Artwork cannot be decoded as a complete supported image.'))
    }
  }
  const actualHash = await sha256Hex(data)
  if (actualHash !== asset.sha256) {
    issues.push(blocking('ASSET_HASH_MISMATCH', label.id, 'Artwork SHA-256 does not match the manifest.'))
  }

  validateArtworkGeometry(label, metadata.width, metadata.height, issues)
  if (asset.mediaType !== 'image/png') {
    issues.push({
      severity: 'warning',
      code: 'NON_PNG_ARTWORK',
      labelId: label.id,
      message: 'JPEG artwork is importable but not Generator Conformant.',
      recovery: 'Export the artwork as an 8-bit sRGB PNG.',
    })
  }
  if (asset.colorSpace !== 'sRGB') {
    issues.push({
      severity: 'warning',
      code: 'UNSUPPORTED_COLOR_SPACE',
      labelId: label.id,
      message: `Artwork declares ${asset.colorSpace}; v1 print output expects sRGB.`,
      recovery: 'Convert and export the artwork in sRGB.',
    })
  }
  return {
    asset,
    data,
    mediaType: asset.mediaType,
    pixelWidth: metadata.width,
    pixelHeight: metadata.height,
  }
}

function validateArtworkGeometry(
  label: CellarLabel,
  pixelWidth: number,
  pixelHeight: number,
  issues: ValidationIssue[],
): void {
  const surface = label.surface
  const widthIn = toInches(surface.finishedSize.width, surface.finishedSize.unit)
  const heightIn = toInches(surface.finishedSize.height, surface.finishedSize.unit)
  const bleedWidthIn = toInches(surface.bleed.left + surface.bleed.right, surface.bleed.unit)
  const bleedHeightIn = toInches(surface.bleed.top + surface.bleed.bottom, surface.bleed.unit)
  const canvasWidth = widthIn + bleedWidthIn
  const canvasHeight = heightIn + bleedHeightIn
  const expectedRatio = canvasWidth / canvasHeight
  const actualRatio = pixelWidth / pixelHeight
  if (Math.abs(actualRatio / expectedRatio - 1) > 0.005) {
    issues.push(blocking(
      'ARTWORK_ASPECT_RATIO_MISMATCH',
      label.id,
      'Artwork aspect ratio does not match finished dimensions plus bleed.',
    ))
  }
  const ppi = Math.min(pixelWidth / canvasWidth, pixelHeight / canvasHeight)
  if (ppi < 300) {
    issues.push({
      severity: 'warning',
      code: 'LOW_EFFECTIVE_PPI',
      labelId: label.id,
      message: `Artwork is approximately ${Math.floor(ppi)} PPI; 300 PPI is the minimum.`,
      recovery: 'Regenerate or export a higher-resolution image.',
    })
  }
}

function blocking(
  code: ValidationIssue['code'],
  labelId: string,
  message: string,
): ValidationIssue {
  return {
    severity: 'error',
    code,
    labelId,
    message,
    recovery: 'Regenerate or repackage this label.',
  }
}

function toInches(value: number, unit: 'in' | 'mm'): number {
  return unit === 'in' ? value : value / 25.4
}
