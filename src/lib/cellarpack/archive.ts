import type { ValidationIssue } from './types'

export const ARCHIVE_LIMITS = {
  maxCompressedBytes: 50 * 1024 * 1024,
  maxTotalUncompressedBytes: 200 * 1024 * 1024,
  maxArtworkUncompressedBytes: 80 * 1024 * 1024,
  maxEntries: 500,
  maxPathBytes: 240,
  maxPathDepth: 6,
  maxCompressionRatio: 100,
  maxManifestBytes: 2 * 1024 * 1024,
  maxSheetProfileBytes: 256 * 1024,
} as const

export interface InspectedZipEntry {
  rawName: string
  normalizedName: string
  directory: boolean
  compressedSize: number
  uncompressedSize: number
  compressionMethod: number
}

export interface ZipInspectionResult {
  entries: InspectedZipEntry[]
  issues: ValidationIssue[]
}

const ZIP_LOCAL_SIGNATURE = 0x04034b50
const ZIP_CENTRAL_SIGNATURE = 0x02014b50
const ZIP_EOCD_SIGNATURE = 0x06054b50
const ZIP64_EOCD_SIGNATURE = 0x06064b50
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50

const NESTED_ARCHIVE_EXTENSIONS = new Set([
  'zip',
  'cellarpack',
  '7z',
  'rar',
  'tar',
  'gz',
  'tgz',
  'bz2',
  'xz',
])

const ACTIVE_EXTENSIONS = new Set([
  'html',
  'htm',
  'svg',
  'js',
  'mjs',
  'cjs',
  'css',
  'wasm',
  'exe',
  'dll',
  'dylib',
  'sh',
  'bat',
  'cmd',
  'ps1',
  'app',
  'jar',
  'pdf',
  'docm',
  'xlsm',
  'pptm',
  'woff',
  'woff2',
  'ttf',
  'otf',
])

export function inspectZipCentralDirectory(data: ArrayBuffer): ZipInspectionResult {
  const issues: ValidationIssue[] = []
  const bytes = new Uint8Array(data)
  if (bytes.byteLength > ARCHIVE_LIMITS.maxCompressedBytes) {
    return {
      entries: [],
      issues: [limitIssue('The compressed archive exceeds the 50 MiB limit.')],
    }
  }
  if (bytes.byteLength < 22) return { entries: [], issues: [invalidZipIssue()] }

  const view = new DataView(data)
  const eocdOffset = findEndOfCentralDirectory(view)
  if (eocdOffset < 0) return { entries: [], issues: [invalidZipIssue()] }

  const diskNumber = view.getUint16(eocdOffset + 4, true)
  const centralDisk = view.getUint16(eocdOffset + 6, true)
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true)
  const totalEntries = view.getUint16(eocdOffset + 10, true)
  const centralSize = view.getUint32(eocdOffset + 12, true)
  const centralOffset = view.getUint32(eocdOffset + 16, true)
  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    totalEntries === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    return {
      entries: [],
      issues: [
        {
          severity: 'fatal',
          code: 'UNSUPPORTED_ZIP_ENTRY',
          message: 'Multipart and ZIP64 archives are not supported.',
          recovery: 'Create a standard single-part ZIP archive within the CellarPack limits.',
        },
      ],
    }
  }
  if (totalEntries > ARCHIVE_LIMITS.maxEntries) {
    return { entries: [], issues: [limitIssue('The archive contains more than 500 entries.')] }
  }
  if (centralOffset + centralSize > eocdOffset || centralOffset < 0) {
    return { entries: [], issues: [invalidZipIssue()] }
  }

  const decoder = new TextDecoder('utf-8', { fatal: true })
  const entries: InspectedZipEntry[] = []
  const normalizedNames = new Set<string>()
  let offset = centralOffset
  let totalCompressed = 0
  let totalUncompressed = 0
  let manifestCount = 0

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== ZIP_CENTRAL_SIGNATURE) {
      return { entries: [], issues: [invalidZipIssue()] }
    }
    const versionMadeBy = view.getUint16(offset + 4, true)
    const flags = view.getUint16(offset + 8, true)
    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const externalAttributes = view.getUint32(offset + 38, true)
    const entryEnd = offset + 46 + nameLength + extraLength + commentLength
    if (entryEnd > view.byteLength || nameLength === 0) {
      return { entries: [], issues: [invalidZipIssue()] }
    }

    if ((flags & 0x0001) !== 0) {
      issues.push({
        severity: 'fatal',
        code: 'ENCRYPTED_ARCHIVE',
        message: 'Encrypted ZIP entries are not supported.',
        recovery: 'Create an unencrypted CellarPack.',
      })
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      issues.push({
        severity: 'fatal',
        code: 'UNSUPPORTED_ZIP_ENTRY',
        message: `ZIP compression method ${compressionMethod} is not supported.`,
        recovery: 'Use stored or DEFLATE compression.',
      })
    }
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      issues.push({
        severity: 'fatal',
        code: 'UNSUPPORTED_ZIP_ENTRY',
        message: 'ZIP64 entries are not supported.',
        recovery: 'Create a standard ZIP within the CellarPack size limits.',
      })
    }

    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength)
    let rawName = ''
    try {
      if ((flags & 0x0800) === 0 && nameBytes.some((byte) => byte >= 0x80)) {
        throw new TypeError('Non-UTF-8 filename')
      }
      rawName = decoder.decode(nameBytes)
    } catch {
      issues.push({
        severity: 'fatal',
        code: 'UNSAFE_ZIP_PATH',
        message: 'Archive entry names must be valid UTF-8.',
        recovery: 'Repackage files with portable UTF-8 names.',
      })
      offset = entryEnd
      continue
    }

    const directory = rawName.endsWith('/') || (externalAttributes & 0x10) !== 0
    const normalized = normalizeZipPath(rawName, directory, nameLength)
    if (!normalized.ok) {
      issues.push({
        severity: 'fatal',
        code: 'UNSAFE_ZIP_PATH',
        path: rawName,
        message: normalized.message,
        recovery: 'Use relative portable paths without traversal, control characters, or backslashes.',
      })
      offset = entryEnd
      continue
    }

    const collisionKey = normalized.path.toLowerCase()
    if (normalizedNames.has(collisionKey)) {
      issues.push({
        severity: 'fatal',
        code: 'DUPLICATE_ENTRY',
        path: normalized.path,
        message: 'The archive contains duplicate names after Unicode and case normalization.',
        recovery: 'Give every archive entry a unique portable path.',
      })
    }
    normalizedNames.add(collisionKey)
    if (!directory && normalized.path === 'manifest.json') manifestCount += 1

    const platform = versionMadeBy >>> 8
    if (platform === 3) {
      const unixMode = externalAttributes >>> 16
      const fileType = unixMode & 0xf000
      if (fileType !== 0 && fileType !== 0x8000 && fileType !== 0x4000) {
        issues.push({
          severity: 'fatal',
          code: 'UNSUPPORTED_ZIP_ENTRY',
          path: normalized.path,
          message: 'Symlinks, devices, and other special ZIP entries are not supported.',
          recovery: 'Package regular files and directories only.',
        })
      }
    }

    if (!directory) {
      totalCompressed += compressedSize
      totalUncompressed += uncompressedSize
      const ratio = uncompressedSize / Math.max(1, compressedSize)
      if (ratio > ARCHIVE_LIMITS.maxCompressionRatio) {
        issues.push(limitIssue(`Entry ${normalized.path} exceeds the 100:1 decompression ratio limit.`))
      }
      if (
        normalized.path.startsWith('artwork/') &&
        uncompressedSize > ARCHIVE_LIMITS.maxArtworkUncompressedBytes
      ) {
        issues.push(limitIssue(`Artwork ${normalized.path} exceeds the 80 MiB entry limit.`))
      }
      if (
        normalized.path === 'manifest.json' &&
        uncompressedSize > ARCHIVE_LIMITS.maxManifestBytes
      ) {
        issues.push(limitIssue('manifest.json exceeds the 2 MiB limit.'))
      }
      if (
        normalized.path.startsWith('sheet-profiles/') &&
        uncompressedSize > ARCHIVE_LIMITS.maxSheetProfileBytes
      ) {
        issues.push(limitIssue(`Sheet profile ${normalized.path} exceeds the 256 KiB limit.`))
      }
      inspectEntryExtension(normalized.path, issues)
    }

    entries.push({
      rawName,
      normalizedName: normalized.path,
      directory,
      compressedSize,
      uncompressedSize,
      compressionMethod,
    })
    offset = entryEnd
  }

  if (manifestCount === 0) {
    issues.push({
      severity: 'fatal',
      code: 'MISSING_MANIFEST',
      message: 'manifest.json is missing from the archive root.',
      recovery: 'Place one manifest.json at the archive root.',
    })
  } else if (manifestCount > 1) {
    issues.push({
      severity: 'fatal',
      code: 'DUPLICATE_ENTRY',
      path: 'manifest.json',
      message: 'The archive contains more than one root manifest.',
    })
  }
  if (
    totalUncompressed > ARCHIVE_LIMITS.maxTotalUncompressedBytes ||
    totalUncompressed / Math.max(1, totalCompressed) > ARCHIVE_LIMITS.maxCompressionRatio
  ) {
    issues.push(limitIssue('The archive exceeds total decompression size or ratio limits.'))
  }
  return { entries, issues }
}

export function normalizeZipPath(
  rawName: string,
  directory = false,
  encodedByteLength = new TextEncoder().encode(rawName).byteLength,
): { ok: true; path: string } | { ok: false; message: string } {
  if (
    encodedByteLength > ARCHIVE_LIMITS.maxPathBytes ||
    rawName.startsWith('/') ||
    rawName.includes('\\') ||
    /^[A-Za-z]:/.test(rawName) ||
    Array.from(rawName).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return codePoint <= 0x1f || codePoint === 0x7f
    })
  ) {
    return { ok: false, message: `Unsafe archive path: ${rawName || '(empty)'}.` }
  }
  const withoutDirectorySlash = directory && rawName.endsWith('/') ? rawName.slice(0, -1) : rawName
  const normalized = withoutDirectorySlash.normalize('NFC')
  const parts = normalized.split('/')
  if (
    parts.length > ARCHIVE_LIMITS.maxPathDepth ||
    parts.some((part) => part === '' || part === '.' || part === '..')
  ) {
    return { ok: false, message: `Unsafe archive path: ${rawName || '(empty)'}.` }
  }
  return { ok: true, path: normalized }
}

export function looksLikeNestedArchive(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 4) return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const signature = view.getUint32(0, true)
  return (
    signature === ZIP_LOCAL_SIGNATURE ||
    signature === ZIP_EOCD_SIGNATURE ||
    signature === ZIP64_EOCD_SIGNATURE ||
    signature === ZIP64_LOCATOR_SIGNATURE ||
    (bytes[0] === 0x37 && bytes[1] === 0x7a && bytes[2] === 0xbc && bytes[3] === 0xaf) ||
    (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21)
  )
}

export function looksLikeActiveContent(bytes: Uint8Array): boolean {
  if (bytes.byteLength === 0) return false
  if (
    (bytes[0] === 0x4d && bytes[1] === 0x5a) ||
    (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) ||
    (bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) ||
    (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
  ) {
    return true
  }
  const prefix = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, Math.min(bytes.byteLength, 512)))
    .trimStart()
    .toLowerCase()
  return (
    prefix.startsWith('<!doctype html') ||
    prefix.startsWith('<html') ||
    prefix.startsWith('<svg') ||
    prefix.startsWith('<script') ||
    prefix.startsWith('#!/')
  )
}

function inspectEntryExtension(path: string, issues: ValidationIssue[]): void {
  const filename = path.split('/').at(-1) ?? path
  const extension = filename.includes('.') ? (filename.split('.').at(-1) ?? '').toLowerCase() : ''
  if (NESTED_ARCHIVE_EXTENSIONS.has(extension)) {
    issues.push({
      severity: 'fatal',
      code: 'NESTED_ARCHIVE_REJECTED',
      path,
      message: 'Nested archive entries are not permitted in a CellarPack.',
      recovery: 'Include the uncompressed supported assets directly in the pack.',
    })
  } else if (ACTIVE_EXTENSIONS.has(extension)) {
    issues.push({
      severity: 'fatal',
      code: 'ACTIVE_CONTENT_REJECTED',
      path,
      message: `Active or executable content (${extension}) is not permitted in a CellarPack.`,
      recovery: 'Remove scripts, active documents, fonts, and executable files.',
    })
  }
}

function findEndOfCentralDirectory(view: DataView): number {
  const minimum = Math.max(0, view.byteLength - 65_557)
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_EOCD_SIGNATURE) {
      const commentLength = view.getUint16(offset + 20, true)
      if (offset + 22 + commentLength === view.byteLength) return offset
    }
  }
  return -1
}

function invalidZipIssue(): ValidationIssue {
  return {
    severity: 'fatal',
    code: 'INVALID_ZIP',
    message: 'The file is not a well-formed standard ZIP archive.',
    recovery: 'Download or create the CellarPack again.',
  }
}

function limitIssue(message: string): ValidationIssue {
  return {
    severity: 'fatal',
    code: 'ZIP_LIMIT_EXCEEDED',
    message,
    recovery: 'Reduce the archive size, dimensions, entry count, or compression ratio.',
  }
}
