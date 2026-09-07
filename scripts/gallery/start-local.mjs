// Local-only harness. Never provisions or deploys Cloudflare resources.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync, spawn } from 'node:child_process'

const root = process.cwd()
mkdirSync('.wrangler', { recursive: true })
const work = mkdtempSync(resolve('.wrangler/gallery-'))
const config = resolve(work, 'wrangler.json')
const state = resolve(work, 'state')
const testMode = process.argv.includes('--test')
const port = process.argv.includes('--port') ? process.argv[process.argv.indexOf('--port') + 1] : '43928'
writeFileSync(config, JSON.stringify({
  name: 'tin-to-cellar-local-gallery', main: resolve(testMode ? 'tests/gallery/test-worker.ts' : 'worker/index.ts'),
  compatibility_date: '2026-09-05', workers_dev: false, preview_urls: false,
  assets: { directory: resolve('dist'), binding: 'ASSETS', not_found_handling: 'single-page-application', run_worker_first: ['/api/*', '/admin/*', '/gallery/status', ...(testMode ? ['/__test/*'] : [])] },
  d1_databases: [{ binding: 'GALLERY', database_name: 'local-gallery', database_id: '00000000-0000-0000-0000-000000000001', migrations_dir: resolve('migrations/gallery') }],
  r2_buckets: [{ binding: 'GALLERY_ART', bucket_name: 'local-gallery' }],
  ratelimits: [{ name: 'GALLERY_RATE_LIMITER', namespace_id: '9001', simple: { limit: 5, period: 60 } }],
  vars: { GALLERY_INTAKE: 'true', GALLERY_SERVING: 'true', GALLERY_PUBLICATION: 'true', GALLERY_IP_SALT: 'local-test-only-no-production-value', GALLERY_TURNSTILE_SITE_KEY: testMode ? 'local-test-widget' : '' },
  observability: { enabled: false },
}, null, 2))
const wrangler = (...args) => execFileSync('npm', ['exec', '--', 'wrangler', ...args, '--config', config, '--persist-to', state], { cwd: root, stdio: 'inherit' })
wrangler('d1', 'migrations', 'apply', 'GALLERY', '--local')
const seed = resolve(work, 'catalog.sql')
execFileSync('npm', ['exec', '--', 'node', 'scripts/gallery/seed-catalog.mjs', seed], { cwd: root, stdio: 'inherit' })
wrangler('d1', 'execute', 'GALLERY', '--local', '--file', seed)
wrangler('d1', 'execute', 'GALLERY', '--local', '--command', 'UPDATE gallery_settings SET intake=1,publication=1,serving=1 WHERE id=1')
console.log(testMode ? 'Local gallery E2E harness: synthetic authentication is confined to tests/gallery/test-worker.ts.' : 'Local gallery: production authentication remains required. No remote resources were changed.')
const child = spawn('npm', ['exec', '--', 'wrangler', 'dev', '--local', '--ip', '127.0.0.1', '--port', port, '--inspector-port', '0', '--config', config, '--persist-to', state], { cwd: root, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('exit', code => { process.exitCode = code ?? 1 })
