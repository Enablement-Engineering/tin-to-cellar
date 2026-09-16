import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { decodeArtifact, mergeAssets, prepareAssets, previousArtifacts, validateManifest } from './app-release.mjs'

const temps = []
afterEach(async () => { await Promise.all(temps.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const assetPath = 'assets/prompt-ABCDEFGH.js'
const checksum = value => createHash('sha256').update(value).digest('hex')
const manifestFor = (buildId = 'build-A', path = assetPath, text = 'export default 1') => ({ schema: 1, buildId, files: [{ path, size: Buffer.byteLength(text), sha256: checksum(text) }] })
async function workspace() {
  const dir = await mkdtemp(join(tmpdir(), 'app-release-test-'))
  temps.push(dir)
  await mkdir(join(dir, 'dist/assets'), { recursive: true })
  return dir
}
async function archive(manifest = manifestFor(), mutate = () => {}) {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify(manifest))
  zip.file(assetPath, 'export default 1')
  mutate(zip)
  return zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' })
}

describe('production build asset retention', () => {
  it('snapshots only fresh hashed files and keeps mutable public files out of the artifact', async () => {
    const dir = await workspace()
    await writeFile(join(dir, 'dist/app-version.json'), JSON.stringify({ buildId: 'build-A' }))
    await writeFile(join(dir, `dist/${assetPath}`), 'export default 1')
    await writeFile(join(dir, 'dist/assets/workbench.png'), 'mutable image')
    await writeFile(join(dir, 'dist/index.html'), 'current HTML')
    const manifest = await prepareAssets(join(dir, 'dist'), join(dir, 'artifact'))
    expect(manifest).toEqual(manifestFor())
    expect(await readdir(join(dir, 'artifact'))).toEqual(['assets', 'manifest.json'])
    const prior = { assets: new Map([['assets/oldchunk-IJKLMNOP.js', Buffer.from('old')]]) }
    await mergeAssets(join(dir, 'dist'), [prior])
    expect(await readdir(join(dir, 'artifact/assets'))).toEqual(['prompt-ABCDEFGH.js'])
    await expect(prepareAssets(join(dir, 'dist'), join(dir, 'artifact'))).rejects.toThrow()
  })

  it('rejects symlinks in the fresh asset generation', async () => {
    const dir = await workspace()
    await writeFile(join(dir, 'dist/app-version.json'), JSON.stringify({ buildId: 'build-A' }))
    await symlink('../app-version.json', join(dir, `dist/${assetPath}`))
    await expect(prepareAssets(join(dir, 'dist'), join(dir, 'artifact'))).rejects.toThrow('regular file')
  })

  it('validates artifact identity and bytes before exposing any merge files', async () => {
    const result = await decodeArtifact(await archive(), 'build-A')
    expect(result.assets.get(assetPath).toString()).toBe('export default 1')
    await expect(decodeArtifact(await archive(), 'build-B')).rejects.toThrow('identity')
    await expect(decodeArtifact(await archive(manifestFor(), zip => zip.file(assetPath, 'tampered')))).rejects.toThrow('checksum mismatch')
  })

  it('rejects unexpected files, traversal names and symlinks in archives', async () => {
    for (const mutate of [
      zip => zip.file('index.html', 'old app'),
      zip => zip.file('wrangler.jsonc', 'old config'),
      zip => zip.file('assets/plain.js', 'mutable'),
      zip => zip.file('../assets/escape-ABCDEFGH.js', 'bad'),
      zip => zip.file(assetPath, 'target', { unixPermissions: 0o120777 }),
    ]) await expect(decodeArtifact(await archive(manifestFor(), mutate))).rejects.toThrow()
  })

  it('rejects duplicate manifest paths, missing files and byte budgets', async () => {
    const duplicate = manifestFor()
    duplicate.files.push(duplicate.files[0])
    expect(() => validateManifest(duplicate)).toThrow('Duplicate')
    const oversized = manifestFor()
    oversized.files[0].size = 21 * 1024 * 1024
    expect(() => validateManifest(oversized)).toThrow('size')
    const total = manifestFor()
    total.files = Array.from({ length: 4 }, (_, index) => ({ ...total.files[0], path: `assets/chunk${index}-ABCDEFGH.js`, size: 20 * 1024 * 1024 }))
    expect(() => validateManifest(total)).toThrow('byte limit')
    await expect(decodeArtifact(await archive(manifestFor(), zip => zip.remove(assetPath)))).rejects.toThrow('match manifest')
  })

  it('retains identical hashed files and rejects collisions before writing any files', async () => {
    const dir = await workspace()
    await writeFile(join(dir, `dist/${assetPath}`), 'export default 1')
    const valid = await decodeArtifact(await archive())
    expect(await mergeAssets(join(dir, 'dist'), [valid])).toBe(0)
    const conflicting = { assets: new Map([
      ['assets/newchunk-IJKLMNOP.js', Buffer.from('new')],
      [assetPath, Buffer.from('different bytes')],
    ]) }
    await expect(mergeAssets(join(dir, 'dist'), [conflicting])).rejects.toThrow('collision')
    expect(await readdir(join(dir, 'dist/assets'))).toEqual(['prompt-ABCDEFGH.js'])
    expect(await readFile(join(dir, `dist/${assetPath}`), 'utf8')).toBe('export default 1')
    await expect(mergeAssets(join(dir, 'dist'), [valid, valid, valid, valid])).rejects.toThrow('three')
  })

  it('rejects symlink destinations rather than reading or replacing outside files', async () => {
    const dir = await workspace()
    await writeFile(join(dir, 'outside'), 'export default 1')
    await symlink('../../outside', join(dir, `dist/${assetPath}`))
    const valid = await decodeArtifact(await archive())
    await expect(mergeAssets(join(dir, 'dist'), [valid])).rejects.toThrow('regular file')
  })
})

describe('trusted deployment artifact discovery', () => {
  const repository = 'owner/tin-to-cellar'
  const run = (id, extra = {}) => ({ id, workflow_id: 42, head_branch: 'main', head_repository: { full_name: repository }, head_sha: 'a'.repeat(40), run_attempt: 1, event: 'push', conclusion: 'success', ...extra })
  const artifact = (id, extra = {}) => ({ id: id + 100, workflow_run: { id }, name: `app-assets-${id}-1`, size_in_bytes: 1000, expired: false, ...extra })
  function api(runs, assets = {}) {
    const calls = []
    return { calls, request: async path => {
      calls.push(path)
      if (path.endsWith('/workflows/deploy.yml')) return { id: 42 }
      if (path.includes('/actions/artifacts?')) return { artifacts: runs.flatMap(run => assets[run.id] ?? [artifact(run.id)]) }
      const id = Number(path.match(/\/runs\/(\d+)$/)[1])
      return runs.find(run => run.id === id)
    } }
  }

  it('keeps only the previous three deployments, including a deployment whose smoke check failed', async () => {
    const { request, calls } = api([run(6), run(5, { conclusion: 'failure' }), run(4), run(3), run(2)])
    const selected = await previousArtifacts({ repository, currentRunId: '6', request })
    expect(selected.map(item => item.id)).toEqual([105, 104, 103])
    expect(calls.some(path => path.endsWith('/runs/6'))).toBe(false)
    expect(calls.some(path => path.endsWith('/runs/2'))).toBe(false)
  })

  it('ignores PR/non-main runs and artifacts with unrelated names', async () => {
    const { request } = api([run(7, { workflow_id: 99 }), run(6, { event: 'pull_request' }), run(5, { head_branch: 'feature' }), run(4), run(3)], { 4: [artifact(4, { name: 'test-dist' })] })
    const selected = await previousArtifacts({ repository, currentRunId: '8', request })
    expect(selected.map(item => item.id)).toEqual([103])
  })

  it('can use an earlier deployed attempt when a later rerun never deployed', async () => {
    const { request } = api([run(5, { run_attempt: 2, conclusion: 'failure' })])
    expect(await previousArtifacts({ repository, currentRunId: '7', request })).toEqual([{ id: 105, buildId: `${'a'.repeat(40)}-5-1` }])
  })

  it('retains the earlier deployed attempt of the currently rerunning workflow', async () => {
    const { request } = api([run(6, { run_attempt: 2 }), run(5), run(4)], {
      6: [artifact(6, { id: 206, name: 'app-assets-6-2' }), artifact(6)],
    })
    const selected = await previousArtifacts({ repository, currentRunId: '6', currentRunAttempt: 2, request })
    expect(selected).toEqual([
      { id: 106, buildId: `${'a'.repeat(40)}-6-1` },
      { id: 105, buildId: `${'a'.repeat(40)}-5-1` },
      { id: 104, buildId: `${'a'.repeat(40)}-4-1` },
    ])
  })

  it('reports expired coverage and rejects provenance/API failures', async () => {
    const logs = []
    const { request } = api([run(5)], { 5: [artifact(5, { expired: true })] })
    expect(await previousArtifacts({ repository, currentRunId: '7', request, log: line => logs.push(line) })).toEqual([])
    expect(logs[0]).toContain('expired')
    const foreign = api([run(5, { head_repository: { full_name: 'foreign/repo' } })])
    await expect(previousArtifacts({ repository, currentRunId: '7', request: foreign.request })).rejects.toThrow('identity mismatch')
    await expect(previousArtifacts({ repository, currentRunId: '7', request: async () => { throw new Error('API denied') } })).rejects.toThrow('API denied')
  })
})
