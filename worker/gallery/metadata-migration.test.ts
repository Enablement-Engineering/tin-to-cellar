// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { encode } from 'fast-png'
import { describe, expect, it } from 'vitest'
import { unstable_splitSqlQuery } from 'wrangler'
import { importCellarPack } from '../../src/lib/cellarpack/importer'
import { canonicalJson, parseGalleryDraft } from '../../src/lib/gallery/schema'
// @ts-expect-error Local one-time operational script is exercised against the real SQLite schema.
import { planMigration, simplifyMetadata, migrationSnapshotQuery } from '../../scripts/gallery/migrate-label-metadata.mjs'
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
const id='43649b43-8094-4a32-b5ee-8be75208fb63'
async function fixture() {
 const db = new DatabaseSync(':memory:')
 for(const name of readdirSync(new URL('../../migrations/gallery/',import.meta.url)).filter(v=>v.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(`../../migrations/gallery/${name}`,import.meta.url),'utf8'))
 db.exec("INSERT INTO gallery_tobaccos VALUES('test-blend','Test','Blend','[]',1,'test')")
 const artwork = encode({width:825,height:825,channels:3,data:new Uint8Array(825*825*3).fill(220)})
 const surface={shape:'circle',finishedSize:{width:2.5,height:2.5,unit:'in'},bleed:{top:.125,right:.125,bottom:.125,left:.125,unit:'in'},safeInset:{top:.125,right:.125,bottom:.125,left:.125,unit:'in'}}
 const area={id:'date',purpose:'jarred-date',geometry:{shape:'rectangle',x:.35,y:.55,width:.3,height:.1,rotationDegrees:0},background:{integratedInArtwork:true},overlay:{mode:'blank'}}
 const old={version:1,submissionId:id,catalogId:'test-blend',proposedIdentity:null,package:'tin',variant:'historical',edition:'1996',description:'Test Blend historical label',surface,writeInArea:area,references:[],image:{sha256:sha(artwork),bytes:artwork.length,width:825,height:825},acknowledgement:{version:'2026-09-06-v2',accepted:true}}
 const metadata=canonicalJson(old),hash=sha(metadata),digest=sha(`gallery-v1:${sha(artwork)}:${hash}:test-blend`)
 const manifest={format:'tin-to-cellar/cellarpack',schemaVersion:'0.1.0',packId:`urn:uuid:${id}`,createdAt:'2026-09-06T00:00:00Z',generator:{name:'test',version:'1'},labels:[{id:'shared-label',maker:'Test',blend:'Blend',artworkAssetId:'artwork',surface,writeInAreas:[area],research:{status:'limited',observedPackage:{format:'tin',variant:'historical',variantDateOrEdition:'1996'}}}],assets:{artwork:{path:'artwork/label.png',mediaType:'image/png',pixelWidth:825,pixelHeight:825,sha256:sha(artwork),colorSpace:'sRGB',alpha:false}},defaultPrintIntent:{sheetProfileId:'tin-to-cellar:avery-94502@1'}}
 const zip=new JSZip();zip.file('manifest.json',JSON.stringify(manifest));zip.file('artwork/label.png',artwork)
 const pack=await zip.generateAsync({type:'uint8array'})
 db.prepare("INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,metadata_json,metadata_hash,artwork_hash,digest,catalog_id,input_bytes,quota_key,approval_digest,published_maker,published_blend,publication_id,published_at) VALUES(?,'cap',?,'published','2026-09-06T00:00:00Z','2027-09-06T00:00:00Z',?,?,?,?, 'test-blend',?,'fixture',?,'Test','Blend',?,'2026-09-06T00:00:00Z')").run(id,hash,metadata,hash,sha(artwork),digest,artwork.length,digest,id)
 for(const [kind,bytes] of [['artwork',artwork],['thumbnail',artwork],['pack',pack]] as const)db.prepare('INSERT INTO gallery_assets VALUES(?,?,?,?,?,?)').run(`${kind}:${id}`,id,kind,`old/${kind}`,sha(bytes),bytes.length)
 const rows=db.prepare(migrationSnapshotQuery).all()
 return {db,rows,pack,artwork,digest,old}
}
function execute(db:DatabaseSync,source:string) { db.exec('BEGIN');try{for(const statement of unstable_splitSqlQuery(source))db.exec(statement);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e} }
describe('one-time label metadata migration',()=>{
 it('migrates an existing publication atomically with valid digests, the same artwork, and edition in the regenerated pack',async()=>{
  const {db,rows,pack,artwork,digest,old}=await fixture()
  const plan=await planMigration(rows,{readPack:async()=>pack,now:'2026-09-10T00:00:00Z'})
  expect(plan.count).toBe(1);expect(plan.uploads).toHaveLength(1)
  expect(parseGalleryDraft(simplifyMetadata(old)).edition).toBe('1996')
  const imported=await importCellarPack(Uint8Array.from(plan.uploads[0].bytes).buffer)
  expect(imported.status).toBe('ready');expect(imported.labels[0].label.edition).toBe('1996');expect(imported.labels[0].label.research).toBeUndefined();expect(sha(new Uint8Array(imported.labels[0].artwork.data))).toBe(sha(artwork))
  execute(db,plan.sql)
  const row=db.prepare('SELECT * FROM gallery_submissions WHERE id=?').get(id)!
  const parsed=parseGalleryDraft(JSON.parse(String(row.metadata_json)))
  expect(row.metadata_hash).toBe(sha(canonicalJson(parsed)))
  expect(row.digest).toBe(sha(`gallery-v2:${sha(artwork)}:${row.metadata_hash}:test-blend`))
  expect(Number(row.reserved_bytes)).toBe(artwork.length * 2 + pack.length + plan.uploads[0].bytes.length)
  expect(row.approval_digest).toBe(row.digest);expect(row.digest).not.toBe(digest);expect(row.state).toBe('published');expect(row.publication_id).toBe(id)
  expect(db.prepare("SELECT r2_key FROM gallery_assets WHERE kind='artwork'").get()!.r2_key).toBe('old/artwork')
  expect(db.prepare("SELECT r2_key FROM gallery_assets WHERE kind='pack'").get()!.r2_key).toBe(plan.uploads[0].key)
  expect(db.prepare('SELECT before_digest FROM gallery_review_events').get()!.before_digest).toBe(digest)
  expect(JSON.parse(String(db.prepare('SELECT row_json FROM gallery_label_metadata_backups').get()!.row_json)).metadata_json).toBe(canonicalJson(old))
  execute(db,plan.sql)
  expect(db.prepare('SELECT row_version FROM gallery_submissions').get()!.row_version).toBe(2)
  expect(db.prepare('SELECT COUNT(*) AS n FROM gallery_review_events').get()!.n).toBe(1)
  expect((await planMigration(db.prepare(migrationSnapshotQuery).all())).count).toBe(0)
  db.close()
 })
 it('rejects concurrent changes before altering any row or pack pointer',async()=>{
  const {db,rows,pack}=await fixture();const plan=await planMigration(rows,{readPack:async()=>pack})
  db.exec('UPDATE gallery_submissions SET row_version=row_version+1')
  expect(()=>execute(db,plan.sql)).toThrow('CHECK constraint failed')
  expect(JSON.parse(String(db.prepare('SELECT metadata_json FROM gallery_submissions').get()!.metadata_json)).version).toBe(1)
  expect(db.prepare("SELECT r2_key FROM gallery_assets WHERE kind='pack'").get()!.r2_key).toBe('old/pack');db.close()
 })
 it('refuses altered pack bytes, duplicate publication identities, and open intake',async()=>{
  const {db,rows,pack}=await fixture()
  await expect(planMigration(rows,{readPack:async()=>new Uint8Array([1,2])})).rejects.toThrow('Pack hash mismatch')
  const duplicate:Record<string,unknown>={...rows[0],id:crypto.randomUUID()};const metadata=JSON.parse(String(duplicate.metadata_json));metadata.submissionId=duplicate.id;duplicate.metadata_json=canonicalJson(metadata)
  await expect(planMigration([...rows,duplicate],{readPack:async()=>pack})).rejects.toThrow('Published duplicate collision')
  const plan=await planMigration(rows,{readPack:async()=>pack});db.exec('UPDATE gallery_settings SET intake=1')
  expect(()=>execute(db,plan.sql)).toThrow('CHECK constraint failed');db.close()
 })
})
