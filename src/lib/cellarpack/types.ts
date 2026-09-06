import type { SheetProfile } from '../sheets/types'

export type PhysicalUnit = 'in' | 'mm'

export type LabelShape =
  | 'circle'
  | 'oval'
  | 'square'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'custom'

export interface PhysicalSize {
  width: number
  height: number
  unit: PhysicalUnit
}

export interface PhysicalInsets {
  top: number
  right: number
  bottom: number
  left: number
  unit: PhysicalUnit
}

export interface LabelSurface {
  shape: LabelShape
  finishedSize: PhysicalSize
  bleed: PhysicalInsets
  safeInset: PhysicalInsets
  cornerRadius?: number
}

export type WriteAreaShape = 'rectangle' | 'rounded-rectangle' | 'oval'

export interface NormalizedWriteAreaGeometry {
  shape: WriteAreaShape
  x: number
  y: number
  width: number
  height: number
  cornerRadius?: number
  rotationDegrees?: 0
}

export interface WriteInArea {
  id: string
  purpose: 'jarred-date'
  geometry: NormalizedWriteAreaGeometry
  background: {
    integratedInArtwork: boolean
    appearance?: string
    minimumContrastWithInk?: 'high' | 'medium' | 'low'
  }
  overlay: {
    mode: 'blank'
  }
}

export type ResearchSourceRole =
  | 'package-appearance'
  | 'variant-identification'
  | 'historical-context'
  | 'user-inspiration'

export interface WebResearchSource {
  id: string
  type: 'web'
  role: ResearchSourceRole
  url: string
  title: string
  retrievedAt: string
  publisher?: string
  notes?: string
}

export interface UserProvidedResearchSource {
  id: string
  type: 'user-provided'
  role: ResearchSourceRole
  description: string
  receivedAt: string
  originalFilename?: string
  notes?: string
}

export type ResearchSource = WebResearchSource | UserProvidedResearchSource

export interface LabelResearch {
  status: 'complete' | 'limited'
  observedPackage: {
    format: string
    variant: string
    variantDateOrEdition: string
  }
  visualAnalysis: {
    palette: string[]
    motifs: string[]
    border: string
    typography: string
    hierarchy: string
    style: string
  }
  sources: ResearchSource[]
  adaptationSummary: string
  limitations?: string
}

export interface CellarLabel {
  id: string
  maker: string
  blend: string
  displayName?: string
  artworkAssetId: string
  surface: LabelSurface
  writeInAreas: WriteInArea[]
  research: LabelResearch
  extensions?: Record<string, unknown>
}

export interface ArtworkAsset {
  path: string
  mediaType: 'image/png' | 'image/jpeg'
  pixelWidth: number
  pixelHeight: number
  sha256: string
  colorSpace: string
  alpha: boolean
}

export interface CellarPackManifest {
  format: 'tin-to-cellar/cellarpack'
  schemaVersion: string
  packId: string
  createdAt: string
  generator: {
    name: string
    version: string
    model?: string
    workflowUrl?: string
  }
  labels: CellarLabel[]
  assets: Record<string, ArtworkAsset>
  title?: string
  description?: string
  locale?: string
  defaultPrintIntent?: {
    sheetProfileId: string
    labelQuantityMode?: 'one-each' | 'fill-sheet'
  }
  customSheetProfiles?: Array<{
    id: string
    path: string
  }>
  extensions?: Record<string, unknown>
}

export type IssueSeverity = 'fatal' | 'error' | 'warning' | 'info'

export type CellarPackIssueCode =
  | 'INVALID_ZIP'
  | 'UNSAFE_ZIP_PATH'
  | 'ZIP_LIMIT_EXCEEDED'
  | 'DUPLICATE_ENTRY'
  | 'ENCRYPTED_ARCHIVE'
  | 'UNSUPPORTED_ZIP_ENTRY'
  | 'ACTIVE_CONTENT_REJECTED'
  | 'NESTED_ARCHIVE_REJECTED'
  | 'MISSING_MANIFEST'
  | 'INVALID_MANIFEST_JSON'
  | 'INVALID_MANIFEST_SCHEMA'
  | 'UNSUPPORTED_SCHEMA_MAJOR'
  | 'DUPLICATE_ID'
  | 'MISSING_ARTWORK'
  | 'ASSET_PATH_MISMATCH'
  | 'ASSET_HASH_MISMATCH'
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'IMAGE_DIMENSION_MISMATCH'
  | 'IMAGE_LIMIT_EXCEEDED'
  | 'ARTWORK_ASPECT_RATIO_MISMATCH'
  | 'INVALID_SURFACE_GEOMETRY'
  | 'WRITE_AREA_OUTSIDE_TRIM'
  | 'WRITE_AREA_OUTSIDE_SAFE_AREA'
  | 'MISSING_WRITE_AREA'
  | 'MISSING_REQUIRED_RESEARCH'
  | 'LIMITED_RESEARCH'
  | 'LOW_EFFECTIVE_PPI'
  | 'NON_PNG_ARTWORK'
  | 'UNSUPPORTED_COLOR_SPACE'
  | 'UNKNOWN_PRINT_PRESET'
  | 'INVALID_SHEET_PROFILE'
  | 'MISSING_PREVIEW'
  | 'UNKNOWN_ARCHIVE_ENTRY'
  | 'WRITE_SURFACE_VISUAL_REVIEW_NEEDED'
  | 'PROFILE_LABEL_MISMATCH'

export interface ValidationIssue {
  severity: IssueSeverity
  code: CellarPackIssueCode
  path?: string
  labelId?: string
  message: string
  recovery?: string
}

export interface ManifestValidationResult {
  valid: boolean
  manifest: CellarPackManifest | null
  issues: ValidationIssue[]
}

export interface ImportedArtwork {
  asset: ArtworkAsset
  data: ArrayBuffer
  mediaType: ArtworkAsset['mediaType']
  pixelWidth: number
  pixelHeight: number
}

export interface ImportedCellarLabel {
  id: string
  label: CellarLabel
  artwork: ImportedArtwork
  issues: ValidationIssue[]
}

export interface QuarantinedLabel {
  id: string
  label: CellarLabel | null
  issues: ValidationIssue[]
}

export interface CellarPackConformance {
  archive: 'conformant' | 'nonconformant'
  generator: 'conformant' | 'nonconformant' | 'not-evaluated'
  printReady: 'not-evaluated'
}

export interface CellarPackImportResult {
  status: 'rejected' | 'partial' | 'ready'
  manifest: CellarPackManifest | null
  labels: ImportedCellarLabel[]
  quarantinedLabels: QuarantinedLabel[]
  customSheetProfiles: SheetProfile[]
  issues: ValidationIssue[]
  conformance: CellarPackConformance
}
