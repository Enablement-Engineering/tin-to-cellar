import JSZip from 'jszip'
import { inspectZipCentralDirectory } from './archive'
import { validateSurfaceGeometry, validateWriteAreas } from './geometry'
import {
  ajvErrorsToIssues,
  validateManifestPreflight,
  validateManifestWithAjv,
  validateRootShape,
  validateLabelSchema,
  validateAssetSchema,
  ajvLabelErrors,
  pointerSuffix,
} from './schema'
import { importArtwork, MAX_PIXELS_PER_PACK } from './artwork'
import { importCustomSheetProfiles } from './sheet-profiles'
import { inspectEntryContents } from './archive-contents'
import { hasFatal, isBlocking, deduplicateIssues } from './issues'
import { parseArchiveJson } from './json'
import type {
  ArtworkAsset,
  CellarLabel,
  CellarPackConformance,
  CellarPackImportResult,
  CellarPackManifest,
  ImportedCellarLabel,
  QuarantinedLabel,
  ValidationIssue,
} from './types'

export async function importCellarPack(data: ArrayBuffer): Promise<CellarPackImportResult> {
  const inspection = inspectZipCentralDirectory(data)
  if (hasFatal(inspection.issues)) return rejected(inspection.issues)

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data, {
      checkCRC32: false,
      createFolders: false,
    })
  } catch {
    return rejected([
      ...inspection.issues,
      {
        severity: 'fatal',
        code: 'INVALID_ZIP',
        message: 'The ZIP archive could not be parsed.',
        recovery: 'Download or create the CellarPack again.',
      },
    ])
  }

  const entryMap = new Map<string, JSZip.JSZipObject>()
  for (const inspectedEntry of inspection.entries) {
    const entry = zip.file(inspectedEntry.rawName)
    if (entry) entryMap.set(inspectedEntry.normalizedName, entry)
  }

  const contents = new Map<string, Uint8Array>()
  const contentIssues = await inspectEntryContents(inspection.entries, entryMap, contents)
  const initialIssues = [...inspection.issues, ...contentIssues]
  if (hasFatal(initialIssues)) return rejected(initialIssues)

  const manifestEntry = contents.get('manifest.json')
  if (!manifestEntry) return rejected(initialIssues)

  let manifestValue: unknown
  try {
    manifestValue = parseArchiveJson(manifestEntry)
  } catch {
    return rejected([
      ...initialIssues,
      {
        severity: 'fatal',
        code: 'INVALID_MANIFEST_JSON',
        path: 'manifest.json',
        message: 'manifest.json must be valid UTF-8 JSON with unique object keys and nesting depth at most 32.',
        recovery: 'Regenerate the manifest with unique object keys and nesting depth at most 32.',
      },
    ])
  }

  const preflightIssues = validateManifestPreflight(manifestValue)
  if (hasFatal(preflightIssues)) {
    const schemaResult = validateManifestWithAjv(manifestValue)
    return rejected([...initialIssues, ...preflightIssues, ...ajvErrorsToIssues(schemaResult.errors, manifestValue)])
  }
  if (!isRecord(manifestValue)) return rejected([...initialIssues, ...preflightIssues])

  const rootShapeIssues = validateRootShape(manifestValue)
  if (hasFatal(rootShapeIssues)) {
    const schemaResult = validateManifestWithAjv(manifestValue)
    return rejected([...initialIssues, ...preflightIssues, ...rootShapeIssues, ...ajvErrorsToIssues(schemaResult.errors, manifestValue)])
  }

  const rawLabels = manifestValue.labels as unknown[]
  const rawAssets = manifestValue.assets as Record<string, unknown>
  const issues: ValidationIssue[] = [...initialIssues, ...preflightIssues, ...rootShapeIssues]
  const labelIssues = new Map<number, ValidationIssue[]>()
  const validatedLabels: Array<CellarLabel | null> = []

  rawLabels.forEach((label, index) => {
    if (validateLabelSchema(label)) {
      validatedLabels[index] = label
    } else {
      validatedLabels[index] = null
      const mapped = ajvLabelErrors(validateLabelSchema.errors ?? [], label, index)
      labelIssues.set(index, mapped)
      issues.push(...mapped)
    }
  })

  const assetValidationIssues = new Map<string, ValidationIssue[]>()
  const validatedAssets: Record<string, ArtworkAsset> = {}
  for (const [assetId, asset] of Object.entries(rawAssets)) {
    if (validateAssetSchema(asset)) {
      validatedAssets[assetId] = asset
    } else {
      const mapped = (validateAssetSchema.errors ?? []).map((error) => ({
        severity: 'error' as const,
        code: 'INVALID_MANIFEST_SCHEMA' as const,
        path: `assets.${assetId}${pointerSuffix(error.instancePath)}`,
        message: `Artwork asset ${assetId} ${error.message ?? 'is invalid'}.`,
        recovery: 'Correct the asset metadata and repackage the CellarPack.',
      }))
      assetValidationIssues.set(assetId, mapped)
      issues.push(...mapped)
    }
  }

  const duplicateLabelIds = duplicateValues(
    validatedLabels.flatMap((label) => (label ? [label.id] : [])),
  )
  for (const [index, label] of validatedLabels.entries()) {
    if (!label) continue
    const current = labelIssues.get(index) ?? []
    if (duplicateLabelIds.has(label.id)) {
      current.push({
        severity: 'error',
        code: 'DUPLICATE_ID',
        labelId: label.id,
        path: `labels.${index}.id`,
        message: `Label ID ${label.id} is duplicated.`,
        recovery: 'Assign a unique canonical ID to every label.',
      })
    }
    const assetIssues = assetValidationIssues.get(label.artworkAssetId)
    if (assetIssues) {
      current.push(...assetIssues.map((issue) => ({ ...issue, labelId: label.id })))
    }
    if (current.length > 0) labelIssues.set(index, current)
  }

  const manifest = {
    ...(manifestValue as unknown as CellarPackManifest),
    labels: validatedLabels.filter((label): label is CellarLabel => label !== null),
    assets: validatedAssets,
  }

  const importedLabels: ImportedCellarLabel[] = []
  const quarantinedLabels: QuarantinedLabel[] = []
  let totalPixels = 0

  for (const [index, label] of validatedLabels.entries()) {
    const currentIssues = [...(labelIssues.get(index) ?? [])]
    if (!label) {
      quarantinedLabels.push({
        id: labelIdForRaw(rawLabels[index], index),
        label: null,
        issues: currentIssues,
      })
      continue
    }
    if (currentIssues.some(isBlocking)) {
      issues.push(...currentIssues)
      quarantinedLabels.push({ id: label.id, label, issues: currentIssues })
      continue
    }

    currentIssues.push(...validateLabelSemantics(label))
    const artwork = await importArtwork(label, manifest.assets, contents, currentIssues, MAX_PIXELS_PER_PACK - totalPixels)
    if (artwork) totalPixels += artwork.pixelWidth * artwork.pixelHeight
    issues.push(...currentIssues)

    if (!artwork || currentIssues.some(isBlocking)) {
      quarantinedLabels.push({ id: label.id, label, issues: currentIssues })
    } else {
      importedLabels.push({ id: label.id, label, artwork, issues: currentIssues })
    }
  }

  if (totalPixels > MAX_PIXELS_PER_PACK) {
    issues.push({
      severity: 'fatal',
      code: 'IMAGE_LIMIT_EXCEEDED',
      message: 'Decoded artwork exceeds the 250-megapixel pack limit.',
      recovery: 'Reduce image dimensions or split the labels into multiple packs.',
    })
    return rejected(issues)
  }

  const customSheetProfiles = importCustomSheetProfiles(manifest, contents, issues)
  if (!entryMap.has('preview/contact-sheet.jpg') && !entryMap.has('preview/contact-sheet.jpeg')) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_PREVIEW',
      path: 'preview/contact-sheet.jpg',
      message: 'The optional contact-sheet preview is missing.',
    })
  }

  const allIssues = deduplicateIssues(issues)
  const conformance = determineConformance(importedLabels, quarantinedLabels, allIssues)
  return {
    status:
      quarantinedLabels.length > 0 || conformance.archive === 'nonconformant'
        ? 'partial'
        : 'ready',
    manifest,
    labels: importedLabels,
    quarantinedLabels,
    customSheetProfiles,
    issues: allIssues,
    conformance,
  }
}

function validateLabelSemantics(label: CellarLabel): ValidationIssue[] {
  const issues = [
    ...validateSurfaceGeometry(label.surface, label.id),
    ...validateWriteAreas(label.surface, label.writeInAreas, label.id),
  ]
  for (const duplicate of duplicateValues(label.writeInAreas.map((area) => area.id))) {
    issues.push({
      severity: 'error',
      code: 'DUPLICATE_ID',
      labelId: label.id,
      path: `labels.${label.id}.writeInAreas`,
      message: `Write-in area ID ${duplicate} is duplicated within the label.`,
    })
  }
  for (const duplicate of duplicateValues((label.research?.sources ?? []).map((source) => source.id))) {
    issues.push({
      severity: 'error',
      code: 'DUPLICATE_ID',
      labelId: label.id,
      path: `labels.${label.id}.research.sources`,
      message: `Research source ID ${duplicate} is duplicated within the label.`,
    })
  }
  if (label.research?.status === 'limited') {
    issues.push({
      severity: 'warning',
      code: 'LIMITED_RESEARCH',
      labelId: label.id,
      path: `labels.${label.id}.research.status`,
      message: 'Package research is limited; the artwork needs human fidelity review.',
    })
  }
  if (label.research && !label.research.sources.some((source) => source.role === 'package-appearance')) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_REQUIRED_RESEARCH',
      labelId: label.id,
      path: `labels.${label.id}.research.sources`,
      message: 'No source is identified as showing the actual package appearance.',
      recovery: 'Add a package-appearance source or mark the research as limited.',
    })
  }
  return issues
}

function determineConformance(
  labels: ImportedCellarLabel[],
  quarantined: QuarantinedLabel[],
  issues: ValidationIssue[],
): CellarPackConformance {
  const archiveConformant = quarantined.length === 0 && !issues.some(isBlocking)
  const generatorBlockingCodes = new Set([
    'LIMITED_RESEARCH',
    'LOW_EFFECTIVE_PPI',
    'NON_PNG_ARTWORK',
    'UNSUPPORTED_COLOR_SPACE',
    'MISSING_REQUIRED_RESEARCH',
    'WRITE_SURFACE_VISUAL_REVIEW_NEEDED',
  ])
  const generatorConformant =
    archiveConformant &&
    labels.length > 0 &&
    !issues.some((issue) => generatorBlockingCodes.has(issue.code))
  return {
    archive: archiveConformant ? 'conformant' : 'nonconformant',
    generator: generatorConformant ? 'conformant' : 'nonconformant',
    printReady: 'not-evaluated',
  }
}

function rejected(issues: ValidationIssue[]): CellarPackImportResult {
  return {
    status: 'rejected',
    manifest: null,
    labels: [],
    quarantinedLabels: [],
    customSheetProfiles: [],
    issues: deduplicateIssues(issues),
    conformance: {
      archive: 'nonconformant',
      generator: 'not-evaluated',
      printReady: 'not-evaluated',
    },
  }
}

function duplicateValues(values: string[]): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return duplicates
}

function labelIdForRaw(value: unknown, index: number): string {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0
    ? value.id
    : `label-${index + 1}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
