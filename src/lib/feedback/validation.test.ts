import { createHash } from 'node:crypto'
import Ajv from 'ajv'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import current from './schema.json'
import legacy from './legacy-schema.json'
import historical from './historical-schema.json'
import { validateCurrent, validateLegacy, validateHistorical } from './validators.generated.js'
import { collectionFeedback, storedFeedback } from '../contributions'
import { parseDiagnosticReport } from './validation'

const report = {
  format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '1.0.0',
  request: { labelCount: 2, shape: 'circle' }, outcome: 'partial',
  steps: [{ stage: 'research', status: 'passed', attempts: 1 }],
  issues: [{ code: 'other', stage: 'research', resolved: false }],
}
const fixtures = [report, { ...report, schemaVersion: '1.0.0', promptVersion: '2026-09-06.1' }, { ...report, schemaVersion: '2.0.0', protocolRevision: 4 }]
delete (fixtures[1] as Partial<typeof report>).protocolRevision

// Mutate each leaf and container, including omitted required fields and private
// additions at every object depth. This exercises every schema branch, not just
// a few handpicked report examples.
function mutations(value: unknown): unknown[] {
  const result: unknown[] = [null, true, false, {}, [], '', 'private@example.com', -1, 0, 1.5, 1000001, Infinity, NaN]
  if (Array.isArray(value)) {
    result.push(Array(51).fill(value[0]))
    value.forEach((item, index) => mutations(item).forEach(replacement => {
      const copy = [...value]; copy[index] = replacement; result.push(copy)
    }))
  } else if (value && typeof value === 'object') {
    result.push({ ...value, privateData: '/Users/person/private.txt' })
    for (const [key, child] of Object.entries(value)) {
      const missing = { ...value } as Record<string, unknown>; delete missing[key]; result.push(missing)
      mutations(child).forEach(replacement => result.push({ ...value, [key]: replacement }))
    }
  }
  return result
}

describe('shared standalone feedback validation', () => {
  it('matches strict AJV across every report field for all three contracts', () => {
    const ajv = new Ajv({ strict: true })
    const validators = [validateCurrent, validateLegacy, validateHistorical]
    ;[current, legacy, historical].forEach((schema, index) => {
      const reference = ajv.compile(schema)
      for (const fixture of fixtures) {
        for (const value of [fixture, ...mutations(fixture)]) {
          expect(validators[index](value), JSON.stringify(value)).toBe(reference(value))
        }
      }
    })
  })
  it('uses the same current and legacy admission boundary while historical data remains read-only', () => {
    for (const fixture of fixtures) for (const value of [fixture, ...mutations(fixture)]) {
      expect(collectionFeedback(value)).toEqual(parseDiagnosticReport(value))
    }
    expect(storedFeedback(fixtures[2])).toEqual(fixtures[2])
    expect(collectionFeedback(fixtures[2])).toBeNull()
    expect(storedFeedback({ ...fixtures[2], privateData: 'secret' })).toBeNull()
  })
  it('ships no dynamic compilation or AJV module dependency to either runtime', () => {
    const code = readFileSync(new URL('./validators.generated.js', import.meta.url), 'utf8')
    const digest = createHash('sha256')
    for (const file of ['schema', 'legacy-schema', 'historical-schema']) {
      digest.update(readFileSync(new URL(`./${file}.json`, import.meta.url), 'utf8'))
    }
    expect(code).toContain(`// Schema SHA-256: ${digest.digest('hex')}`)
    expect(code).not.toMatch(/\b(?:eval|Function|require)\s*\(/)
    expect(code).not.toMatch(/\bimport\s/)
  })
})
