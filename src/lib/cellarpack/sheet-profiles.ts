import { getSheetProfile, isSheetProfile } from '../sheets'
import type { SheetProfile } from '../sheets'
import type { CellarPackManifest, ValidationIssue } from './types'

export function importCustomSheetProfiles(
  manifest: CellarPackManifest,
  entries: Map<string, Uint8Array>,
  issues: ValidationIssue[],
): SheetProfile[] {
  const profiles: SheetProfile[] = []
  for (const reference of manifest.customSheetProfiles ?? []) {
    const entry = entries.get(reference.path)
    if (!entry) {
      issues.push({
        severity: 'warning',
        code: 'INVALID_SHEET_PROFILE',
        path: reference.path,
        message: `Custom sheet profile ${reference.path} is missing.`,
      })
      continue
    }
    try {
      const bytes = entry
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      const value: unknown = JSON.parse(text)
      if (!isSheetProfile(value) || value.id !== reference.id) throw new TypeError('Invalid profile')
      profiles.push(value)
    } catch {
      issues.push({
        severity: 'warning',
        code: 'INVALID_SHEET_PROFILE',
        path: reference.path,
        message: `Custom sheet profile ${reference.path} is invalid or its ID does not match.`,
        recovery: 'Ask your AI chat to correct the custom sheet information in the pack.',
      })
    }
  }
  if (manifest.defaultPrintIntent && !getSheetProfile(manifest.defaultPrintIntent.sheetProfileId)) {
    const custom = profiles.some(
      (profile) => profile.id === manifest.defaultPrintIntent?.sheetProfileId,
    )
    if (!custom) {
      issues.push({
        severity: 'warning',
        code: 'UNKNOWN_PRINT_PRESET',
        path: 'defaultPrintIntent.sheetProfileId',
        message: `Print preset ${manifest.defaultPrintIntent.sheetProfileId} is not available.`,
        recovery: 'Ask your AI chat to correct the pack’s print preset.',
      })
    }
  }
  return profiles
}
