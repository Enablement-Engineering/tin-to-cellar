import Ajv2020 from 'ajv/dist/2020.js'
import type { ErrorObject, ValidateFunction } from 'ajv'
import schemaText from './cellarpack-v1.schema.json?raw'
import type {
  CellarPackManifest,
  ManifestValidationResult,
  ValidationIssue,
} from './types'

const cellarPackSchema = JSON.parse(schemaText) as object
const ajv = new Ajv2020({ allErrors: true, strict: false })
const validate = ajv.compile(cellarPackSchema) as ValidateFunction<CellarPackManifest>

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
