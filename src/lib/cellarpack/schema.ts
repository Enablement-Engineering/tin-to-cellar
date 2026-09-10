import Ajv2020 from 'ajv/dist/2020.js'
import type { ErrorObject } from 'ajv'
import schema from './cellarpack-v1.schema.json'
import type {
  ArtworkAsset,
  CellarLabel,
  CellarPackManifest,
  ManifestValidationResult,
  ValidationIssue,
} from './types'

const cellarPackSchema = schema as Record<string, unknown>
const ajv = new Ajv2020({ allErrors: true, strict: false })
const validate = ajv.compile<CellarPackManifest>(cellarPackSchema)

const labelSchema = (cellarPackSchema.$defs as Record<string, unknown>).label
const assetSchema = (cellarPackSchema.$defs as Record<string, unknown>).artworkAsset
const assetMapSchema = (cellarPackSchema.properties as Record<string, Record<string, unknown>>).assets
const validateAssetMap = ajv.compile({ ...assetMapSchema, $defs: cellarPackSchema.$defs, additionalProperties: true })
export const validateLabelSchema = ajv.compile<CellarLabel>({
  $schema: String(cellarPackSchema.$schema),
  $defs: cellarPackSchema.$defs,
  ...(labelSchema as Record<string, unknown>),
})
export const validateAssetSchema = ajv.compile<ArtworkAsset>({
  $schema: String(cellarPackSchema.$schema),
  $defs: cellarPackSchema.$defs,
  ...(assetSchema as Record<string, unknown>),
})

export function validateManifest(input: unknown): ManifestValidationResult {
  const preflightIssues = validateManifestPreflight(input)
  if (preflightIssues.some((issue) => issue.severity === 'fatal')) {
    return { valid: false, manifest: null, issues: preflightIssues }
  }

  const valid = validate(input)
  const schemaIssues = valid ? [] : ajvErrorsToIssues(validate.errors ?? [], input)
  const issues = [...preflightIssues, ...schemaIssues]
  return {
    valid: issues.every((issue) => issue.severity !== 'fatal' && issue.severity !== 'error'),
    manifest: valid ? input : null,
    issues,
  }
}

export function validateManifestWithAjv(input: unknown): {
  schemaValid: boolean
  errors: ErrorObject[]
} {
  const schemaValid = validate(input)
  return { schemaValid, errors: schemaValid ? [] : [...(validate.errors ?? [])] }
}

export function validateManifestPreflight(input: unknown): ValidationIssue[] {
  if (!isRecord(input)) {
    return [
      {
        severity: 'fatal',
        code: 'INVALID_MANIFEST_SCHEMA',
        path: '',
        message: 'The manifest root must be a JSON object.',
        recovery: 'Regenerate the pack with a manifest object at the archive root.',
      },
    ]
  }

  const issues: ValidationIssue[] = []
  if (input.format !== 'tin-to-cellar/cellarpack') {
    issues.push({
      severity: 'fatal',
      code: 'INVALID_MANIFEST_SCHEMA',
      path: 'format',
      message: 'The manifest format is not tin-to-cellar/cellarpack.',
      recovery: 'Use the CellarPack manifest format identifier.',
    })
  }

  if (typeof input.schemaVersion !== 'string') {
    issues.push({
      severity: 'fatal',
      code: 'INVALID_MANIFEST_SCHEMA',
      path: 'schemaVersion',
      message: 'The manifest must declare a semantic schemaVersion.',
      recovery: 'Set schemaVersion to 0.1.0.',
    })
  } else {
    const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(input.schemaVersion)
    if (!version) {
      issues.push({
        severity: 'fatal',
        code: 'INVALID_MANIFEST_SCHEMA',
        path: 'schemaVersion',
        message: 'schemaVersion is not a valid semantic version.',
        recovery: 'Set schemaVersion to 0.1.0.',
      })
    } else if (version[1] !== '1' && !(version[1] === '0' && version[2] === '1')) {
      issues.push({
        severity: 'fatal',
        code: 'UNSUPPORTED_SCHEMA_MAJOR',
        path: 'schemaVersion',
        message: `CellarPack schema major ${version[1]} is not supported.`,
        recovery: 'Open this pack in an importer that supports its schema major.',
      })
    }
  }
  return issues
}

export function ajvErrorsToIssues(errors: ErrorObject[], input: unknown): ValidationIssue[] {
  return errors.map((error) => {
    const labelId = labelIdForInstancePath(input, error.instancePath)
    return {
      severity: labelId ? 'error' : 'fatal',
      code: error.instancePath.includes('/research') ||
        (error.keyword === 'required' && error.params.missingProperty === 'research')
        ? 'MISSING_REQUIRED_RESEARCH'
        : 'INVALID_MANIFEST_SCHEMA',
      path: pointerToPath(error.instancePath),
      labelId,
      message: `Manifest ${error.instancePath || 'root'} ${error.message ?? 'is invalid'}.`,
      recovery: labelId
        ? 'Regenerate or correct this label entry.'
        : 'Regenerate the manifest using the bundled CellarPack 0.1 schema.',
    }
  })
}

function labelIdForInstancePath(input: unknown, pointer: string): string | undefined {
  const match = /^\/labels\/(\d+)(?:\/|$)/.exec(pointer)
  if (!match || !isRecord(input) || !Array.isArray(input.labels)) return undefined
  const candidate = input.labels[Number(match[1])]
  return isRecord(candidate) && typeof candidate.id === 'string'
    ? candidate.id
    : `label-${Number(match[1]) + 1}`
}

function pointerToPath(pointer: string): string {
  return pointer
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function validateRootShape(input: Record<string, unknown>): ValidationIssue[] {
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
  const valid = validate(candidate)
  if (valid) return []
  return (validate.errors ?? [])
    .filter((error) => !error.instancePath.startsWith('/labels') && !error.instancePath.startsWith('/assets'))
    .map((error) => ({
      severity: 'fatal' as const,
      code: 'INVALID_MANIFEST_SCHEMA' as const,
      path: pointerSuffix(error.instancePath).replace(/^\./, ''),
      message: `Manifest root ${error.message ?? 'is invalid'}.`,
      recovery: 'Regenerate the pack using the published CellarPack v1 schema.',
    }))
}

export function ajvLabelErrors(
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


export function pointerSuffix(pointer: string): string {
  const path = pointerToPath(pointer)
  return path ? `.${path}` : ''
}
