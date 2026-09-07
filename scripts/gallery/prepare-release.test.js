import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createReleaseConfig, parseReleaseArguments, portableReleaseConfig } from './prepare-release.mjs'
const base = JSON.parse(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8'))
const options = { target:'staging', 'admin-host':'admin-staging.tintocellar.com', 'database-id':'baea80ab-a4fb-4c81-84ab-96f57fa042de', bucket:'tin-to-cellar-gallery-staging',host:'staging.tintocellar.com','access-issuer':'https://tin-team.cloudflareaccess.com','access-aud':'a'.repeat(64),'admin-subject':'d7f5b3af-58ab-4416-ad92-66767d79e351','turnstile-site-key':'0x4AAAAA-realconfiguration' }
describe('local gallery release preparation', () => {
 it('isolates staging from all production resources even if source config grows bindings', () => {
  const source={...base,services:[{binding:'LIVE',service:'production'}],r2_buckets:[{binding:'LIVE_ART',bucket_name:'live'}],vars:{PRIVATE_PRODUCTION_SETTING:'must-not-copy'}}
  const result=createReleaseConfig(source,options,'/tmp/checkout')
  expect(result.name).toBe('tin-to-cellar-gallery-staging')
  expect(result.durable_objects).toBeUndefined();expect(result.migrations).toBeUndefined();expect(result.services).toBeUndefined()
  expect(result.d1_databases).toHaveLength(1);expect(result.d1_databases[0].binding).toBe('GALLERY');expect(result.r2_buckets).toHaveLength(1)
  expect(JSON.stringify(result)).not.toContain('10c1a5a7-9884-46ad-86d0-2eedf5d8426a');expect(result.vars.PRIVATE_PRODUCTION_SETTING).toBeUndefined()
  expect(result.routes).toEqual([{pattern:'staging.tintocellar.com',custom_domain:true},{pattern:'admin-staging.tintocellar.com',custom_domain:true}]);expect(result.limits).toBeUndefined()
  expect(result.main).toBe('/tmp/checkout/worker/index.ts');expect(result.d1_databases[0].migrations_dir).toBe('/tmp/checkout/migrations/gallery')
  expect(result.ratelimits.map(limit=>limit.namespace_id)).toEqual(['2005','2007','2008','2009'])
  expect(result.ratelimits.map(limit=>limit.namespace_id).some(id=>base.ratelimits.some(limit=>limit.namespace_id===id))).toBe(false)
 })
 it('preserves production diagnostics, DO history and routes, while keeping gallery off', () => {
  const {host: _,...prod}=options
  const result=createReleaseConfig(base,{...prod,target:'production','admin-host':'admin.tintocellar.com',bucket:'tin-to-cellar-gallery','paid-workers-confirmed':true},'/tmp/checkout')
  expect(result.routes).toEqual(expect.arrayContaining(base.routes));expect(result.durable_objects).toEqual(base.durable_objects);expect(result.migrations).toEqual(base.migrations)
  expect(result.d1_databases[0].database_id).toBe(base.d1_databases[0].database_id);expect(result.d1_databases[0].migrations_dir).toBe('/tmp/checkout/migrations')
  expect(result.vars).toMatchObject({GALLERY_INTAKE:'false',GALLERY_PUBLICATION:'false',GALLERY_SERVING:'false'})
  expect(result.workers_dev).toBe(false);expect(result.preview_urls).toBe(false);expect(result.limits.cpu_ms).toBe(2000)
  expect(JSON.stringify(result)).not.toContain('GALLERY_TURNSTILE_SECRET');expect(JSON.stringify(result)).not.toContain('GALLERY_IP_SALT')
  expect(result.ratelimits).toEqual(expect.arrayContaining([
   ...base.ratelimits.filter(limit=>!limit.name.startsWith('GALLERY_')),
   {name:'GALLERY_READ_RATE_LIMITER',namespace_id:'1007',simple:{limit:120,period:60}},
   {name:'GALLERY_UPLOAD_RATE_LIMITER',namespace_id:'1008',simple:{limit:5,period:60}},
   {name:'GALLERY_MUTATION_RATE_LIMITER',namespace_id:'1009',simple:{limit:20,period:60}},
  ]))
  expect(new Set(result.ratelimits.map(limit=>limit.namespace_id)).size).toBe(result.ratelimits.length)
 })
 it('rejects missing identities, placeholders, production reuse and test keys before writing config', () => {
  for(const patch of [{'database-id':undefined},{'database-id':'00000000-0000-0000-0000-000000000001'},{'database-id':base.d1_databases[0].database_id},{'admin-subject':'replace-me'},{host:'tintocellar.com'},{host:'www.tintocellar.com'},{host:'https://staging.tintocellar.com'},{host:'demo.example.com'},{bucket:'tin-to-cellar-gallery'},{'access-issuer':'https://evil.net'},{'access-aud':'short'},{'turnstile-site-key':'1x00000000000000000000AA'}])expect(()=>createReleaseConfig(base,{...options,...patch},'/tmp/checkout')).toThrow()
  expect(()=>parseReleaseArguments(['--target','staging','--target','production'])).toThrow()
  expect(()=>parseReleaseArguments(['--turnstile-secret','never-accept-secret-args'])).toThrow()
  expect(()=>parseReleaseArguments(['--database-id','--bucket','thing'])).toThrow()
 })
})

it('prepares portable root paths without changing local dry-run config or bindings', () => {
  const {host: _,...prod}=options
  const local=createReleaseConfig(base,{...prod,target:'production','admin-host':'admin.tintocellar.com',bucket:'tin-to-cellar-gallery'},'/private/tmp/checkout')
  const portable=portableReleaseConfig(local,'/private/tmp/checkout')
  expect(portable.main).toBe('worker/index.ts')
  expect(portable.assets.directory).toBe('./dist')
  expect(portable.d1_databases.map(db=>db.migrations_dir)).toEqual(['migrations','migrations/gallery'])
  expect(JSON.stringify(portable)).not.toContain('/private/tmp/checkout')
  expect(local.main).toBe('/private/tmp/checkout/worker/index.ts')
  expect(portable.routes).toEqual(local.routes); expect(portable.vars).toEqual(local.vars); expect(portable.migrations).toEqual(local.migrations)
  const unsafe=structuredClone(local);unsafe.d1_databases[0].migrations_dir='/private/separate-migrations'
  expect(()=>portableReleaseConfig(unsafe,'/private/tmp/checkout')).toThrow('inside the repository')
})

it('requires target-specific admin host and distinct optional machine audience with all host paths guarded',()=>{
 const c=createReleaseConfig(base,{...options,'agent-access-aud':'b'.repeat(64)},'/tmp/checkout')
 expect(c.vars.GALLERY_ADMIN_HOST).toBe('admin-staging.tintocellar.com');expect(c.vars.GALLERY_AGENT_ENABLED).toBe('false');expect(c.vars.GALLERY_AGENT_ACCESS_AUD).toBe('b'.repeat(64));expect(c.assets.run_worker_first).toBe(true)
 expect(()=>createReleaseConfig(base,{...options,'admin-host':'admin.tintocellar.com'},'/tmp/checkout')).toThrow()
 expect(()=>createReleaseConfig(base,{...options,'agent-access-aud':options['access-aud']},'/tmp/checkout')).toThrow()
})
