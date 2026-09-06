import { expect, it } from 'vitest'
import { collectionFeedback, contributionFromManifest, parseContribution, publicSourceUrl, SOURCE_KEY } from './index'
import { makeTestManifest } from '../cellarpack/test-fixtures'
import { TOBACCO_CATALOG, formatTobacco } from '../tobacco-catalog'
import { parseDiagnosticReport } from '../feedback'
import { buildTinToCellarPrompt, buildCompleteTinToCellarPrompt } from '../prompt'
const feedback = { format: 'tin-to-cellar/feedback', schemaVersion: '2.0.0', protocolRevision: 3, request: { labelCount: 1, shape: 'circle' }, outcome: 'complete', steps: [{ stage: 'research', status: 'passed', attempts: 1 }], issues: [] }
it('collects only fixed feedback and catalog-matched source observations', async () => {
  const manifest = await makeTestManifest()
  const tobacco = TOBACCO_CATALOG[0]
  manifest.extensions = { 'tin-to-cellar:feedback': feedback, 'tin-to-cellar:protocol': { revision: 3 } }
  Object.assign(manifest.labels[0], { maker: tobacco.maker, blend: tobacco.blend, extensions: { [SOURCE_KEY]: [
    { url: 'https://retailer.com/tin.png', status: 'valid', package: 'tin', variant: 'current' },
    { url: 'https://retailer.com/private.png?token=secret', status: 'valid', package: 'tin', variant: 'current' },
  ] } })
  manifest.labels[0].research.sources = [{ id: 'private', type: 'user-provided', role: 'package-appearance', receivedAt: 'today', description: 'Private address', originalFilename: 'private.png' }]
  manifest.labels[0].research.adaptationSummary = 'Private free text'
  const result = (await contributionFromManifest(manifest))!
  expect(result.sources).toEqual([{ catalogId: tobacco.id, url: 'https://retailer.com/tin.png', status: 'valid', package: 'tin', variant: 'current' }])
  expect(result.feedback).toEqual(feedback)
  expect(JSON.stringify(result)).not.toMatch(/Private|private|secret|artwork|packId|generator/)
  expect(parseContribution(result)).toEqual(result)
})
it('keeps old provenance unverified and skips custom names and conflicting feedback', async () => {
  const manifest = await makeTestManifest()
  expect(await contributionFromManifest(manifest)).toBeNull()
  Object.assign(manifest.labels[0], TOBACCO_CATALOG[0])
  manifest.extensions = { 'tin-to-cellar:feedback': feedback, 'tin-to-cellar:protocol': { revision: 2 } }
  const result = (await contributionFromManifest(manifest))!
  expect(result.feedback).toBeNull()
  expect(result.sources[0].status).toBe('unverified')
})
it('rejects unsafe links and fields at the server boundary', () => {
  for (const url of ['http://retailer.com/a', 'https://127.0.0.1/a', 'https://localhost/a', 'https://a.internal/a', 'https://user:pass@retailer.com/a', 'https://retailer.com/a?q=secret', 'https://retailer.com/a#secret', 'file:///a']) expect(publicSourceUrl(url)).toBe(false)
  expect(parseContribution({ version: 1, submissionId: 'a'.repeat(64), feedback, sources: [], email: 'private' })).toBeNull()
  expect(parseContribution({ version: 1, submissionId: 'a'.repeat(64), feedback: { ...feedback, notes: 'private' }, sources: [] })).toBeNull()
  expect(parseContribution({ version: 1, submissionId: 'a'.repeat(64), feedback: null, sources: [] })).toBeNull()
})
it('matches the existing strict feedback validator for invalid field shapes and bounds', () => {
  for (const candidate of [feedback, { ...feedback, protocolRevision: -1 }, { ...feedback, outcome: 'invented' }, { ...feedback, steps: [{ stage: 'research', status: 'passed', attempts: 2000 }] }, { ...feedback, request: { labelCount: 1, shape: 'circle', email: 'private' } }, { ...feedback, issues: [{ code: 'geometry', stage: 'proof', resolved: 'yes' }] }, null, {}]) {
    expect(collectionFeedback(candidate)).toEqual(parseDiagnosticReport(candidate))
  }
})
it('looks up known blend sources and asks for link revalidation without sending custom requests in URLs', () => {
  const entry = TOBACCO_CATALOG[0]
  const prompt = buildTinToCellarPrompt({ tobaccos: formatTobacco(entry) + '\nPrivate custom text' })
  expect(prompt).toContain(`/api/labels/sources?catalogId=${entry.id}`)
  expect(prompt).not.toContain('catalogId=Private')
  const complete = buildCompleteTinToCellarPrompt({ tobaccos: formatTobacco(entry) })
  expect(complete).toContain('wrong-package')
  expect(complete).toContain('Search only for missing')
  expect(complete).toContain('tin-to-cellar:sources')
})
it('rejects inherited-property names in diagnostic JSON', () => {
  const value = JSON.parse(JSON.stringify(feedback).replace('"request":{', '"request":{"__proto__":{"private":"secret"},'))
  expect(collectionFeedback(value)).toBeNull()
})
