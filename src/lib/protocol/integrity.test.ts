import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import metadata from './metadata.json'
import registry from './releases.json'
import { currentComponentIntegrity, verifyProtocolInstructions } from './integrity'

describe('protocol release integrity', () => {
  it('binds every immutable instruction body to its exact UTF-8 bytes', async () => {
    const releases = metadata.integrity.releases as Record<string, { files: Record<string, { sha256: string; bytes: number }> }>
    for (const [revision, release] of Object.entries(registry.releases)) {
      const expected = releases[revision].files['instructions.md']
      expect(expected.sha256).toBe(release.hashes['instructions.md'])
      expect(expected.bytes).toBe(new TextEncoder().encode(release.files['instructions.md']).byteLength)
      await expect(verifyProtocolInstructions(revision, release.files['instructions.md'])).resolves.toBeUndefined()
    }
  })

  it('rejects changed, truncated, and unregistered instruction bodies', async () => {
    const release = registry.releases[registry.current as keyof typeof registry.releases]
    await expect(verifyProtocolInstructions(registry.current, `${release.files['instructions.md']} `)).rejects.toThrow('integrity check')
    await expect(verifyProtocolInstructions(registry.current, release.files['instructions.md'].slice(0, -1))).rejects.toThrow('integrity check')
    await expect(verifyProtocolInstructions('99.99.99', release.files['instructions.md'])).rejects.toThrow('trusted release record')
    await expect(verifyProtocolInstructions('constructor', release.files['instructions.md'])).rejects.toThrow('trusted release record')
  })

  it('publishes integrity records for the current release components', () => {
    const current = registry.releases[registry.current as keyof typeof registry.releases]
    const components: Record<string, string> = {
      'instructions.md': current.files['instructions.md'],
      'local-proof.py': readFileSync(new URL('../prompt/local-proof.py', import.meta.url), 'utf8'),
      'cellarpack.schema.json': readFileSync(new URL('../cellarpack/cellarpack-v1.schema.json', import.meta.url), 'utf8'),
      'feedback.schema.json': readFileSync(new URL('../feedback/schema.json', import.meta.url), 'utf8'),
      'retrospective.schema.json': readFileSync(new URL('../feedback/retrospective.schema.json', import.meta.url), 'utf8'),
    }
    for (const [name, content] of Object.entries(components)) {
      expect(currentComponentIntegrity(name)).toEqual({
        sha256: createHash('sha256').update(content).digest('hex'),
        bytes: Buffer.byteLength(content, 'utf8'),
      })
    }
  })
})
