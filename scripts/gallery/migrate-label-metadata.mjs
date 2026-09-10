// Default mode generates local artifacts. --prepare reads D1/R2; --apply backs up and migrates the selected storage. Never deploys.
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'

export const migrationSnapshotQuery = `SELECT s.*, a.id AS pack_asset_id,a.r2_key AS pack_r2_key,a.sha256 AS pack_sha256,a.bytes AS pack_bytes,c.maker AS catalog_maker,c.blend AS catalog_blend FROM gallery_submissions s LEFT JOIN gallery_tobaccos c ON c.id=s.catalog_id LEFT JOIN gallery_assets a ON a.submission_id=s.id AND a.kind='pack' WHERE s.metadata_json IS NOT NULL ORDER BY s.id`
const hash = value => createHash('sha256').update(value).digest('hex')
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>`${JSON.stringify(key)}:${canonical(v)}`).join(',')}}` : JSON.stringify(value)
const sql = value => value == null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`
const fail = message => { throw Error(message) }
const check = condition => `INSERT INTO gallery_label_migration_checks(ok) SELECT CASE WHEN ${condition} THEN 1 ELSE 0 END; DELETE FROM gallery_label_migration_checks;`
export function simplifyMetadata(old) {
 if (old.version !== 1) fail('Expected v1 metadata')
 const surface = old.surface
 if (surface?.shape !== 'circle' || surface.finishedSize?.width !== 2.5 || surface.finishedSize?.height !== 2.5 || surface.finishedSize?.unit !== 'in' || [surface.bleed,surface.safeInset].some(inset=>inset?.unit !== 'in' || ['top','right','bottom','left'].some(key=>inset?.[key] !== .125))) fail('Unexpected artwork profile; cannot migrate')
 const area = old.writeInArea
 if (area?.purpose !== 'jarred-date' || area.background?.integratedInArtwork !== true || area.overlay?.mode !== 'blank' || (area.geometry?.rotationDegrees ?? 0) !== 0) fail('Unexpected writing area; cannot migrate')
 const { rotationDegrees: ignored, ...writingArea } = area.geometry
 void ignored
 const evidence = { ...(old.package && old.package !== 'unknown' ? { package: old.package } : {}), ...(old.variant && old.variant !== 'unknown' ? { variant: old.variant } : {}), ...(old.references?.length ? { references: old.references } : {}) }
 return { version: 2, submissionId: old.submissionId, tobacco: old.catalogId ? { catalogId: old.catalogId } : old.proposedIdentity, artworkProfileId: 'circle-2.5@1', writingArea, ...(old.edition?.trim() ? { edition: old.edition.trim() } : {}), ...(old.description?.trim() ? { altText: old.description.trim() } : {}), ...(Object.keys(evidence).length ? { evidence } : {}), image: old.image, acknowledgement: old.acknowledgement }
}
export async function migratePack(source, row, metadata) {
 if (hash(source) !== row.pack_sha256) fail(`Pack hash mismatch: ${row.id}`)
 const archive = await JSZip.loadAsync(source)
 const manifest = JSON.parse(await archive.file('manifest.json')?.async('string') ?? 'null')
 if (manifest?.labels?.length !== 1 || manifest.labels[0].maker !== (row.published_maker ?? row.catalog_maker ?? metadata.tobacco.maker) || manifest.labels[0].blend !== (row.published_blend ?? row.catalog_blend ?? metadata.tobacco.blend)) fail(`Pack identity mismatch: ${row.id}`)
 const label = manifest.labels[0], asset = manifest.assets[label.artworkAssetId]
 const artwork = await archive.file(asset?.path)?.async('uint8array')
 if (!artwork || hash(artwork) !== row.artwork_hash || asset.sha256 !== row.artwork_hash) fail(`Pack artwork mismatch: ${row.id}`)
 delete label.research
 delete label.edition
 delete label.altText
 if (metadata.edition) label.edition = metadata.edition
 if (metadata.altText) label.altText = metadata.altText
 const zip = new JSZip(), date = new Date('2000-01-01T00:00:00Z')
 zip.file('manifest.json', JSON.stringify(manifest,null,2)+'\n', { date, createFolders: false })
 zip.file(asset.path, artwork, { date, createFolders: false })
 return Buffer.from(await zip.generateAsync({ type:'uint8array',compression:'STORE',platform:'DOS' }))
}
export async function planMigration(rows, { readPack, now = new Date().toISOString() } = {}) {
 if (!Array.isArray(rows)) fail('Expected snapshot rows')
 const work=[], keys=new Map(), seen=new Set()
 for (const row of rows) {
  if (seen.has(row.id)) fail(`Duplicate snapshot row: ${row.id}`)
  seen.add(row.id)
  if (!row.metadata_json) continue
  const old=JSON.parse(row.metadata_json)
  if (![1,2].includes(old.version)) fail(`Unsupported metadata version: ${row.id}`)
  const metadata=old.version===2?old:simplifyMetadata(old)
  if (metadata.submissionId!==row.id || (metadata.tobacco?.catalogId ?? null)!==row.catalog_id) fail(`Metadata identity mismatch: ${row.id}`)
  const identity=canonical({tobacco:metadata.tobacco,artworkProfileId:metadata.artworkProfileId,writingArea:metadata.writingArea,edition:metadata.edition??''})
  const dedupe=row.artwork_hash ? hash(row.artwork_hash+identity):null
  if(row.state==='published') { if(keys.has(dedupe)) fail(`Published duplicate collision: ${keys.get(dedupe)} and ${row.id}`); keys.set(dedupe,row.id) }
  if(old.version===2) continue
  if(['uploading','preparing-publication'].includes(row.state)) fail(`In-flight operation must finish first: ${row.id}`)
  const metadataJson=canonical(metadata), metadataHash=hash(metadataJson)
  const digest=row.artwork_hash ? hash(`gallery-v2:${row.artwork_hash}:${metadataHash}:${row.catalog_id??''}`):null
  if(row.approval_digest && row.approval_digest!==row.digest) fail(`Approval digest mismatch requires review: ${row.id}`)
  if(['published','unpublished'].includes(row.state)&&!row.pack_r2_key) fail(`Missing publication pack: ${row.id}`)
  let pack=null
  if(row.pack_r2_key) {
   if(!readPack) fail('readPack is required for existing publication packs')
   const bytes=await migratePack(await readPack(row),row,metadata)
   const sha256=hash(bytes)
   pack={bytes,sha256,key:`gallery/${row.id}/metadata-v2-${sha256}.zip`,file:`${row.id}.cellarpack.zip`}
  }
  work.push({row,metadata,metadataJson,metadataHash,digest,dedupe,pack})
 }
 if(!work.length) return {sql:'-- No v1 label metadata remains.\n',uploads:[],count:0}
 const statements=[
  '-- Apply migration 0005 first. Close intake/publication and pause cleanup; upload and verify every planned pack before this file.',
  '-- Execute the entire file as ONE transaction. Never submit statements individually.',
  check('(SELECT intake=0 AND publication=0 FROM gallery_settings WHERE id=1)'),
  check("NOT EXISTS(SELECT 1 FROM gallery_submissions WHERE state IN('uploading','preparing-publication'))"),
  check(`(SELECT COUNT(*) FROM gallery_submissions WHERE metadata_json IS NOT NULL AND json_extract(metadata_json,'$.version')=1) IN (0,${work.length})`)
 ]
 for(const item of work) {
  const {row,metadataJson,pack}=item
  const already=`metadata_json=${sql(metadataJson)} AND row_version=${row.row_version+1}`
  const original=`metadata_json=${sql(row.metadata_json)} AND row_version=${row.row_version} AND digest IS ${sql(row.digest)} AND artwork_hash IS ${sql(row.artwork_hash)} AND state=${sql(row.state)}`
  statements.push(check(`EXISTS(SELECT 1 FROM gallery_submissions WHERE id=${sql(row.id)} AND ((${original}) OR (${already})))`))
  if(pack) statements.push(check(`EXISTS(SELECT 1 FROM gallery_assets WHERE id=${sql(row.pack_asset_id)} AND ((r2_key=${sql(row.pack_r2_key)} AND sha256=${sql(row.pack_sha256)}) OR (r2_key=${sql(pack.key)} AND sha256=${sql(pack.sha256)})))`))
 }
 for(const {row,metadataJson,metadataHash,digest,dedupe,pack} of work) {
  const original=`id=${sql(row.id)} AND row_version=${row.row_version} AND metadata_json=${sql(row.metadata_json)}`
  statements.push(`INSERT OR IGNORE INTO gallery_label_metadata_backups(submission_id,row_json,pack_asset_json,migrated_at) SELECT id,${sql(JSON.stringify(row))},${sql(row.pack_r2_key?JSON.stringify({id:row.pack_asset_id,r2_key:row.pack_r2_key,sha256:row.pack_sha256,bytes:row.pack_bytes}):null)},${sql(now)} FROM gallery_submissions WHERE ${original};`)
  statements.push(`INSERT INTO gallery_review_events(id,submission_id,actor,action,row_version,digest,created_at,before_version,before_digest,reason) SELECT ${sql('metadata-v2:'+row.id)},id,'system:label-metadata-v2','metadata-format-migration',row_version+1,${sql(digest)},${sql(now)},row_version,digest,'Representation simplified; artwork and publication identity preserved' FROM gallery_submissions WHERE ${original};`)
  if(pack) statements.push(`UPDATE gallery_assets SET r2_key=${sql(pack.key)},sha256=${sql(pack.sha256)},bytes=${pack.bytes.length} WHERE id=${sql(row.pack_asset_id)} AND EXISTS(SELECT 1 FROM gallery_submissions WHERE ${original});`)
  statements.push(`UPDATE gallery_submissions SET metadata_json=${sql(metadataJson)},metadata_hash=${sql(metadataHash)},request_hash=${sql(metadataHash)},digest=${sql(digest)},approval_digest=${sql(row.approval_digest?digest:null)},dedupe_hash=${sql(dedupe)},row_version=row_version+1${pack?',reserved_bytes=(SELECT COALESCE(SUM(bytes),0) FROM gallery_owned_storage WHERE submission_id=gallery_submissions.id)':''} WHERE ${original};`)
 }
 statements.push(check("NOT EXISTS(SELECT 1 FROM gallery_submissions WHERE metadata_json IS NOT NULL AND json_extract(metadata_json,'$.version')<>2)"))
 statements.push(check("(SELECT COALESCE(SUM(reserved_bytes),0) FROM gallery_submissions)<=8589934592"))
 return {sql:statements.join('\n')+'\n',uploads:work.filter(v=>v.pack).map(({row,pack})=>({...pack,id:row.id,previousKey:row.pack_r2_key})),count:work.length}
}
export async function preparePlan(args) {
 if(args.length!==4 || !['--local','--remote'].includes(args[1])) fail('Usage: npm run gallery:migrate-labels -- --prepare output-directory --local|--remote bucket-name wrangler-config-path')
 const [directory,target,bucket,configPath]=args
 if(!/^[a-z0-9][a-z0-9-]+$/.test(bucket)) fail('Invalid bucket name')
 const folder=resolve(directory),config=resolve(configPath),packs=join(folder,'source-packs')
 await mkdir(packs,{recursive:true})
 const run=(...argv)=>execFileSync('npm',['exec','--','wrangler',...argv,'--config',config],{encoding:'utf8',stdio:['ignore','pipe','inherit'],maxBuffer:64*1024*1024})
 const raw=JSON.parse(run('d1','execute','GALLERY',target,'--command',migrationSnapshotQuery,'--json'))
 const rows=raw.flatMap(block=>block.results??[])
 const snapshot=join(folder,'snapshot.json')
 await writeFile(snapshot,JSON.stringify(rows,null,2)+'\n')
 for(const row of rows) {
  if(!row.pack_r2_key || JSON.parse(row.metadata_json).version===2) continue
  if(!/^[a-f0-9-]{36}$/.test(row.id) || !row.pack_r2_key.startsWith(`gallery/${row.id}/`)) fail(`Unexpected stored pack key: ${row.id}`)
  run('r2','object','get',`${bucket}/${row.pack_r2_key}`,target,'--file',join(packs,`${row.id}.zip`))
 }
 await main([snapshot,packs,join(folder,'plan')])
}
export async function applyPlan(args) {
 if(args.length!==4 || !['--local','--remote'].includes(args[1])) fail('Usage: npm run gallery:migrate-labels -- --apply plan-directory --local|--remote bucket-name wrangler-config-path')
 const [directory,target,bucket,configPath]=args
 if(!/^[a-z0-9][a-z0-9-]+$/.test(bucket)) fail('Invalid bucket name')
 const folder=resolve(directory),config=resolve(configPath)
 const uploads=JSON.parse(await readFile(join(folder,'uploads.json'),'utf8'))
 const seal=JSON.parse(await readFile(join(folder,'plan.json'),'utf8'))
 if(seal.count===0) { console.log('No saved label metadata needs migration.'); return }
 const source=await readFile(join(folder,'migration.sql'),'utf8')
 if(hash(source)!==seal.sqlHash || hash(JSON.stringify(uploads))!==seal.uploadManifestHash) fail('Migration plan changed after generation; regenerate it')
 const run=(...argv)=>execFileSync('npm',['exec','--','wrangler',...argv,'--config',config],{encoding:'utf8',stdio:['ignore','pipe','inherit'],maxBuffer:64*1024*1024})
 const status=JSON.parse(run('d1','execute','GALLERY',target,'--command',"SELECT intake,publication FROM gallery_settings WHERE id=1",'--json')).flatMap(block=>block.results??[])[0]
 if(status?.intake!==0 || status?.publication!==0) fail('Close gallery intake and publication before applying this migration')
 const backup=join(folder,`database-before-${Date.now()}.sql`)
 run('d1','export','GALLERY',target,'--output',backup)
 const temporary=await mkdtemp(join(tmpdir(),'gallery-metadata-v2-'))
 for(const upload of uploads) {
  if(!/^[0-9a-f-]+\.cellarpack\.zip$/.test(upload.file) || !/^gallery\/[0-9a-f-]+\/metadata-v2-[a-f0-9]{64}\.zip$/.test(upload.key)) fail('Invalid generated pack path')
  const file=join(folder,upload.file)
  if(hash(await readFile(file))!==upload.sha256) fail(`Generated pack changed: ${upload.id}`)
  run('r2','object','put',`${bucket}/${upload.key}`,target,'--file',file,'--content-type','application/zip')
  const downloaded=join(temporary,upload.file)
  run('r2','object','get',`${bucket}/${upload.key}`,target,'--file',downloaded)
  if(hash(await readFile(downloaded))!==upload.sha256) fail(`Uploaded pack did not verify: ${upload.id}`)
 }
 // Wrangler's SQL file import is the D1 transaction boundary; do not split this file.
 run('d1','execute','GALLERY',target,'--file',join(folder,'migration.sql'),'--yes')
 const results=JSON.parse(run('d1','execute','GALLERY',target,'--command',migrationSnapshotQuery,'--json')).flatMap(block=>block.results??[])
 for(const row of results) {
  const m=JSON.parse(row.metadata_json)
  const metadataHash=hash(canonical(m))
  const digest=row.artwork_hash?hash(`gallery-v2:${row.artwork_hash}:${metadataHash}:${row.catalog_id??''}`):null
  if(m.version!==2 || row.metadata_hash!==metadataHash || row.digest!==digest || row.approval_digest && row.approval_digest!==digest) fail(`Post-migration integrity check failed: ${row.id}`)
 }
 console.log(`Migrated and verified ${results.length} saved labels. Database backup: ${backup}. Intake/publication remain closed; deploy matching code before reopening.`)
}
export async function main(args) {
 if(args[0]==='--prepare') return preparePlan(args.slice(1))
 if(args[0]==='--apply') return applyPlan(args.slice(1))
 if(args[0]==='--query') {console.log(migrationSnapshotQuery);return}
 if(args.length!==3) fail('Usage: npm run gallery:migrate-labels -- snapshot.json downloaded-packs-directory output-directory; or --query')
 const [snapshot,packs,output]=args.map(value=>resolve(value))
 const raw=JSON.parse(await readFile(snapshot,'utf8'))
 const rows=Array.isArray(raw)&&raw[0]?.results?raw.flatMap(block=>block.results):raw
 const plan=await planMigration(rows,{readPack:row=>readFile(join(packs,`${row.id}.zip`))})
 await mkdir(output,{recursive:true})
 for(const upload of plan.uploads) await writeFile(join(output,upload.file),upload.bytes)
 await writeFile(join(output,'migration.sql'),plan.sql)
 const uploadManifest=plan.uploads.map(({bytes,...upload})=>({...upload,bytes:bytes.length}))
 await writeFile(join(output,'uploads.json'),JSON.stringify(uploadManifest,null,2)+'\n')
 await writeFile(join(output,'plan.json'),JSON.stringify({count:plan.count,sqlHash:hash(plan.sql),uploadManifestHash:hash(JSON.stringify(uploadManifest))},null,2)+'\n')
 await writeFile(join(output,'README.txt'),`Prepared ${plan.count} metadata changes and ${plan.uploads.length} replacement pack files. No remote action occurred.\nApply 0005, close intake/publication, pause cleanup, and take a fresh database backup and snapshot. Upload each file to its exact uploads.json R2 key and verify remote SHA-256 before applying migration.sql atomically. Keep original R2 objects and this snapshot. Deploy matching v2 code during maintenance before reopening. Re-running the SQL is a no-op for matching migrated rows; concurrent changes abort.\n`)
 console.log(`Prepared ${plan.count} label migrations and ${plan.uploads.length} packs in ${output}. Nothing uploaded, migrated remotely, or deployed.`)
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href) await main(process.argv.slice(2))
