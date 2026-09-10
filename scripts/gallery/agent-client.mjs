// Trusted local adapter: scoped reads and append-only advice, never human decisions.
import { constants } from 'node:fs'
import { open, realpath, unlink } from 'node:fs/promises'
import { resolve, dirname, isAbsolute, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

export const AGENT_HOSTS = Object.freeze(['admin.tintocellar.com', 'admin-staging.tintocellar.com'])
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const HASH = /^[a-f0-9]{64}$/
const fail = code => { throw new Error(code) }
const SAFE_ERRORS = new Set(['invalid_recommendation','private_file_required','credentials_must_be_external','invalid_credentials_configuration','unsupported_command','invalid_arguments','private_output_required','invalid_request','access_denied','not_found_or_not_granted','review_changed_reload_do_not_auto_retry','rate_limited_wait_before_retry','gallery_request_failed','invalid_response','response_too_large','network_or_redirect_failed','redirect_refused','invalid_or_oversize_response','private_output_required_or_exists','invalid_or_nonprivate_recommendation_file'])
const exact = (value, required, optional = []) => value && typeof value === 'object' && !Array.isArray(value) && required.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => [...required, ...optional].includes(k))
const text = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max && ![...s].some(c => (c.charCodeAt(0) < 32 && c !== '\n') || c === '<' || c === '>')
export function validateRecommendation(v) {
  if (!exact(v, ['schemaVersion','expectedVersion','digest','idempotencyKey','assessment','findings'], ['suggestedCatalogId','supersedesId']) || v.schemaVersion !== 1 || !Number.isSafeInteger(v.expectedVersion) || v.expectedVersion < 1 || !HASH.test(v.digest) || !UUID.test(v.idempotencyKey) || !['ready-for-human-review','needs-attention','unable-to-assess'].includes(v.assessment) || !Array.isArray(v.findings) || v.findings.length > 10) fail('invalid_recommendation')
  if (v.suggestedCatalogId !== undefined && (!text(v.suggestedCatalogId, 200) || !/^[a-z0-9][a-z0-9-]*$/.test(v.suggestedCatalogId))) fail('invalid_recommendation')
  if (v.supersedesId !== undefined && !UUID.test(v.supersedesId)) fail('invalid_recommendation')
  let total = 0
  for (const finding of v.findings) {
    if (!exact(finding, ['category','severity','explanation'], ['evidence']) || !['catalog-match','duplicate','artwork','writing-area','geometry','reference','sharing-concern'].includes(finding.category) || !['info','warning'].includes(finding.severity) || !text(finding.explanation, 1000)) fail('invalid_recommendation')
    total += Buffer.byteLength(finding.explanation, 'utf8')
    if (finding.evidence === undefined) continue
    if (!Array.isArray(finding.evidence) || finding.evidence.length > 4) fail('invalid_recommendation')
    for (const e of finding.evidence) {
      if (e?.type === 'artwork' && exact(e,['type'],['region'])) {
        if (e.region !== undefined) {
          const r = e.region
          if (!exact(r,['x','y','width','height']) || Object.values(r).some(n => typeof n !== 'number' || !Number.isFinite(n)) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0 || r.x + r.width > 1 || r.y + r.height > 1) fail('invalid_recommendation')
        }
      } else if (e?.type === 'metadata' && exact(e,['type','field']) && ['tobacco','edition','evidence','altText','artworkProfileId','writingArea'].includes(e.field)) continue
      else if (e?.type === 'duplicate' && exact(e,['type','publicationId']) && UUID.test(e.publicationId)) continue
      else if (e?.type === 'reference' && exact(e,['type','url']) && text(e.url,1500)) {
        let u; try { u = new URL(e.url) } catch { fail('invalid_recommendation') }
        if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.port) fail('invalid_recommendation')
      } else fail('invalid_recommendation')
    }
  }
  if (total > 4096 || Buffer.byteLength(JSON.stringify(v)) > 32768) fail('invalid_recommendation')
  return v
}
function privateStat(stat) { return stat.isFile() && (stat.mode & 0o077) === 0 && (typeof process.getuid !== 'function' || stat.uid === process.getuid()) }
function outsideRoot(path, root) { const rel = relative(root, path); return rel === '..' || rel.startsWith('../') || isAbsolute(rel) }
async function readPrivateFile(path, max, root, external = false) {
  if (!isAbsolute(path)) fail('private_file_required')
  let file
  try {
    const resolved = await realpath(path)
    if (external && !outsideRoot(resolved, await realpath(root))) fail('credentials_must_be_external')
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
    const stat = await file.stat()
    if (!privateStat(stat) || stat.size > max) fail('private_file_required')
    const data = await file.readFile()
    if (data.length > max) fail('private_file_required')
    return data.toString('utf8')
  } catch (error) { if (['credentials_must_be_external','private_file_required'].includes(error.message)) throw error; fail('private_file_required') }
  finally { await file?.close() }
}
export function validateCredentials(value) {
  if (!exact(value,['host','clientId','clientSecret']) || !AGENT_HOSTS.includes(value.host) || !/^[a-zA-Z0-9._-]{8,200}$/.test(value.clientId) || !/^[a-zA-Z0-9_-]{16,512}$/.test(value.clientSecret)) fail('invalid_credentials_configuration')
  return value
}
export async function loadAgentCredentials(env = process.env, root = process.cwd()) {
  if (env.GALLERY_AGENT_CREDENTIALS_FILE) {
    let value
    try { value = JSON.parse(await readPrivateFile(env.GALLERY_AGENT_CREDENTIALS_FILE, 8192, root, true)) } catch (e) { if (['credentials_must_be_external','private_file_required'].includes(e.message)) throw e; fail('invalid_credentials_configuration') }
    return validateCredentials(value)
  }
  return validateCredentials({host:env.GALLERY_AGENT_HOST,clientId:env.GALLERY_AGENT_CLIENT_ID,clientSecret:env.GALLERY_AGENT_CLIENT_SECRET})
}
export function parseAgentArguments(args) {
  const command = args[0]
  const allowed = {queue:['cursor'],detail:['id'],artwork:['id','output'],thumbnail:['id','output'],recommend:['id','file']}[command]
  if (!allowed) fail('unsupported_command')
  const options = {}
  for (let i = 1; i < args.length; i += 2) { const name = args[i]?.slice(2), value = args[i + 1]; if (!args[i].startsWith('--') || !allowed.includes(name) || name in options || !value || value.startsWith('--')) fail('invalid_arguments'); options[name] = value }
  if (command !== 'queue' && !UUID.test(options.id)) fail('invalid_arguments')
  if (options.cursor !== undefined && (!/^[a-zA-Z0-9+/_=-]{1,200}$/.test(options.cursor))) fail('invalid_arguments')
  if (['artwork','thumbnail'].includes(command) && !isAbsolute(options.output ?? '')) fail('private_output_required')
  if (command === 'recommend' && !isAbsolute(options.file ?? '')) fail('private_file_required')
  return {command,options}
}
const statusError = status => ({400:'invalid_request',401:'access_denied',403:'access_denied',404:'not_found_or_not_granted',409:'review_changed_reload_do_not_auto_retry',429:'rate_limited_wait_before_retry'}[status] ?? 'gallery_request_failed')
async function readBounded(response, limit) {
  const reader = response.body?.getReader(); if (!reader) fail('invalid_response')
  const chunks = []; let size = 0
  try { for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > limit) { await reader.cancel(); fail('response_too_large') } chunks.push(Buffer.from(value)) } } finally { reader.releaseLock() }
  return Buffer.concat(chunks)
}
export function redactAgentOutput(value, credentials) {
  let output = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  for (const secret of [credentials.clientId, credentials.clientSecret]) if (secret) output = output.split(secret).join('[redacted]')
  return output
}
export async function agentRequest(credentials, command, options, recommendation, fetchImpl = fetch) {
  validateCredentials(credentials)
  const id = options.id
  if (command !== 'queue' && !UUID.test(id)) fail('invalid_arguments')
  const suffix = {queue:'/submissions',detail:`/submissions/${id}`,artwork:`/submissions/${id}/artwork`,thumbnail:`/submissions/${id}/thumbnail`,recommend:`/submissions/${id}/recommendations`}[command]
  if (!suffix) fail('unsupported_command')
  const url = new URL(`/api/gallery/v1/agent${suffix}`, `https://${credentials.host}`)
  if (command === 'queue' && options.cursor) { if (!/^[a-zA-Z0-9+/_=-]{1,200}$/.test(options.cursor)) fail('invalid_arguments'); url.searchParams.set('cursor', options.cursor) }
  const headers = {'CF-Access-Client-Id':credentials.clientId,'CF-Access-Client-Secret':credentials.clientSecret,Accept:['artwork','thumbnail'].includes(command)?'image/png':'application/json'}
  const init = {method:command === 'recommend'?'POST':'GET',headers,redirect:'error',signal:AbortSignal.timeout(30000)}
  if (command === 'recommend') { init.body = JSON.stringify(validateRecommendation(recommendation)); headers['Content-Type'] = 'application/json' }
  let response
  try { response = await fetchImpl(url, init) } catch { fail('network_or_redirect_failed') }
  if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); fail('redirect_refused') }
  if (!response.ok) { await response.body?.cancel(); fail(statusError(response.status)) }
  const image = ['artwork','thumbnail'].includes(command)
  if (!(response.headers.get('Content-Type') ?? '').toLowerCase().startsWith(image?'image/png':'application/json')) { await response.body?.cancel(); fail('invalid_response') }
  let bytes
  try { bytes = await readBounded(response, image ? 18*1024*1024 : 512*1024) } catch { fail('invalid_or_oversize_response') }
  if (image) { if (!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) fail('invalid_response'); return bytes }
  try { return JSON.parse(bytes.toString('utf8')) } catch { fail('invalid_response') }
}
async function savePrivateArtwork(path, bytes, root) {
  let file, created = false
  try {
    const parent = await realpath(dirname(path)), rootPath = await realpath(root)
    if (!outsideRoot(parent, rootPath)) fail('private_output_required')
    const directory = await open(parent, constants.O_RDONLY); const stat = await directory.stat(); await directory.close()
    if (!stat.isDirectory() || (stat.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && stat.uid !== process.getuid())) fail('private_output_required')
    // Resolve the parent once; no overwrite, symlink following, repository copy or shared directory.
    const output = resolve(parent, path.split('/').at(-1))
    file = await open(output, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); created = true
    await file.writeFile(bytes); await file.close(); file = undefined
    return {file:output,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),notice:'Private local review copy. Purge it when review ends; do not upload it to a provider without explicit authorization.'}
  } catch { await file?.close(); if (created) await unlink(path).catch(()=>{}); fail('private_output_required_or_exists') }
}
export async function runAgentClient(args, env = process.env, root = process.cwd(), fetchImpl = fetch) {
  const {command,options} = parseAgentArguments(args), credentials = await loadAgentCredentials(env,root)
  let recommendation
  if (command === 'recommend') { try { recommendation = validateRecommendation(JSON.parse(await readPrivateFile(options.file,32768,root))) } catch { fail('invalid_or_nonprivate_recommendation_file') } }
  const result = await agentRequest(credentials,command,options,recommendation,fetchImpl)
  const output = Buffer.isBuffer(result) ? await savePrivateArtwork(options.output,result,root) : result
  return redactAgentOutput(output,credentials)
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runAgentClient(process.argv.slice(2)).then(output=>console.log(output)).catch(error=>{
    // Only our fixed error codes reach the terminal. Never print response bodies, credentials or fetch errors.
    const code = SAFE_ERRORS.has(error.message) ? error.message : 'agent_client_failed'
    console.error(code); process.exitCode=1
  })
}
