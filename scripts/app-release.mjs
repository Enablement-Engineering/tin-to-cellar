import { createHash } from 'node:crypto'
import { copyFile, lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const HASHED_ASSET = /^assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,64}\.[A-Za-z0-9]{1,12}$/
const MAX_FILES = 2000
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_TOTAL_BYTES = 64 * 1024 * 1024
const MAX_ARCHIVE_BYTES = MAX_TOTAL_BYTES + 1024 * 1024
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

export function validateManifest(value, expectedBuildId) {
  invariant(value?.schema === 1 && typeof value.buildId === 'string' && /^[A-Za-z0-9_.-]{1,160}$/.test(value.buildId), 'Invalid asset manifest identity')
  invariant(!expectedBuildId || value.buildId === expectedBuildId, 'Asset manifest build identity does not match deployment')
  invariant(Array.isArray(value.files) && value.files.length > 0 && value.files.length <= MAX_FILES, 'Invalid retained asset count')
  let total = 0
  const paths = new Set()
  for (const file of value.files) {
    invariant(typeof file.path === 'string' && HASHED_ASSET.test(file.path), `Unsafe or non-hashed asset path: ${file.path}`)
    invariant(!paths.has(file.path), `Duplicate retained asset: ${file.path}`)
    paths.add(file.path)
    invariant(Number.isSafeInteger(file.size) && file.size >= 0 && file.size <= MAX_FILE_BYTES, 'Invalid retained asset size')
    invariant(typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256), 'Invalid retained asset checksum')
    total += file.size
  }
  invariant(total <= MAX_TOTAL_BYTES, 'Retained asset generation exceeds byte limit')
  return value
}

// Snapshot BEFORE merging previous generations. The artifact must never contain
// retained generations, HTML, Worker code/configuration, or mutable public files.
export async function prepareAssets(dist, destination) {
  const version = JSON.parse(await readFile(resolve(dist, 'app-version.json'), 'utf8'))
  invariant((await lstat(resolve(dist, 'assets'))).isDirectory(), 'Build assets must be a real directory')
  const files = []
  for (const entry of await readdir(resolve(dist, 'assets'), { withFileTypes: true })) {
    const path = `assets/${entry.name}`
    if (!HASHED_ASSET.test(path)) continue
    invariant(entry.isFile(), `Build asset must be a regular file: ${path}`)
    const stat = await lstat(resolve(dist, path))
    invariant(stat.isFile() && stat.size <= MAX_FILE_BYTES, `Build asset is invalid or too large: ${path}`)
    const bytes = await readFile(resolve(dist, path))
    files.push({ path, size: bytes.length, sha256: sha256(bytes) })
  }
  const manifest = validateManifest({ schema: 1, buildId: version.buildId, files: files.sort((a, b) => a.path.localeCompare(b.path)) })
  // A fresh destination prevents accidentally publishing assets from an earlier run.
  await mkdir(destination, { recursive: false })
  await mkdir(resolve(destination, 'assets'))
  for (const file of files) await copyFile(resolve(dist, file.path), resolve(destination, file.path))
  await writeFile(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

export async function decodeArtifact(bytes, expectedBuildId) {
  invariant(bytes.length <= MAX_ARCHIVE_BYTES, 'Asset artifact archive exceeds byte limit')
  const zip = await JSZip.loadAsync(bytes)
  const entries = Object.values(zip.files)
  invariant(entries.length <= MAX_FILES + 2, 'Asset archive has too many entries')
  let total = 0
  for (const entry of entries) {
    // JSZip sanitizes traversal names; reject the original rather than trusting it.
    invariant(!entry.unsafeOriginalName || entry.unsafeOriginalName === entry.name, 'Unsafe original archive path')
    invariant(entry.dir ? entry.name === 'assets/' : entry.name === 'manifest.json' || HASHED_ASSET.test(entry.name), `Unexpected asset archive entry: ${entry.name}`)
    const type = Number(entry.unixPermissions || 0) & 0o170000
    invariant(type === 0 || type === (entry.dir ? 0o040000 : 0o100000), 'Asset archive contains a symlink or special file')
    if (!entry.dir) {
      // Inspect ZIP-declared uncompressed lengths before asking JSZip to inflate.
      const size = entry._data?.uncompressedSize
      invariant(Number.isSafeInteger(size) && size >= 0 && size <= (entry.name === 'manifest.json' ? 1024 * 1024 : MAX_FILE_BYTES), 'Invalid uncompressed asset size')
      total += size
    }
  }
  invariant(total <= MAX_TOTAL_BYTES + 1024 * 1024, 'Uncompressed asset archive exceeds byte limit')
  invariant(zip.file('manifest.json'), 'Asset archive has no manifest')
  const manifest = validateManifest(JSON.parse(await zip.file('manifest.json').async('string')), expectedBuildId)
  invariant(entries.filter(entry => !entry.dir).length === manifest.files.length + 1, 'Archive entries do not match manifest')
  const assets = new Map()
  for (const file of manifest.files) {
    const entry = zip.file(file.path)
    invariant(entry, `Missing retained asset: ${file.path}`)
    const data = await entry.async('nodebuffer')
    invariant(data.length === file.size && sha256(data) === file.sha256, `Retained asset checksum mismatch: ${file.path}`)
    assets.set(file.path, data)
  }
  return { manifest, assets }
}

export async function mergeAssets(dist, generations) {
  invariant(generations.length <= 3, 'At most three previous asset generations may be retained')
  invariant((await lstat(resolve(dist, 'assets'))).isDirectory(), 'Destination assets must be a real directory')
  const pending = new Map()
  for (const { assets } of generations) {
    for (const [path, bytes] of assets) {
      invariant(HASHED_ASSET.test(path), 'Unsafe merge path')
      let existing = pending.get(path)
      if (!existing) {
        try {
          invariant((await lstat(resolve(dist, path))).isFile(), `Asset destination is not a regular file: ${path}`)
          existing = await readFile(resolve(dist, path))
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
      }
      invariant(!existing || existing.equals(bytes), `Asset filename collision with different bytes: ${path}`)
      if (!existing) pending.set(path, bytes)
    }
  }
  // Validate every collision before modifying the build.
  for (const [path, bytes] of pending) await writeFile(resolve(dist, path), bytes, { flag: 'wx' })
  return pending.size
}

async function limitedBody(response, maxBytes) {
  const chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    invariant(size <= maxBytes, 'GitHub response exceeds byte limit')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export async function previousArtifacts({ repository, currentRunId, currentRunAttempt = 1, request, log = console.log }) {
  invariant(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'Invalid repository identity')
  invariant(Number.isSafeInteger(currentRunAttempt) && currentRunAttempt > 0, 'Invalid current deployment attempt')
  const selected = []
  const workflow = await request(`/repos/${repository}/actions/workflows/deploy.yml`)
  invariant(Number.isSafeInteger(workflow.id), 'Invalid deployment workflow identity')
  const runs = new Map()
  // Artifact creation order also handles reruns of older workflow runs. Bound
  // discovery to 300 metadata entries and retain three actual deployments.
  for (let page = 1; page <= 3 && selected.length < 3; page++) {
    const result = await request(`/repos/${repository}/actions/artifacts?per_page=100&page=${page}`)
    invariant(Array.isArray(result.artifacts), 'Invalid workflow artifact response')
    for (const artifact of result.artifacts) {
      if (selected.length === 3) break
      const match = /^app-assets-([1-9][0-9]*)-([1-9][0-9]*)$/.exec(artifact.name)
      if (!match || (match[1] === String(currentRunId) && Number(match[2]) >= currentRunAttempt)) continue
      if (artifact.expired) { log(`Asset artifact ${artifact.name} has expired; skipping.`); continue }
      const runId = Number(match[1]), attempt = Number(match[2])
      invariant(Number.isSafeInteger(runId) && Number.isSafeInteger(attempt), 'Invalid deployment run identity')
      if (!runs.has(runId)) runs.set(runId, await request(`/repos/${repository}/actions/runs/${runId}`))
      const run = runs.get(runId)
      if (run.workflow_id !== workflow.id || run.head_branch !== 'main' || !['push', 'workflow_dispatch'].includes(run.event)) continue
      invariant(run.head_repository?.full_name === repository, 'Workflow run repository identity mismatch')
      invariant(artifact.workflow_run?.id === runId && run.id === runId, 'Artifact workflow run identity mismatch')
      invariant(/^[a-f0-9]{40}$/.test(run.head_sha), 'Invalid workflow revision')
      invariant(attempt <= run.run_attempt && Number.isSafeInteger(artifact.id) && Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= MAX_ARCHIVE_BYTES, 'Invalid deployment artifact metadata')
      selected.push({ id: artifact.id, buildId: `${run.head_sha}-${run.id}-${attempt}` })
    }
    if (result.artifacts.length < 100) break
  }
  if (!selected.length) log('No eligible previous asset artifacts found; starting asset retention with this deployment.')
  return selected
}

async function main() {
  const [command, distArg = 'dist', destinationArg = 'output/app-release/current'] = process.argv.slice(2)
  const dist = resolve(distArg)
  if (command === 'prepare') {
    const destination = resolve(destinationArg)
    await mkdir(resolve(destination, '..'), { recursive: true })
    const result = await prepareAssets(dist, destination)
    console.log(`Prepared ${result.files.length} fresh build assets for ${result.buildId}.`)
    return
  }
  invariant(command === 'retain', 'Usage: app-release.mjs prepare [dist] [artifact-directory] | retain [dist]')
  const repository = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN
  invariant(token && process.env.GITHUB_RUN_ID && process.env.GITHUB_REF === 'refs/heads/main', 'Asset retention requires an authenticated main workflow run')
  const request = async (path, binary = false) => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(60_000),
    })
    invariant(response.ok, `GitHub asset request failed (HTTP ${response.status})`)
    const bytes = await limitedBody(response, binary ? MAX_ARCHIVE_BYTES : 8 * 1024 * 1024)
    return binary ? bytes : JSON.parse(bytes.toString('utf8'))
  }
  const artifacts = await previousArtifacts({ repository, currentRunId: process.env.GITHUB_RUN_ID, currentRunAttempt: Number(process.env.GITHUB_RUN_ATTEMPT), request })
  const generations = []
  for (const artifact of artifacts) {
    const bytes = await request(`/repos/${repository}/actions/artifacts/${artifact.id}/zip`, true)
    generations.push(await decodeArtifact(bytes, artifact.buildId))
  }
  const count = await mergeAssets(dist, generations)
  console.log(`Retained ${count} assets from ${generations.length} previous deployments.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
