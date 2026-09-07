import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateManifest } from './schema'
import { makeTestManifest } from './test-fixtures'

describe('validateManifest', () => {
  it.each([undefined, 'one-each', 'fill-sheet'] as const)('accepts an omitted or supported quantity mode: %s', async mode => {
    const manifest = await makeTestManifest()
    manifest.defaultPrintIntent = { sheetProfileId: 'tin-to-cellar:avery-94502@1', ...(mode ? { labelQuantityMode: mode } : {}) }
    expect(validateManifest(manifest).valid).toBe(true)
  })

  it.each(['0.1.0', '1.2.0'])('rejects unknown optional enum values in supported version %s', async schemaVersion => {
    const manifest = await makeTestManifest()
    manifest.schemaVersion = schemaVersion
    Object.assign(manifest, { defaultPrintIntent: { sheetProfileId: 'tin-to-cellar:avery-94502@1', labelQuantityMode: 'future-mode' } })
    const result = validateManifest(manifest)
    expect(result.valid).toBe(false)
    expect(result.manifest).toBeNull()
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: 'fatal', code: 'INVALID_MANIFEST_SCHEMA', path: 'defaultPrintIntent.labelQuantityMode' }))
  })

  it('keeps the runtime schema identical to the published schema', () => {
    const runtimeSchema = readFileSync(new URL('./cellarpack-v1.schema.json', import.meta.url), 'utf8')
    const publishedSchema = readFileSync(new URL('../../../public/spec/cellarpack-v1.schema.json', import.meta.url), 'utf8')

    expect(JSON.parse(runtimeSchema)).toEqual(JSON.parse(publishedSchema))
  })

  it('returns a typed manifest for a conforming v1 object', async () => {
    const result = validateManifest(await makeTestManifest())

    expect(result.valid).toBe(true)
    expect(result.manifest?.format).toBe('tin-to-cellar/cellarpack')
  })

  it.each([
    { mode: 'typed-date' },
    { mode: 'write-in-line' },
    { mode: 'blank', label: 'JARRED' },
    { mode: 'blank', textColor: '#241D16' },
    { mode: 'blank', preferredAlignment: 'center' },
  ])('rejects unsupported overlay metadata: %j', async (overlay) => {
    const manifest = await makeTestManifest()
    Object.assign(manifest.labels[0].writeInAreas[0], { overlay })
    expect(validateManifest(manifest).valid).toBe(false)
  })

  it('rejects a rotated writing surface', async () => {
    const manifest = await makeTestManifest()
    Object.assign(manifest.labels[0].writeInAreas[0].geometry, { rotationDegrees: 12 })
    expect(validateManifest(manifest).valid).toBe(false)
  })

  it('rejects a label with missing mandatory research', async () => {
    const manifest = await makeTestManifest()
    const unsafeLabel = manifest.labels[0] as unknown as Record<string, unknown>
    delete unsafeLabel.research
    const result = validateManifest(manifest)

    expect(result.valid).toBe(false)
    expect(result.manifest).toBeNull()
    expect(result.issues.map((issue) => issue.code)).toContain('MISSING_REQUIRED_RESEARCH')
  })

  it('reports unsupported schema majors before schema compilation', async () => {
    const manifest = await makeTestManifest()
    manifest.schemaVersion = '3.0.0'
    const result = validateManifest(manifest)

    expect(result.valid).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain('UNSUPPORTED_SCHEMA_MAJOR')
  })
})
