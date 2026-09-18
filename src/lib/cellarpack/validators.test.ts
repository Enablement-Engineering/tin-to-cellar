import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import schema from './cellarpack-v1.schema.json'
import { makeTestManifest } from './test-fixtures'
import { validateManifestSchema, validateAssetMapSchema, validateLabelSchema, validateAssetSchema } from './validators.generated.js'

// Compare against the former runtime compiler, including error order and details:
// partial imports depend on those errors to distinguish bad labels from bad roots.
const ajv = new Ajv2020({ allErrors: true, strict: false })
const reference = [
  ajv.compile(schema),
  ajv.compile({ ...schema.properties.assets, $defs: schema.$defs, additionalProperties: true }),
  ajv.compile({ $schema: schema.$schema, $defs: schema.$defs, ...schema.$defs.label }),
  ajv.compile({ $schema: schema.$schema, $defs: schema.$defs, ...schema.$defs.artworkAsset }),
]
const generated = [validateManifestSchema, validateAssetMapSchema, validateLabelSchema, validateAssetSchema]

describe('standalone CellarPack validation equivalence', () => {
  it('preserves valid, malformed and partially recoverable inputs and their errors', async () => {
    const manifest = await makeTestManifest()
    const label = manifest.labels[0]
    const asset = Object.values(manifest.assets)[0]
    const inputs: unknown[][] = [
      [manifest, null, {}, { ...manifest, labels: [label, { id: 'broken', maker: 42 }] }, { ...manifest, generator: null }, { ...manifest, packId: '💨'.repeat(300) }],
      [manifest.assets, {}, { 'bad/id': asset }, { 'asset-ok': { extra: 'allowed by partial import root check' } }, Object.fromEntries(Array.from({ length: 301 }, (_, i) => [`asset-${i}`, asset]))],
      [label, null, { ...label, maker: 42, blend: false }, { ...label, research: { invalid: true } }, { ...label, writeInAreas: [{ overlay: { mode: 'typed-date' } }] }],
      [asset, null, {}, { ...asset, path: '../escape.png', sha256: 'bad' }],
    ]
    inputs.forEach((values, index) => values.forEach(value => {
      expect(generated[index](value)).toBe(reference[index](value))
      expect(generated[index].errors).toEqual(reference[index].errors)
    }))
  })
})
