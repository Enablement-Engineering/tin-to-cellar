// Fixed website observations only. Never serialize validator messages, paths, or IDs.
export const validationCodes = ['INVALID_ZIP', 'UNSAFE_ZIP_PATH', 'ZIP_LIMIT_EXCEEDED', 'DUPLICATE_ENTRY', 'ENCRYPTED_ARCHIVE', 'UNSUPPORTED_ZIP_ENTRY', 'ACTIVE_CONTENT_REJECTED', 'NESTED_ARCHIVE_REJECTED', 'MISSING_MANIFEST', 'INVALID_MANIFEST_JSON', 'INVALID_MANIFEST_SCHEMA', 'UNSUPPORTED_SCHEMA_MAJOR', 'DUPLICATE_ID', 'MISSING_ARTWORK', 'ASSET_PATH_MISMATCH', 'ASSET_HASH_MISMATCH', 'UNSUPPORTED_IMAGE_TYPE', 'IMAGE_DIMENSION_MISMATCH', 'IMAGE_LIMIT_EXCEEDED', 'ARTWORK_ASPECT_RATIO_MISMATCH', 'INVALID_SURFACE_GEOMETRY', 'WRITE_AREA_OUTSIDE_TRIM', 'WRITE_AREA_OUTSIDE_SAFE_AREA', 'MISSING_WRITE_AREA', 'MISSING_REQUIRED_RESEARCH', 'LIMITED_RESEARCH', 'LOW_EFFECTIVE_PPI', 'NON_PNG_ARTWORK', 'UNSUPPORTED_COLOR_SPACE', 'UNKNOWN_PRINT_PRESET', 'INVALID_SHEET_PROFILE', 'MISSING_PREVIEW', 'UNKNOWN_ARCHIVE_ENTRY', 'WRITE_SURFACE_VISUAL_REVIEW_NEEDED', 'PROFILE_LABEL_MISMATCH'] as const
export type WebsiteValidation = { version: '0.1.0'; outcome: 'ready' | 'partial' | 'rejected'; issues: Array<{ code: typeof validationCodes[number]; count: number }> }
export function websiteValidation(outcome: WebsiteValidation['outcome'], issues: Array<{ code: string }>): WebsiteValidation {
  return { version: '0.1.0', outcome, issues: validationCodes.flatMap(code => {
    const count = issues.filter(issue => issue.code === code).length
    return count ? [{ code, count: Math.min(count, 10000) }] : []
  }) }
}
export function parseWebsiteValidation(v: unknown): WebsiteValidation | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const r = v as Record<string, unknown>
  if (Object.keys(r).sort().join() !== 'issues,outcome,version' || r.version !== '0.1.0' || typeof r.outcome !== 'string' || !['ready', 'partial', 'rejected'].includes(r.outcome) || !Array.isArray(r.issues) || r.issues.length > validationCodes.length) return null
  const seen = new Set<string>()
  for (const item of r.issues) {
    if (!item || typeof item !== 'object' || Object.keys(item).sort().join() !== 'code,count' || !validationCodes.includes(item.code) || !Number.isInteger(item.count) || item.count < 1 || item.count > 10000 || seen.has(item.code)) return null
    seen.add(item.code)
  }
  return structuredClone(v) as WebsiteValidation
}
