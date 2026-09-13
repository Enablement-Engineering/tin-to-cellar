// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { unstable_splitSqlQuery } from 'wrangler'
import { expect, it } from 'vitest'

it('applies migration batches using the installed Wrangler statement splitter, preserving triggers',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec('PRAGMA foreign_keys=ON; CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT UNIQUE,applied_at TEXT DEFAULT CURRENT_TIMESTAMP)')
 const files=readdirSync(new URL('../../migrations/gallery/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()
 for(const name of files){
  const source=readFileSync(new URL(`../../migrations/gallery/${name}`,import.meta.url),'utf8')
  // Match Wrangler buildMigrationQuery: the migration-tracking insert is in the same batch.
  const statements=unstable_splitSqlQuery(`${source}\nINSERT INTO d1_migrations(name) VALUES ('${name}');`)
  db.exec('BEGIN')
  try{for(const sql of statements)db.exec(sql);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
 }
 expect(db.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get()!.n).toBe(files.length)
 expect(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all().map(r=>r.name)).toEqual(['gallery_admit','gallery_agent_quota_insert','gallery_agent_quota_update','gallery_clear_quota','gallery_grant_limit','gallery_recommendation_guard'])
 const insert=db.prepare("INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,input_bytes,quota_key) VALUES(?,'cap','hash','reserved','2026-09-06T00:00:00.000Z','2026-09-07T00:00:00.000Z',100,'same-ip')")
 for(let i=0;i<20;i++)insert.run(crypto.randomUUID())
 expect(()=>insert.run(crypto.randomUUID())).toThrow('gallery_capacity')
 expect(db.prepare('SELECT COUNT(*) AS n FROM gallery_submissions').get()!.n).toBe(20)
 expect(db.prepare("SELECT admissions FROM gallery_admission WHERE bucket='same-ip'").get()!.admissions).toBe(20)
 expect(db.prepare("SELECT COUNT(*) AS n FROM gallery_submissions WHERE quota_key<>''").get()!.n).toBe(0)
 const owner=db.prepare("INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,input_bytes,quota_key,reviewer,publication_id,digest,approval_digest) VALUES(?,'cap','hash','published','2026-09-06T00:00:00.000Z','2027-09-06T00:00:00.000Z',100,'owner-pilot:2026-09-06','owner-authorized-cli',?,'approved','approved')")
 for(let i=0;i<25;i++){const id=crypto.randomUUID();owner.run(id,id)}
 expect(db.prepare('SELECT COUNT(*) AS n FROM gallery_submissions').get()!.n).toBe(45)
 expect(db.prepare("SELECT admissions FROM gallery_admission WHERE bucket='site:2026-09-06'").get()!.admissions).toBe(20)
 expect(db.prepare("SELECT COUNT(*) AS n FROM gallery_admission WHERE bucket='owner-pilot:2026-09-06'").get()!.n).toBe(0)
 expect(()=>db.prepare("INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,input_bytes,quota_key,reviewer) VALUES(?,'cap','hash','reserved','2026-09-06T00:00:00.000Z','2026-09-07T00:00:00.000Z',100,'same-ip','owner-authorized-cli')").run(crypto.randomUUID())).toThrow('gallery_capacity')
 const publicKey=db.prepare("INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,input_bytes,quota_key) VALUES(?,'cap','hash','reserved','2026-09-06T00:00:00.000Z','2026-09-07T00:00:00.000Z',100,?)")
 for(let i=0;i<80;i++)publicKey.run(crypto.randomUUID(),`other-ip-${i}`)
 expect(db.prepare("SELECT admissions FROM gallery_admission WHERE bucket='site:2026-09-06'").get()!.admissions).toBe(100)
 expect(()=>publicKey.run(crypto.randomUUID(),'one-more-ip')).toThrow('gallery_capacity')
 for(let i=0;i<79;i++){const id=crypto.randomUUID();owner.run(id,id)}
 expect(db.prepare('SELECT COUNT(*) AS n FROM gallery_submissions').get()!.n).toBe(204)
 {const id=crypto.randomUUID();expect(()=>owner.run(id,id)).toThrow('gallery_capacity')}
 db.prepare('INSERT INTO gallery_agent_quota VALUES(?,6,6,?)').run('fixture','2026-09-07')
 expect(()=>db.prepare('UPDATE gallery_agent_quota SET used=used+1 WHERE bucket=?').run('fixture')).toThrow('agent_limit')
 expect(db.prepare('SELECT used FROM gallery_agent_quota').get()!.used).toBe(6)
 db.close()
})
