// Copies only anonymous public downloads into an explicitly local gallery.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import JSZip from 'jszip'
import { getPlatformProxy } from 'wrangler'

const work = resolve(process.argv[2] ?? '')
if (!work.startsWith(resolve('.wrangler') + '/') || !process.argv[2]) throw Error('Pass a .wrangler/gallery-* directory')
const configPath = join(work, 'wrangler.json')
const config = JSON.parse(await readFile(configPath, 'utf8'))
if (config.name !== 'tin-to-cellar-local-gallery' || config.d1_databases?.length !== 1 || config.d1_databases[0].database_id !== '00000000-0000-0000-0000-000000000001' || config.r2_buckets?.length !== 1 || config.r2_buckets[0].bucket_name !== 'local-gallery') throw Error('Refusing a non-local gallery configuration')
const cache = resolve('.wrangler/public-gallery-downloads')
await mkdir(cache, { recursive: true })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const pause = ms => new Promise(done => setTimeout(done, ms))
async function download(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`https://tintocellar.com/api/gallery/v1${path}`, { redirect: 'error', signal: AbortSignal.timeout(60000) })
    if (response.status === 429) {
      const seconds = Math.max(60, Number(response.headers.get('retry-after')) || 60)
      console.log(`Public download limit reached; retrying in ${seconds}s`)
      await pause(seconds * 1000)
      continue
    }
    if (!response.ok) throw Error(`${path}: HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  throw Error(`Download retry limit: ${path}`)
}
const labels = []
let cursor = ''
const seen = new Set()
do {
  const page = JSON.parse((await download(`/labels${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)).toString())
  if (page.serving !== true) throw Error('Production gallery is not serving')
  for (const label of page.labels) {
    if (!/^[a-f0-9-]{36}$/.test(label.id) || seen.has(label.id)) throw Error('Invalid or repeated public label ID')
    seen.add(label.id); labels.push(label)
  }
  cursor = page.nextCursor
} while (cursor)
await writeFile(join(cache, 'labels.json'), JSON.stringify(labels, null, 2))
console.log(`Found ${labels.length} published labels. Target: ${work}`)
const proxy = await getPlatformProxy({ configPath, persist: { path: join(work, 'state/v3') }, remoteBindings: false, envFiles: [] })
try {
  const db = proxy.env.GALLERY
  const bucket = proxy.env.GALLERY_ART
  await db.prepare('SELECT COUNT(*) AS n FROM gallery_settings').first()
  for (const [index, label] of labels.entries()) {
    if (await db.prepare('SELECT id FROM gallery_submissions WHERE id=?').bind(label.id).first()) continue
    const packPath = join(cache, `${label.id}.zip`)
    let pack
    try { pack = await readFile(packPath) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      pack = await download(`/labels/${label.id}/pack`)
      await writeFile(packPath, pack)
      // Stay below the public pack budget even during a large copy.
      await pause(1100)
    }
    const zip = await JSZip.loadAsync(pack)
    const manifest = JSON.parse(await zip.file('manifest.json').async('string'))
    if (manifest.labels.length !== 1) throw Error(`Unexpected pack: ${label.id}`)
    const packedLabel = manifest.labels[0]
    const asset = manifest.assets[packedLabel.artworkAssetId]
    const artwork = await zip.file(asset.path).async('nodebuffer')
    if (hash(artwork) !== asset.sha256) throw Error(`Artwork hash mismatch: ${label.id}`)
    const thumbnail = await download(`/labels/${label.id}/thumbnail`)
    const metadata = { version: 2, submissionId: label.id, tobacco: label.catalogId ? { catalogId: label.catalogId } : { maker: label.maker, blend: label.blend }, artworkProfileId: label.artworkProfileId, writingArea: packedLabel.writeInAreas[0].geometry, image: { sha256: asset.sha256, bytes: artwork.length, width: asset.pixelWidth, height: asset.pixelHeight }, acknowledgement: { version: '2026-09-06-v2', accepted: true }, ...(label.edition ? { edition: label.edition } : {}), altText: label.altText }
    const metadataJson = JSON.stringify(metadata)
    const digest = hash(pack)
    const assets = []
    for (const [kind, bytes] of [['pack', pack], ['artwork', artwork], ['thumbnail', thumbnail]]) {
      const key = `public-snapshot/${label.id}/${kind}`
      await bucket.put(key, bytes)
      const stored = await bucket.get(key)
      if (!stored || hash(Buffer.from(await stored.arrayBuffer())) !== hash(bytes)) throw Error(`Local R2 verification failed: ${key}`)
      assets.push(db.prepare('INSERT INTO gallery_assets(id,submission_id,kind,r2_key,sha256,bytes) VALUES(?,?,?,?,?,?)').bind(randomUUID(), label.id, kind, key, hash(bytes), bytes.length))
    }
    const statements = []
    if (label.catalogId) statements.push(db.prepare("INSERT OR IGNORE INTO gallery_tobaccos VALUES(?,?,?,'[]',1,'public-snapshot')").bind(label.catalogId, label.maker, label.blend))
    // The owner-import exemption is used only in this guarded local database.
    // No production capability, reviewer identity, or private submission is copied.
    statements.push(db.prepare(`INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,metadata_json,metadata_hash,artwork_hash,digest,catalog_id,reserved_bytes,input_bytes,quota_key,reviewer,published_at,publication_id,approval_digest,published_maker,published_blend,reason)
      VALUES(?,?,?,'published',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(label.id, hash(randomUUID()), digest, label.publishedAt, '9999-12-31T00:00:00.000Z', metadataJson, hash(metadataJson), asset.sha256, digest, label.catalogId, pack.length + artwork.length + thumbnail.length, artwork.length, `owner-pilot:local-public-snapshot:${label.id}`, 'owner-authorized-cli', label.publishedAt, label.id, digest, label.maker, label.blend, 'Local copy of anonymous public gallery downloads'))
    await db.batch([...statements, ...assets])
    if ((index + 1) % 10 === 0 || index === 0 || index + 1 === labels.length) console.log(`Seeded ${index + 1}/${labels.length}`)
  }
  const count = await db.prepare("SELECT COUNT(*) AS n FROM gallery_submissions WHERE state='published'").first()
  console.log(`Complete: ${count.n} local published labels; original artwork, thumbnails, and packs verified in local R2.`)
} finally { await proxy.dispose() }
