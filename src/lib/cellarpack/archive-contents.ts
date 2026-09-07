import type JSZip from 'jszip'
import { ARCHIVE_LIMITS, inspectZipCentralDirectory, looksLikeActiveContent, looksLikeNestedArchive } from './archive'
import { extractBounded, ExtractionLimitError } from './extraction'
import { hasFatal } from './issues'
import type { ValidationIssue } from './types'

export async function inspectEntryContents(
  inspectedEntries: ReturnType<typeof inspectZipCentralDirectory>['entries'],
  entries: Map<string, JSZip.JSZipObject>,
  contents: Map<string, Uint8Array>,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  let remaining = ARCHIVE_LIMITS.maxTotalUncompressedBytes as number
  for (const inspected of inspectedEntries) {
    if (inspected.directory) continue
    const entry = entries.get(inspected.normalizedName)
    if (!entry) continue
    try {
      const bytes = await extractBounded(entry, Math.min(inspected.uncompressedSize, remaining))
      remaining -= bytes.byteLength
      contents.set(inspected.normalizedName, bytes)
      if (looksLikeNestedArchive(bytes)) {
        issues.push({
          severity: 'fatal',
          code: 'NESTED_ARCHIVE_REJECTED',
          path: inspected.normalizedName,
          message: 'An archive was embedded inside the CellarPack under a disguised or nested filename.',
          recovery: 'Include supported files directly rather than nested archives.',
        })
      } else if (looksLikeActiveContent(bytes)) {
        issues.push({
          severity: 'fatal',
          code: 'ACTIVE_CONTENT_REJECTED',
          path: inspected.normalizedName,
          message: 'Active content was detected inside a CellarPack entry.',
          recovery: 'Remove scripts, executable files, SVG, HTML, PDF, or other active documents.',
        })
      }
    } catch (error) {
      issues.push({
        severity: 'fatal',
        code: error instanceof ExtractionLimitError ? 'ZIP_LIMIT_EXCEEDED' : 'INVALID_ZIP',
        path: inspected.normalizedName,
        message: 'A ZIP entry could not be decompressed safely.',
      })
    }
    if (hasFatal(issues)) return issues
  }
  return issues
}
