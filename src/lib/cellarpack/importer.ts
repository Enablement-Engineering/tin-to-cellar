import Ajv2020 from 'ajv/dist/2020.js'
import type { ErrorObject } from 'ajv'
import JSZip from 'jszip'
import schemaText from './cellarpack-v1.schema.json?raw'
import { getSheetProfile, isSheetProfile } from '../sheets'
import type { SheetProfile } from '../sheets'
import {
  ARCHIVE_LIMITS,
  inspectZipCentralDirectory,
  looksLikeActiveContent,
  looksLikeNestedArchive,
  normalizeZipPath,
} from './archive'
import { validateSurfaceGeometry, validateWriteAreas } from './geometry'
import { parseImageMetadata, sha256Hex, validateImageEncoding, validateImageDecoding } from './image'
import { ajvErrorsToIssues, validateManifestPreflight, validateManifestWithAjv } from './schema'
import { extractBounded, ExtractionLimitError } from './extraction'
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

const cellarPackSchema = JSON.parse(schemaText) as Record<string, unknown>
const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateRoot = ajv.compile<CellarPackManifest>(cellarPackSchema)
const labelSchema = (cellarPackSchema.$defs as Record<string, unknown>).label
const assetSchema = (cellarPackSchema.$defs as Record<string, unknown>).artworkAsset
const assetMapSchema = (cellarPackSchema.properties as Record<string, Record<string, unknown>>).assets
const validateAssetMap = ajv.compile({ ...assetMapSchema, $defs: cellarPackSchema.$defs, additionalProperties: true })
const validateLabelSchema = ajv.compile<CellarLabel>({
  $schema: String(cellarPackSchema.$schema),
  $defs: cellarPackSchema.$defs,
  ...asRecord(labelSchema),
})
const validateAssetSchema = ajv.compile<ArtworkAsset>({
  $schema: String(cellarPackSchema.$schema),
  $defs: cellarPackSchema.$defs,
  ...asRecord(assetSchema),
})

const MAX_PIXELS_PER_IMAGE = 64_000_000
const MAX_PIXELS_PER_PACK = 250_000_000

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
    const manifestBytes = manifestEntry
    const manifestText = new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)
    manifestValue = JSON.parse(manifestText)
    if (jsonDepth(manifestValue) > 32) throw new TypeError('JSON depth exceeds limit')
  } catch {
    return rejected([
      ...initialIssues,
      {
        severity: 'fatal',
        code: 'INVALID_MANIFEST_JSON',
        path: 'manifest.json',
        message: 'manifest.json is not valid UTF-8 JSON within the supported depth limit.',
        recovery: 'Regenerate the manifest as UTF-8 JSON with nesting depth at most 32.',
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

  const customSheetProfiles = await importCustomSheetProfiles(manifest, contents, issues)
  if (manifest.defaultPrintIntent && !getSheetProfile(manifest.defaultPrintIntent.sheetProfileId)) {
    const custom = customSheetProfiles.some(
      (profile) => profile.id === manifest.defaultPrintIntent?.sheetProfileId,
    )
    if (!custom) {
      issues.push({
        severity: 'warning',
        code: 'UNKNOWN_PRINT_PRESET',
        path: 'defaultPrintIntent.sheetProfileId',
        message: `Print preset ${manifest.defaultPrintIntent.sheetProfileId} is not available.`,
        recovery: 'Choose another sheet profile in the print studio.',
      })
    }
  }
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

function validateRootShape(input: Record<string, unknown>): ValidationIssue[] {
  if (!Array.isArray(input.labels) || input.labels.length < 1 || input.labels.length > 100) {
    return [{
      severity: 'fatal',
      code: 'INVALID_MANIFEST_SCHEMA',
      path: 'labels',
      message: 'The manifest must contain between 1 and 100 labels.',
      recovery: 'Add at least one label or split an oversized project into multiple packs.',
    }]
  }
  if (!isRecord(input.assets) || Object.keys(input.assets).length < 1) {
    return [{
      severity: 'fatal',
      code: 'INVALID_MANIFEST_SCHEMA',
      path: 'assets',
      message: 'The manifest must contain an artwork asset map.',
      recovery: 'Declare the artwork files referenced by the labels.',
    }]
  }
  if (!validateAssetMap(input.assets)) {
    return (validateAssetMap.errors ?? []).map((error) => ({
      severity: 'fatal',
      code: 'INVALID_MANIFEST_SCHEMA',
      path: 'assets',
      message: `Artwork asset map ${error.message ?? 'is invalid'}.`,
      recovery: 'Use canonical asset IDs and no more than 300 assets.',
    }))
  }
  const candidate = { ...input, labels: [], assets: {} }
  const valid = validateRoot(candidate)
  if (valid) return []
  return (validateRoot.errors ?? [])
    .filter((error) => !error.instancePath.startsWith('/labels') && !error.instancePath.startsWith('/assets'))
    .map((error) => ({
      severity: 'fatal' as const,
      code: 'INVALID_MANIFEST_SCHEMA' as const,
      path: pointerSuffix(error.instancePath).replace(/^\./, ''),
      message: `Manifest root ${error.message ?? 'is invalid'}.`,
      recovery: 'Regenerate the pack using the published CellarPack v1 schema.',
    }))
}

function ajvLabelErrors(
  errors: ErrorObject[],
  label: unknown,
  index: number,
): ValidationIssue[] {
  const id = isRecord(label) && typeof label.id === 'string' ? label.id : `label-${index + 1}`
  return errors.map((error) => ({
    severity: 'error',
    code: error.instancePath.includes('/research') ||
      (error.keyword === 'required' && error.params.missingProperty === 'research')
      ? 'MISSING_REQUIRED_RESEARCH'
      : 'INVALID_MANIFEST_SCHEMA',
    path: `labels.${index}${pointerSuffix(error.instancePath)}`,
    labelId: id,
    message: `Label ${id} ${error.instancePath || 'entry'} ${error.message ?? 'is invalid'}.`,
    recovery: 'Regenerate or correct this label entry.',
  }))
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
  for (const duplicate of duplicateValues(label.research.sources.map((source) => source.id))) {
    issues.push({
      severity: 'error',
      code: 'DUPLICATE_ID',
      labelId: label.id,
      path: `labels.${label.id}.research.sources`,
      message: `Research source ID ${duplicate} is duplicated within the label.`,
    })
  }
  if (label.research.status === 'limited') {
    issues.push({
      severity: 'warning',
      code: 'LIMITED_RESEARCH',
      labelId: label.id,
      path: `labels.${label.id}.research.status`,
      message: 'Package research is limited; the artwork needs human fidelity review.',
    })
  }
  if (!label.research.sources.some((source) => source.role === 'package-appearance')) {
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

async function importArtwork(
  label: CellarLabel,
  assets: Record<string, ArtworkAsset>,
  entries: Map<string, Uint8Array>,
  issues: ValidationIssue[],
  remainingPixels: number,
) {
  const asset = assets[label.artworkAssetId]
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

async function inspectEntryContents(
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

async function importCustomSheetProfiles(
  manifest: CellarPackManifest,
  entries: Map<string, Uint8Array>,
  issues: ValidationIssue[],
): Promise<SheetProfile[]> {
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
        recovery: 'Correct the profile or choose a built-in sheet in the print studio.',
      })
    }
  }
  return profiles
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

function hasFatal(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'fatal')
}

function isBlocking(issue: ValidationIssue): boolean {
  return issue.severity === 'fatal' || issue.severity === 'error'
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

function toInches(value: number, unit: 'in' | 'mm'): number {
  return unit === 'in' ? value : value / 25.4
}

function jsonDepth(value: unknown, depth = 0): number {
  if (!value || typeof value !== 'object') return depth
  if (depth > 32) return depth
  const values = Array.isArray(value) ? value : Object.values(value)
  return values.reduce((maximum, child) => Math.max(maximum, jsonDepth(child, depth + 1)), depth)
}

function pointerSuffix(pointer: string): string {
  if (!pointer) return ''
  return `.${pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.')}`
}

function labelIdForRaw(value: unknown, index: number): string {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0
    ? value.id
    : `label-${index + 1}`
}

function deduplicateIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = [issue.severity, issue.code, issue.path, issue.labelId, issue.message].join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
