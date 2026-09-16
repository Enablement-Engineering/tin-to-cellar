// One local origin, persistent storage, live frontend updates, and the real Worker.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createServer as createNetServer } from 'node:net'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const galleryId = '00000000-0000-0000-0000-000000000001'
export function parseArguments(args) {
  const options = { port: 43928, ip: '127.0.0.1' }
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i], value = args[i + 1]
    if (!['--port', '--ip', '--inspector-port', '--reuse', '--state-dir'].includes(key) || !value || value.startsWith('--')) throw Error(`Invalid development option: ${key}`)
    if (key === '--port') {
      if (!/^\d+$/.test(value) || +value < 1024 || +value > 65535) throw Error('Use a port from 1024 to 65535')
      options.port = +value
    } else if (key === '--ip') {
      if (value !== '127.0.0.1') throw Error('The development stack binds only to 127.0.0.1')
    } else if (key === '--inspector-port') {
      if (value !== '0') throw Error('The development stack allocates its own inspector port')
    } else options[key.slice(2)] = value
  }
  if (options.reuse && options['state-dir']) throw Error('Choose --reuse or --state-dir')
  return options
}

export async function selectState(root, options) {
  const pointer = join(root, '.wrangler/local-dev.json')
  let saved
  try { saved = JSON.parse(await readFile(pointer, 'utf8')).directory } catch (error) { if (error.code !== 'ENOENT') throw error }
  const directory = resolve(root, options.reuse ?? options['state-dir'] ?? saved ?? '.wrangler/dev')
  const within = relative(join(root, '.wrangler'), directory)
  if (!within || within.startsWith('..') || within.startsWith('/')) throw Error('Local state must be inside this checkout’s .wrangler directory')
  if (options.reuse || saved && !options['state-dir']) {
    const config = JSON.parse(await readFile(join(directory, 'wrangler.json'), 'utf8'))
    if (config.name !== 'tin-to-cellar-local-gallery' || config.main !== join(root, 'worker/index.ts') || config.d1_databases?.find(db => db.binding === 'GALLERY')?.database_id !== galleryId) throw Error('Saved state is not a normal local gallery')
  }
  return { directory, pointer, remember: !options['state-dir'] }
}

export function localConfig(root) {
  const limits = { ANALYTICS_RATE_LIMITER: 30, GALLERY_IMAGE_RATE_LIMITER: 2400, GALLERY_PACK_RATE_LIMITER: 60, GALLERY_RATE_LIMITER: 5, GALLERY_READ_RATE_LIMITER: 120, GALLERY_UPLOAD_RATE_LIMITER: 5, GALLERY_MUTATION_RATE_LIMITER: 20, SOURCES_RATE_LIMITER: 60, CONTRIBUTION_RATE_LIMITER: 3 }
  return {
    name: 'tin-to-cellar-local-gallery', main: join(root, 'worker/index.ts'),
    compatibility_date: '2026-09-05', workers_dev: false, preview_urls: false,
    cache: { enabled: false }, observability: { enabled: false },
    // The browser is served by Vite. Never point a development server at dist.
    assets: { directory: join(root, 'public'), binding: 'ASSETS', run_worker_first: true },
    d1_databases: [
      { binding: 'GALLERY', database_name: 'local-gallery', database_id: galleryId, migrations_dir: join(root, 'migrations/gallery') },
      { binding: 'DIAGNOSTICS', database_name: 'local-diagnostics', database_id: '00000000-0000-0000-0000-000000000002', migrations_dir: join(root, 'migrations') },
    ],
    r2_buckets: [{ binding: 'GALLERY_ART', bucket_name: 'local-gallery' }],
    durable_objects: { bindings: [{ name: 'CATALOG_CONTRIBUTIONS', class_name: 'CatalogContributions' }] },
    migrations: [{ tag: 'local-contributions-v1', new_sqlite_classes: ['CatalogContributions'] }],
    ratelimits: Object.entries(limits).map(([name, limit], i) => ({ name, namespace_id: String(9100 + i), simple: { limit, period: 60 } })),
    vars: {
      ANALYTICS_ENABLED: 'false', OPERATIONAL_METRICS_ENABLED: 'false',
      DIAGNOSTIC_COLLECTION_ENABLED: 'true', DIAGNOSTIC_DAILY_ALLOWANCE: '1000',
      GALLERY_INTAKE: 'false', GALLERY_SERVING: 'true', GALLERY_PUBLICATION: 'false',
      GALLERY_IP_SALT: 'local-development-only', GALLERY_TURNSTILE_SITE_KEY: '',
    },
  }
}

async function availablePort(port) {
  const server = createNetServer()
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done) })
  const selected = server.address().port
  await new Promise(done => server.close(done))
  return selected
}

export async function main(args = process.argv.slice(2), root = process.cwd()) {
  const options = parseArguments(args)
  try { await availablePort(options.port) } catch { throw Error(`Port ${options.port} is already in use. Stop its existing server before starting npm run dev. The port will not silently change.`) }
  const state = await selectState(root, options)
  await mkdir(state.directory, { recursive: true })
  const config = join(state.directory, 'wrangler.json')
  await writeFile(config, JSON.stringify(localConfig(root), null, 2))
  const children = new Set()
  let vite, stopping = false, finish
  const lifetime = new Promise(done => { finish = done })
  function signalChild(child, signal) {
    if (!child.pid) return
    try { process.kill(-child.pid, signal) } catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  async function stop(code = 0) {
    if (stopping) return
    stopping = true
    const active = [...children]
    for (const child of active) signalChild(child, 'SIGTERM')
    await vite?.close()
    await Promise.race([Promise.all(active.map(child => child.exitCode !== null ? Promise.resolve() : new Promise(done => child.once('close', done)))), delay(2000)])
    for (const child of active) if (child.exitCode === null && child.signalCode === null) signalChild(child, 'SIGKILL')
    process.exitCode = code
    finish()
  }
  const onSignal = () => { void stop() }
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal)
  const launch = (args, persistent = false, quiet = false) => {
    if (stopping) throw Error('Development startup cancelled')
    const child = spawn('npm', args, { cwd: root, stdio: quiet ? ['ignore', 'ignore', 'inherit'] : 'inherit', detached: true, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })
    children.add(child)
    const result = new Promise((done, reject) => {
      child.once('error', reject)
      child.once('close', code => {
        children.delete(child)
        if (persistent && !stopping) {
          console.error('The local Worker stopped; shutting down the frontend too.')
          void stop(1)
        }
        if (code === 0 || stopping) done(); else reject(Error(`npm ${args.join(' ')} exited with ${code}`))
      })
    })
    return { child, result }
  }
  const wranglerArgs = (...args) => ['exec', '--', 'wrangler', ...args, '--config', config, '--persist-to', join(state.directory, 'state')]
  try {
    for (const script of ['feedback:validators', 'protocol:release', 'prepare:ocr']) await launch(['run', script]).result
    for (const binding of ['GALLERY', 'DIAGNOSTICS']) await launch(wranglerArgs('d1', 'migrations', 'apply', binding, '--local')).result
    const seed = join(state.directory, 'catalog.sql')
    await launch(['run', 'gallery:seed', '--', seed]).result
    await launch(wranglerArgs('d1', 'execute', 'GALLERY', '--local', '--file', seed), false, true).result
    await launch(wranglerArgs('d1', 'execute', 'GALLERY', '--local', '--command', 'UPDATE gallery_settings SET serving=1 WHERE id=1')).result
    const workerPort = await availablePort(0)
    const worker = launch(wranglerArgs('dev', '--local', '--ip', '127.0.0.1', '--port', String(workerPort), '--inspector-port', '0'), true)
    void worker.result.catch(error => { if (!stopping) { console.error(error.message); void stop(1) } })
    const target = `http://127.0.0.1:${workerPort}`
    let ready = false
    for (let i = 0; i < 120 && !stopping; i++) {
      try {
        const response = await fetch(`${target}/api/gallery/v1/config`, { signal: AbortSignal.timeout(1000) })
        if (response.ok && (await response.json()).serving === true) { ready = true; break }
      } catch { /* Worker may still be starting or rebuilding. */ }
      await delay(250)
    }
    if (!ready) throw Error('Local gallery API did not become ready; frontend was not started')
    const { createServer } = await import('vite')
    vite = await createServer({ root, server: { host: options.ip, port: options.port, strictPort: true, proxy: { '/api': { target }, '/admin': { target } } } })
    if (stopping) { await vite.close(); return }
    await vite.listen()
    if (stopping) { await vite.close(); return }
    if (state.remember) await writeFile(state.pointer, JSON.stringify({ directory: relative(root, state.directory) }, null, 2))
    console.log(`\nComplete local stack: http://127.0.0.1:${options.port}\nPersistent data: ${state.directory}\nFrontend edits update live. npm run build does not affect this server.\n`)
    await lifetime
  } catch (error) {
    if (!stopping) throw error
  } finally {
    await stop(process.exitCode || 0)
    process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
