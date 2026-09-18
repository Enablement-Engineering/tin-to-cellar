// Reads anonymous public thumbnails and writes a local SQL backfill. Never applies it or deploys.
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { parseArgs } from 'node:util'
import { decode } from 'fast-png'
import { galleryPreview, validGalleryPreview } from '../../src/lib/gallery/preview.ts'

export function previewUpdate(id, thumbnail) {
  if (!/^[a-f0-9-]{36}$/.test(id) || thumbnail.length > 1024 * 1024 || thumbnail.length < 33) throw Error('Invalid thumbnail input')
  // Bound allocation before decoding even if the public endpoint is misconfigured.
  const header = new DataView(thumbnail.buffer, thumbnail.byteOffset, thumbnail.byteLength)
  if (header.getUint32(16) !== 320 || header.getUint32(20) !== 320) throw Error('Expected a 320px thumbnail')
  const image = decode(thumbnail)
  if (image.depth !== 8 || !(image.data instanceof Uint8Array)) throw Error('Expected 8-bit pixels')
  const preview = galleryPreview(image.data, image.width, image.height, image.channels)
  if (!validGalleryPreview(preview)) throw Error('Preview exceeds size limit')
  const hash = createHash('sha256').update(thumbnail).digest('hex')
  // Match the exact thumbnail bytes and currently published state; never overwrite a newer preview.
  return `UPDATE gallery_assets SET preview_data_url='${preview}' WHERE submission_id='${id}' AND kind='thumbnail' AND sha256='${hash}' AND preview_data_url IS NULL AND EXISTS(SELECT 1 FROM gallery_submissions WHERE id='${id}' AND state='published');`
}

async function read(url, limit) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' })
  if (!response.ok) throw Error(`Download failed: ${response.status} ${url}`)
  const chunks = []; let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > limit) throw Error('Response too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function main() {
  const { values } = parseArgs({ options: { origin: { type: 'string' }, out: { type: 'string' } } })
  if (!values.origin || !values.out) throw Error('Usage: npm run gallery:prepare-previews -- --origin https://tintocellar.com --out output/gallery-previews')
  const origin = new URL(values.origin)
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' || !(origin.protocol === 'https:' || origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname))) throw Error('Expected an HTTPS origin or local test server')
  const statements = [], seen = new Set(), cursors = new Set()
  let cursor = ''
  do {
    const url = new URL('/api/gallery/v1/browse', origin)
    if (cursor) url.searchParams.set('cursor', cursor)
    const page = JSON.parse((await read(url, 1024 * 1024)).toString())
    if (page.serving === false || !Array.isArray(page.labels)) throw Error('Gallery unavailable')
    for (const label of page.labels) {
      if (!/^[a-f0-9-]{36}$/.test(label.id) || seen.has(label.id) || seen.size >= 10000) throw Error('Invalid or repeated gallery record')
      seen.add(label.id)
      if (validGalleryPreview(label.previewDataUrl)) continue
      const thumbnail = await read(new URL(`/api/gallery/v1/labels/${label.id}/thumbnail`, origin), 1024 * 1024)
      statements.push(previewUpdate(label.id, thumbnail))
    }
    cursor = page.nextCursor ?? ''
    if (cursor && (!/^[a-f0-9-]{36}$/.test(cursor) || cursors.has(cursor))) throw Error('Invalid or repeated cursor')
    cursors.add(cursor)
  } while (cursor)
  const directory = resolve(values.out)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'previews.sql'), '-- Apply schema migration 0010 first. Only display previews are changed.\n' + statements.join('\n') + '\n')
  await writeFile(join(directory, 'summary.json'), JSON.stringify({ origin: origin.origin, preparedAt: new Date().toISOString(), inspected: seen.size, previews: statements.length }, null, 2) + '\n')
  console.log(`Prepared ${statements.length} previews in ${directory}. No database changes made.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()
