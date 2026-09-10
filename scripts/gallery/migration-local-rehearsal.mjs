// Opt-in local D1/R2 rehearsal. Every Wrangler storage command explicitly uses --local.
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { encode } from 'fast-png'
import JSZip from 'jszip'
import assert from 'node:assert/strict'

const root=process.cwd(),work=await mkdtemp(join(tmpdir(),'gallery-migration-rehearsal-'))
const config=join(work,'wrangler.json'),bucket='gallery-migration-rehearsal',id='43649b43-8094-4a32-b5ee-8be75208fb63'
await writeFile(config,JSON.stringify({name:bucket,compatibility_date:'2026-09-05',d1_databases:[{binding:'GALLERY',database_name:bucket,database_id:'00000000-0000-0000-0000-000000000099',migrations_dir:resolve('migrations/gallery')}],r2_buckets:[{binding:'GALLERY_ART',bucket_name:bucket}]}))
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:join(work,'wrangler.log'),CI:'1'}
const npm=(args)=>execFileSync('npm',args,{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024})
const wrangler=(...args)=>npm(['exec','--','wrangler',...args,'--config',config])
const query=(command)=>JSON.parse(wrangler('d1','execute','GALLERY','--local','--command',command,'--json')).flatMap(v=>v.results??[])
const quote=value=>`'${String(value).replaceAll("'","''")}'`
const hash=value=>createHash('sha256').update(value).digest('hex')
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`:JSON.stringify(value)
wrangler('d1','migrations','apply','GALLERY','--local')
const artwork=encode({width:825,height:825,channels:3,data:new Uint8Array(825*825*3).fill(230)})
const surface={shape:'circle',finishedSize:{width:2.5,height:2.5,unit:'in'},bleed:{top:.125,right:.125,bottom:.125,left:.125,unit:'in'},safeInset:{top:.125,right:.125,bottom:.125,left:.125,unit:'in'}}
const area={id:'date',purpose:'jarred-date',geometry:{shape:'rectangle',x:.35,y:.55,width:.3,height:.1},background:{integratedInArtwork:true},overlay:{mode:'blank'}}
const metadata={version:1,submissionId:id,catalogId:'test-blend',proposedIdentity:null,package:'tin',variant:'historical',edition:'1996',description:'Synthetic migration artwork',surface,writeInArea:area,references:[],image:{sha256:hash(artwork),bytes:artwork.length,width:825,height:825},acknowledgement:{version:'2026-09-06-v2',accepted:true}}
const serialized=canonical(metadata),digest=hash(`gallery-v1:${hash(artwork)}:${hash(serialized)}:test-blend`)
const manifest={format:'tin-to-cellar/cellarpack',schemaVersion:'0.1.0',packId:`urn:uuid:${id}`,createdAt:'2026-09-06T00:00:00Z',generator:{name:'synthetic migration rehearsal',version:'1'},labels:[{id:'shared-label',maker:'Test',blend:'Blend',artworkAssetId:'artwork',surface,writeInAreas:[area],research:{observedPackage:{variantDateOrEdition:'1996'}}}],assets:{artwork:{path:'artwork/label.png',mediaType:'image/png',pixelWidth:825,pixelHeight:825,sha256:hash(artwork),colorSpace:'sRGB',alpha:false}}}
const zip=new JSZip();zip.file('manifest.json',JSON.stringify(manifest));zip.file('artwork/label.png',artwork)
const pack=await zip.generateAsync({type:'nodebuffer'}),packKey=`gallery/${id}/original-pack.zip`
await writeFile(join(work,'original.zip'),pack)
wrangler('r2','object','put',`${bucket}/${packKey}`,'--local','--file',join(work,'original.zip'))
query(`INSERT INTO gallery_tobaccos VALUES('test-blend','Test','Blend','[]',1,'fixture'); INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,metadata_json,metadata_hash,artwork_hash,digest,catalog_id,input_bytes,quota_key,approval_digest,published_maker,published_blend,publication_id,published_at) VALUES(${quote(id)},'cap',${quote(hash(serialized))},'published','2026-09-06T00:00:00Z','2027-09-06T00:00:00Z',${quote(serialized)},${quote(hash(serialized))},${quote(hash(artwork))},${quote(digest)},'test-blend',${artwork.length},'fixture',${quote(digest)},'Test','Blend',${quote(id)},'2026-09-06T00:00:00Z'); INSERT INTO gallery_assets VALUES('pack-id',${quote(id)},'pack',${quote(packKey)},${quote(hash(pack))},${pack.length});`)
const output=join(work,'output')
const cli=(...args)=>npm(['run','gallery:migrate-labels','--',...args])
cli('--prepare',output,'--local',bucket,config)
const plan=join(output,'plan'),source=await readFile(join(plan,'migration.sql'),'utf8')
const before=query('SELECT * FROM gallery_submissions')[0]
query('UPDATE gallery_submissions SET row_version=2')
let staleFailed=false
try{cli('--apply',plan,'--local',bucket,config)}catch(error){staleFailed=true;await writeFile(join(work,'stale-error.txt'),String(error.stderr)+String(error.stdout))}
assert.equal(staleFailed,true)
assert.equal(query('SELECT metadata_json FROM gallery_submissions')[0].metadata_json,serialized)
assert.equal(query('SELECT r2_key FROM gallery_assets')[0].r2_key,packKey)
assert.equal(query('SELECT COUNT(*) AS n FROM gallery_label_metadata_backups')[0].n,0)
query('UPDATE gallery_submissions SET row_version=1')
const lateFailure=join(work,'late-failure.sql');await writeFile(lateFailure,source+'\nINSERT INTO gallery_label_migration_checks(ok) VALUES(0);\n')
let lateFailed=false
try{wrangler('d1','execute','GALLERY','--local','--file',lateFailure,'--yes')}catch(error){lateFailed=true;await writeFile(join(work,'late-error.txt'),String(error.stderr)+String(error.stdout))}
assert.equal(lateFailed,true)
assert.deepEqual(query('SELECT * FROM gallery_submissions')[0],before)
assert.equal(query('SELECT r2_key FROM gallery_assets')[0].r2_key,packKey)
assert.equal(query('SELECT COUNT(*) AS n FROM gallery_label_metadata_backups')[0].n,0)
assert.equal(query('SELECT COUNT(*) AS n FROM gallery_review_events')[0].n,0)
const applyOutput=cli('--apply',plan,'--local',bucket,config)
const migrated=query('SELECT * FROM gallery_submissions')[0],parsed=JSON.parse(migrated.metadata_json)
assert.equal(parsed.version,2);assert.equal(parsed.edition,'1996');assert.equal(migrated.state,'published');assert.equal(migrated.publication_id,id)
assert.equal(migrated.reserved_bytes,Number(query('SELECT SUM(bytes) AS n FROM gallery_assets')[0].n)+pack.length);
assert.equal(migrated.artwork_hash,hash(artwork));assert.equal(migrated.metadata_hash,hash(canonical(parsed)))
assert.equal(migrated.digest,hash(`gallery-v2:${hash(artwork)}:${migrated.metadata_hash}:test-blend`));assert.equal(migrated.approval_digest,migrated.digest)
const migratedAsset=query('SELECT * FROM gallery_assets')[0],download=join(work,'migrated.zip')
wrangler('r2','object','get',`${bucket}/${migratedAsset.r2_key}`,'--local','--file',download)
const bytes=await readFile(download);assert.equal(hash(bytes),migratedAsset.sha256)
const imported=await JSZip.loadAsync(bytes),newManifest=JSON.parse(await imported.file('manifest.json').async('string'))
assert.equal(newManifest.labels[0].edition,'1996');assert.equal(newManifest.labels[0].research,undefined)
assert.equal(hash(await imported.file('artwork/label.png').async('uint8array')),hash(artwork))
cli('--apply',plan,'--local',bucket,config)
assert.equal(query('SELECT row_version FROM gallery_submissions')[0].row_version,2)
assert.equal(query('SELECT COUNT(*) AS n FROM gallery_review_events')[0].n,1)
await mkdir(join(work,'proof'),{recursive:true})
const report={work,wranglerVersion:wrangler('--version').trim(),stalePlanRejected:true,lateFailureRolledBackAllWrites:true,validApplyVerified:true,replayIdempotent:true,editionPreserved:true,retainedPackBytesCounted:true,artworkSha256:hash(artwork),remoteCalls:0}
await writeFile(join(work,'proof','result.json'),JSON.stringify(report,null,2)+'\n')
await writeFile(join(work,'proof','apply-output.txt'),applyOutput)
console.log(JSON.stringify(report,null,2))
