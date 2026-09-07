import { expect, it } from 'vitest'
import metadata from './metadata.json'
import registry from './releases.json'
import { isKnownProtocolRevision } from './index'
import { protocolInstructions } from './archive'
import { buildCellarPackRepairPrompt } from '../prompt/prompt'

it('recognizes every archived revision without substituting its instructions during repair', () => {
  expect(metadata.current).toBe(registry.current)
  expect(metadata.revisions).toEqual(Object.keys(registry.releases))
  for (const release of Object.values(registry.releases)) {
    expect(isKnownProtocolRevision(release.revision)).toBe(true)
    expect(protocolInstructions(release.revision)).toBe(release.files['instructions.md'])
    const repair = buildCellarPackRepairPrompt([{ message: 'Repair the fixture hash.' }], { status: 'known', revision: release.revision })
    expect(repair).toContain(release.files['instructions.md'])
  }
  expect(isKnownProtocolRevision('constructor')).toBe(false)
  expect(protocolInstructions('constructor')).toBe('')
  expect(protocolInstructions('99.99.99')).toBe('')
  expect(protocolInstructions()).toBe(registry.releases[registry.current as keyof typeof registry.releases].files['instructions.md'])
})
