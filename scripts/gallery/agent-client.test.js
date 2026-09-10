import { describe,it,expect,vi } from 'vitest'
import { mkdtemp,writeFile,chmod,rm,stat,readFile,symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agentRequest,validateRecommendation,loadAgentCredentials,parseAgentArguments,redactAgentOutput,runAgentClient } from './agent-client.mjs'
const credentials={host:'admin-staging.tintocellar.com',clientId:'fixture-id.access',clientSecret:'fixture-secret-not-a-real-credential'}
const env={GALLERY_AGENT_HOST:credentials.host,GALLERY_AGENT_CLIENT_ID:credentials.clientId,GALLERY_AGENT_CLIENT_SECRET:credentials.clientSecret}
const id='43649b43-8094-4a32-b5ee-8be75208fb63'
const recommendation={schemaVersion:1,expectedVersion:3,digest:'a'.repeat(64),idempotencyKey:id,assessment:'needs-attention',findings:[{category:'writing-area',severity:'warning',explanation:'Check the visible blank writing area before deciding.',evidence:[{type:'artwork',region:{x:.2,y:.5,width:.5,height:.1}}]}]}
describe('trusted local advisory agent client',()=>{
 it('sends credentials only to exact HTTPS admin hosts and only permits scoped machine commands',async()=>{
  const fetcher=vi.fn(async()=>Response.json({submissions:[]}))
  await agentRequest(credentials,'queue',{},undefined,fetcher)
  expect(fetcher.mock.calls[0][0].href).toBe('https://admin-staging.tintocellar.com/api/gallery/v1/agent/submissions')
  expect(fetcher.mock.calls[0][1].redirect).toBe('error')
  expect(fetcher.mock.calls[0][1].headers['CF-Access-Client-Secret']).toBe(credentials.clientSecret)
  for(const host of ['tintocellar.com','www.tintocellar.com','gallery-staging.tintocellar.com','admin.tintocellar.com.evil.net','http://admin.tintocellar.com','admin.tintocellar.com@evil.net'])await expect(agentRequest({...credentials,host},'queue',{},undefined,fetcher)).rejects.toThrow('invalid_credentials_configuration')
  expect(fetcher).toHaveBeenCalledTimes(1)
  for(const command of ['approve','reject','withdraw','unpublish','edit'])expect(()=>parseAgentArguments([command,'--id',id])).toThrow('unsupported_command')
  expect(()=>parseAgentArguments(['detail','--id','../../admin/approve'])).toThrow('invalid_arguments')
 })
 it('refuses redirects, redacts secrets and discards hostile error response bodies',async()=>{
  await expect(agentRequest(credentials,'queue',{},undefined,async()=>new Response(null,{status:302,headers:{Location:'https://evil.net'}}))).rejects.toThrow('redirect_refused')
  await expect(agentRequest(credentials,'queue',{},undefined,async()=>{throw new Error(credentials.clientSecret)})).rejects.toThrow('network_or_redirect_failed')
  await expect(agentRequest(credentials,'queue',{},undefined,async()=>new Response(credentials.clientSecret,{status:403}))).rejects.toThrow('access_denied')
  const output=redactAgentOutput({message:credentials.clientSecret,id:credentials.clientId},credentials)
  expect(output).not.toContain(credentials.clientSecret);expect(output).not.toContain(credentials.clientId)
  await expect(agentRequest(credentials,'queue',{},undefined,async()=>new Response('<html>sign in</html>',{headers:{'Content-Type':'text/html'}}))).rejects.toThrow('invalid_response')
 })
 it('validates exact recommendations and binds versions/digests without accepting actors or action payloads',async()=>{
  expect(validateRecommendation(recommendation)).toBe(recommendation)
  for(const patch of [{actor:'human'},{approve:true},{expectedVersion:0},{digest:'changed'},{findings:[{category:'artwork',severity:'warning',explanation:'<script>run</script>'}]},{findings:[{category:'reference',severity:'info',explanation:'Reference',evidence:[{type:'reference',url:'https://evil.net/?secret=1'}]}]}])expect(()=>validateRecommendation({...recommendation,...patch})).toThrow('invalid_recommendation')
  const fetcher=vi.fn(async()=>Response.json({recommendation:{id}}))
  await agentRequest(credentials,'recommend',{id},recommendation,fetcher)
  expect(fetcher.mock.calls[0][1].method).toBe('POST');expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(recommendation)
  await expect(agentRequest(credentials,'recommend',{id},{...recommendation,expectedVersion:0},fetcher)).rejects.toThrow('invalid_recommendation')
  expect(fetcher).toHaveBeenCalledTimes(1)
  await expect(agentRequest(credentials,'recommend',{id},recommendation,async()=>new Response(null,{status:409}))).rejects.toThrow('review_changed_reload_do_not_auto_retry')
 })
 it('requires private external credentials and rejects readable files and symlinks',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'gallery-agent-client-')),file=join(dir,'credentials.json')
  try{
   await writeFile(file,JSON.stringify(credentials),{mode:0o600})
   expect(await loadAgentCredentials({GALLERY_AGENT_CREDENTIALS_FILE:file})).toEqual(credentials)
   await chmod(file,0o644);await expect(loadAgentCredentials({GALLERY_AGENT_CREDENTIALS_FILE:file})).rejects.toThrow('private_file_required')
   await chmod(file,0o600);const link=join(dir,'linked.json');await symlink(file,link)
   await expect(loadAgentCredentials({GALLERY_AGENT_CREDENTIALS_FILE:link})).rejects.toThrow('private_file_required')
   await expect(loadAgentCredentials({GALLERY_AGENT_CREDENTIALS_FILE:file},dir)).rejects.toThrow('credentials_must_be_external')
  }finally{await rm(dir,{recursive:true,force:true})}
 })
 it('writes private image copies without overwriting, and refuses shared output directories',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'gallery-agent-art-')),output=join(dir,'label.png')
  const bytes=Buffer.from([137,80,78,71,13,10,26,10,1,2,3])
  const fetcher=async()=>new Response(bytes,{headers:{'Content-Type':'image/png'}})
  try{
   const result=JSON.parse(await runAgentClient(['artwork','--id',id,'--output',output],env,process.cwd(),fetcher))
   expect(result.bytes).toBe(bytes.length);expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
   expect((await stat(output)).mode&0o777).toBe(0o600);expect(await readFile(output)).toEqual(bytes)
   await expect(runAgentClient(['artwork','--id',id,'--output',output],env,process.cwd(),fetcher)).rejects.toThrow('private_output_required_or_exists')
   await chmod(dir,0o755)
   await expect(runAgentClient(['artwork','--id',id,'--output',join(dir,'other.png')],env,process.cwd(),fetcher)).rejects.toThrow('private_output_required_or_exists')
  }finally{await rm(dir,{recursive:true,force:true})}
 })
})
it('accepts actual padded queue cursors and enforces UTF-8/evidence limits before network',async()=>{
 const cursor=Buffer.from(`2026-09-06T00:00:00.000Z|${id}`).toString('base64')
 expect(parseAgentArguments(['queue','--cursor',cursor]).options.cursor).toBe(cursor)
 const fetcher=vi.fn(async()=>Response.json({submissions:[]}))
 await agentRequest(credentials,'queue',{cursor},undefined,fetcher)
 expect(fetcher.mock.calls[0][0].searchParams.get('cursor')).toBe(cursor)
 expect(()=>validateRecommendation({...recommendation,findings:[{category:'artwork',severity:'info',explanation:'é'.repeat(2049)}]})).toThrow('invalid_recommendation')
 expect(()=>validateRecommendation({...recommendation,findings:[{category:'artwork',severity:'info',explanation:'Review',evidence:Array.from({length:5},()=>({type:'artwork'}))}]})).toThrow('invalid_recommendation')
 expect(validateRecommendation({...recommendation,findings:[{category:'artwork',severity:'info',explanation:'First observation.\nSecond observation.'}]}).findings).toHaveLength(1)
})

it('accepts v2 metadata evidence fields and rejects retired fields',()=>{
 const proposal={schemaVersion:1,expectedVersion:1,digest:'a'.repeat(64),idempotencyKey:id,assessment:'needs-attention',findings:[{category:'catalog-match',severity:'warning',explanation:'Check the tobacco match.',evidence:[{type:'metadata',field:'tobacco'}]}]}
 expect(validateRecommendation(proposal)).toBe(proposal)
 proposal.findings[0].evidence[0].field='catalogId'
 expect(()=>validateRecommendation(proposal)).toThrow('invalid_recommendation')
})
