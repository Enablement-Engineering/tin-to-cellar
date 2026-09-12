// Generates a reviewable local configuration only. Never provisions or deploys.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const ACCOUNT_ID = '97e5d454f1ad2daae1c6d42a5d4c09dd'
const PRODUCTION_DIAGNOSTICS = '10c1a5a7-9884-46ad-86d0-2eedf5d8426a'
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)
const reject = message => { throw new Error(message) }
const placeholder = value => /placeholder|replace|example|changeme|your[-_]|dummy|test[-_]|<|>/i.test(value)
export function parseReleaseArguments(args) {
  const allowed = new Set(['target','database-id','bucket','host','access-issuer','access-aud','admin-subject','turnstile-site-key','admin-host','agent-access-aud','paid-workers-confirmed'])
  const result = {}
  for (let i = 0; i < args.length; i++) {
    const name = args[i].startsWith('--') ? args[i].slice(2) : ''
    if (!allowed.has(name) || name in result) reject('Unknown or duplicate release argument')
    if (name === 'paid-workers-confirmed') { result[name] = true; continue }
    const value = args[++i]
    if (!value || value.startsWith('--') || placeholder(value)) reject(`Missing or placeholder --${name}`)
    result[name] = value
  }
  return result
}
export function createReleaseConfig(base, options, root) {
  const target = options.target
  if (!['staging','production'].includes(target)) reject('--target must be staging or production')
  for (const name of ['database-id','bucket','access-issuer','access-aud','admin-subject','turnstile-site-key','admin-host']) {
    if (typeof options[name] !== 'string' || !options[name] || placeholder(options[name])) reject(`Missing or placeholder --${name}`)
  }
  if (!uuid(options['database-id']) || options['database-id'].toLowerCase() === PRODUCTION_DIAGNOSTICS || base.d1_databases?.some(db => db.binding !== 'GALLERY' && db.database_id.toLowerCase() === options['database-id'].toLowerCase())) reject('Use a real, separate gallery database UUID; existing databases are not allowed')
  if (!uuid(options['admin-subject'])) reject('Use the actual Access admin subject UUID')
  const bucket = target === 'staging' ? 'tin-to-cellar-gallery-staging' : 'tin-to-cellar-gallery'
  if (options.bucket !== bucket) reject(`--bucket must be ${bucket}; staging and production storage must stay separate`)
  let issuer
  try { issuer = new URL(options['access-issuer']) } catch { reject('Invalid Access issuer') }
  if (issuer.protocol !== 'https:' || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer.hostname) || issuer.username || issuer.password || issuer.port || issuer.search || issuer.hash || issuer.pathname !== '/') reject('Use the actual HTTPS Cloudflare Access team issuer origin')
  if (!/^[a-f0-9]{64}$/i.test(options['access-aud'])) reject('Use the actual 64-character Access application audience')
  const adminHost = target === 'staging' ? 'admin-staging.tintocellar.com' : 'admin.tintocellar.com'
  if (options['admin-host'] !== adminHost) reject('Use the dedicated admin hostname for this target')
  if (options['agent-access-aud'] !== undefined && (!/^[a-f0-9]{64}$/i.test(options['agent-access-aud']) || options['agent-access-aud'] === options['access-aud'])) reject('Agent Access audience must be a distinct actual 64-character audience')
  const siteKey = options['turnstile-site-key']
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(siteKey) || /^[123]x0+/.test(siteKey) || /local-test/i.test(siteKey)) reject('Use an actual Turnstile site key, not a test key')
  const productionHosts = (base.routes ?? []).map(route => typeof route === 'string' ? route : route.pattern)
  let config
  if (target === 'staging') {
    const host = options.host
    if (typeof host !== 'string' || host.length > 253 || placeholder(host) || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) || /(?:^|\.)(?:localhost|local|internal|workers\.dev|example\.(?:com|net|org))$/.test(host) || productionHosts.includes(host)) reject('Use a real, separate staging hostname; production routes are forbidden')
    // Deliberate allowlist: never copy production databases, DOs, migrations or service bindings.
    config = { name: 'tin-to-cellar-gallery-staging', compatibility_date: base.compatibility_date, routes: [{ pattern: host, custom_domain: true }], triggers: { crons: ['17 4 * * *'] }, observability: { enabled: false } }
  } else {
    if (options.host !== undefined) reject('Production preserves existing routes; do not pass --host')
    config = structuredClone(base)
  }
  if (!config.routes.some(route => (typeof route === 'string' ? route : route.pattern) === adminHost)) config.routes.push({ pattern: adminHost, custom_domain: true })
  config.account_id = ACCOUNT_ID
  config.main = resolve(root, 'worker/index.ts')
  config.workers_dev = false; config.preview_urls = false
  // Classic caches.default is used only after application authentication.
  config.cache = { enabled: false }
  config.assets = { ...structuredClone(base.assets), directory: resolve(root, 'dist'), run_worker_first: true }
  config.vars = { ...(config.vars ?? {}), ANALYTICS_ENABLED: 'false', ANALYTICS_DAILY_ALLOWANCE: '1000', OPERATIONAL_METRICS_ENABLED: target === 'production' ? 'true' : 'false', GALLERY_ADMIN_HOST: adminHost, GALLERY_AGENT_ENABLED: 'false', GALLERY_AGENT_ACCESS_AUD: options['agent-access-aud'] ?? '', GALLERY_INTAKE: 'false', GALLERY_SERVING: 'false', GALLERY_PUBLICATION: 'false', GALLERY_ACCESS_ISSUER: issuer.origin, GALLERY_ACCESS_AUD: options['access-aud'], GALLERY_ADMIN_SUBJECT: options['admin-subject'], GALLERY_TURNSTILE_SITE_KEY: siteKey }
  config.vars.ANALYTICS_PUBLIC_HOST = target === 'staging' ? options.host : 'tintocellar.com'
  config.d1_databases = [...(config.d1_databases ?? []).filter(db => db.binding !== 'GALLERY').map(db => ({ ...db, migrations_dir: resolve(root, db.migrations_dir ?? 'migrations') })), { binding: 'GALLERY', database_name: bucket, database_id: options['database-id'], migrations_dir: resolve(root, 'migrations/gallery') }]
  config.r2_buckets = [...(config.r2_buckets ?? []).filter(bucket => bucket.binding !== 'GALLERY_ART'), { binding: 'GALLERY_ART', bucket_name: bucket }]
  const galleryLimits = [
    { name: 'GALLERY_RATE_LIMITER', namespace_id: target === 'staging' ? '2005' : '1005', simple: { limit: 5, period: 60 } },
    { name: 'GALLERY_READ_RATE_LIMITER', namespace_id: target === 'staging' ? '2007' : '1007', simple: { limit: 120, period: 60 } },
    { name: 'GALLERY_UPLOAD_RATE_LIMITER', namespace_id: target === 'staging' ? '2008' : '1008', simple: { limit: 5, period: 60 } },
    { name: 'GALLERY_MUTATION_RATE_LIMITER', namespace_id: target === 'staging' ? '2009' : '1009', simple: { limit: 20, period: 60 } },
    { name: 'GALLERY_IMAGE_RATE_LIMITER', namespace_id: target === 'staging' ? '2010' : '1010', simple: { limit: 2400, period: 60 } },
    { name: 'GALLERY_PACK_RATE_LIMITER', namespace_id: target === 'staging' ? '2011' : '1011', simple: { limit: 60, period: 60 } },
    { name: 'ANALYTICS_RATE_LIMITER', namespace_id: target === 'staging' ? '2012' : '1012', simple: { limit: 30, period: 60 } },
  ]
  config.ratelimits = [...(config.ratelimits ?? []).filter(limit => !galleryLimits.some(gallery => gallery.name === limit.name)), ...galleryLimits]
  if (options['paid-workers-confirmed'] === true) config.limits = { ...(config.limits ?? {}), cpu_ms: 2000 }
  else if (config.limits && 'cpu_ms' in config.limits) { delete config.limits.cpu_ms; if (!Object.keys(config.limits).length) delete config.limits }
  delete config.$schema
  return config
}
export function portableReleaseConfig(config, root) {
  const portable = structuredClone(config)
  portable.main = 'worker/index.ts'
  portable.assets.directory = './dist'
  portable.d1_databases = portable.d1_databases.map(db => {
    const path = relative(resolve(root), db.migrations_dir).split('\\').join('/')
    if (!path || path.startsWith('../') || path.startsWith('/')) reject('Migration paths must stay inside the repository for root configuration')
    return { ...db, migrations_dir: path }
  })
  return portable
}
export async function prepareRelease(args, root = process.cwd()) {
  const options = parseReleaseArguments(args)
  const base = JSON.parse(await readFile(resolve(root, 'wrangler.jsonc'), 'utf8'))
  const config = createReleaseConfig(base, options, root)
  const output = resolve(root, 'output/gallery-release', options.target, 'wrangler.json')
  const portable = portableReleaseConfig(config, root)
  const portableOutput = resolve(dirname(output), 'wrangler.root.json')
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(config, null, 2) + '\n')
  await writeFile(portableOutput, JSON.stringify(portable, null, 2) + '\n')
  console.log(`Prepared local ${options.target} config: ${output}. All gallery switches are off. Nothing was provisioned or deployed.`)
  console.log(`Portable review copy: ${portableOutput}. Do not deploy it from this output directory. Copy to repository-root wrangler.jsonc only after release approval; its paths resolve from the repository root.`)
  console.log('Required secrets remain unset: GALLERY_IP_SALT and GALLERY_TURNSTILE_SECRET. Verify private R2 public-access settings and actual resource ownership before release.')
  if (!options['paid-workers-confirmed']) console.log('Hosted CPU prerequisite: confirm Workers Paid and image-processing CPU budget before enabling gallery intake; no cpu_ms limit was added.')
  return output
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  prepareRelease(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1 })
}
