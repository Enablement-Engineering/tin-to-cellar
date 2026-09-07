import { expect, it, vi } from 'vitest'
import { knownCatalogSourceUrl, parseContribution, parseSharedContribution, parseSharedSource, parseSource, SOURCE_KEY, toSharedContribution, type Contribution, type SourceObservation } from './index'
import { TOBACCO_CATALOG } from '../tobacco-catalog'
import { collectionFixture } from '../collection/test-fixtures'
import { applyImport, assertCollection, createCollection, planImport, prepareImport } from '../collection'

vi.mock('../tobacco-catalog/identities.json', async importOriginal => {
  const original = await importOriginal<{ default: { entries: unknown[]; idAliases: unknown[] } }>()
  return { default: { ...original.default, idAliases: [...original.default.idAliases, { aliasId: 'historical-blue', catalogId: '1839-blue' }] } }
})
const entry = TOBACCO_CATALOG[0]
const source: SourceObservation = { catalogId: entry.id, url: entry.sourceUrl, status: 'valid', package: 'tin', variant: 'current' }
const unknown = { ...source, url: 'https://retailer.com/orders/private-customer' }
const legacy: Contribution = { version: 1, submissionId: 'a'.repeat(64), feedback: null, sources: [unknown, source] }

it('shares exact catalog URLs and resolves historical catalog IDs', () => {
  expect(parseSharedSource(source)).toEqual(source)
  expect(parseSharedSource({ ...source, catalogId: 'historical-blue' })).toEqual(source)
  for (const url of [unknown.url, `${entry.sourceUrl}?token=secret`, `${entry.sourceUrl}#private`, `${entry.sourceUrl}/private-customer`, 'https://other-retailer.com/item']) {
    expect(knownCatalogSourceUrl(entry.id, url)).toBe(false)
    expect(parseSharedSource({ ...source, url })).toBeNull()
  }
  expect(knownCatalogSourceUrl('unknown-blend', entry.sourceUrl)).toBe(false)
})

it('rejects unknown URLs at ingestion but filters persisted retries without changing local receipts', () => {
  const before = structuredClone(legacy)
  expect(parseSource(unknown)).toEqual(unknown)
  expect(parseContribution(legacy)).toEqual(legacy)
  expect(parseSharedContribution(legacy)).toBeNull()
  expect(toSharedContribution(legacy)).toEqual({ ...legacy, sources: [source] })
  expect(toSharedContribution({ ...legacy, sources: [unknown] })).toBeNull()
  expect(legacy).toEqual(before)
})

it('keeps legacy source metadata in saved artwork identity while excluding it from sharing', async () => {
  const result = await collectionFixture(manifest => {
    Object.assign(manifest.labels[0], { maker: entry.maker, blend: entry.blend, extensions: { [SOURCE_KEY]: [unknown] } })
  })
  const candidate = await prepareImport(result, { origin: 'local', contribution: legacy })
  expect(candidate.designs[0].item.label.extensions?.[SOURCE_KEY]).toEqual([unknown])
  const empty = createCollection()
  const saved = applyImport(empty, planImport(empty, candidate))
  expect(() => assertCollection(saved)).not.toThrow()
  expect(saved.receipts[0].contribution).toEqual(legacy)
  const next = await prepareImport(result, { origin: 'local', contribution: toSharedContribution(legacy) })
  expect(next.designs[0].fingerprint).toBe(candidate.designs[0].fingerprint)
  expect(planImport(saved, next).entries[0].kind).toBe('duplicate')
})
