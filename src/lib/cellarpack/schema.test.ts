import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { validateManifest } from './schema'
import { makeTestManifest } from './test-fixtures'

describe('validateManifest', () => {
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
