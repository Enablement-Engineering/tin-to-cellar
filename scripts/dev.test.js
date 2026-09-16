import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { localConfig, parseArguments, selectState } from './dev.mjs'

const roots = []
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ttc-dev-'))
  roots.push(root)
  await mkdir(join(root, '.wrangler'))
  return root
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

describe('complete local development stack', () => {
  it('keeps the same data directory across default starts and remembers an adopted gallery', async () => {
    const root = await fixture()
    expect((await selectState(root, {})).directory).toBe(join(root, '.wrangler/dev'))
    const existing = join(root, '.wrangler/gallery-populated')
    await mkdir(existing)
    await writeFile(join(existing, 'wrangler.json'), JSON.stringify(localConfig(root)))
    await writeFile(join(existing, 'saved-data'), 'existing artwork')
    const adopted = await selectState(root, { reuse: '.wrangler/gallery-populated' })
    await writeFile(adopted.pointer, JSON.stringify({ directory: '.wrangler/gallery-populated' }))
    expect((await selectState(root, {})).directory).toBe(existing)
    expect(await readFile(join(existing, 'saved-data'), 'utf8')).toBe('existing artwork')
    const isolated = await selectState(root, { 'state-dir': '.wrangler/test' })
    expect(isolated.remember).toBe(false)
    expect((await selectState(root, {})).directory).toBe(existing)
  })
  it('rejects external storage and production or synthetic-test configurations before adoption', async () => {
    const root = await fixture()
    await expect(selectState(root, { 'state-dir': '../outside' })).rejects.toThrow('inside')
    const existing = join(root, '.wrangler/gallery-test')
    await mkdir(existing)
    for (const patch of [{ name: 'production' }, { main: join(root, 'tests/gallery/test-worker.ts') }, { d1_databases: [{ binding: 'GALLERY', database_id: 'production-id' }] }]) {
      await writeFile(join(existing, 'wrangler.json'), JSON.stringify({ ...localConfig(root), ...patch }))
      await expect(selectState(root, { reuse: existing })).rejects.toThrow('normal local gallery')
    }
  })
  it('isolates all backend bindings and avoids disposable build output', () => {
    const config = localConfig('/checkout')
    expect(config.d1_databases.map(db => db.binding).sort()).toEqual(['DIAGNOSTICS', 'GALLERY'])
    expect(config.d1_databases.every(db => db.database_id.startsWith('00000000-'))).toBe(true)
    expect(config.r2_buckets).toEqual([{ binding: 'GALLERY_ART', bucket_name: 'local-gallery' }])
    expect(config.durable_objects.bindings[0].name).toBe('CATALOG_CONTRIBUTIONS')
    expect(config.assets.directory).toBe('/checkout/public')
    expect(config.account_id).toBeUndefined()
    expect(config.routes).toBeUndefined()
    expect(config.vars.GALLERY_IP_SALT).toBeTruthy()
    expect(config.vars.GALLERY_INTAKE).toBe('false')
    expect(config.vars.GALLERY_SERVING).toBe('true')
  })
  it('keeps the browser origin stable and rejects malformed or remotely exposed starts', () => {
    expect(parseArguments([]).port).toBe(43928)
    expect(parseArguments(['--port', '43927', '--ip', '127.0.0.1', '--inspector-port', '0']).port).toBe(43927)
    for (const args of [['--ip', '0.0.0.0'], ['--port', '0'], ['--port', 'NaN'], ['--reuse'], ['--reuse', 'x', '--state-dir', 'y'], ['--remote', 'true']]) expect(() => parseArguments(args)).toThrow()
  })
})
