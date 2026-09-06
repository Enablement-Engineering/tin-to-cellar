import { test, expect, type APIRequestContext } from '@playwright/test'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { fixture } from './fixtures'
import type { GalleryReviewRecord } from '../../src/lib/gallery/types'
const base='/api/gallery/v1'
const origin='http://127.0.0.1:43928'
const admin={Origin:origin,'X-Gallery-Test-Admin':'reviewer-fixture'}
const machine={'X-Gallery-Test-Agent':'agent-fixture'}
async function submit(request:APIRequestContext,variation:number) {
  const f=await fixture(825,variation), key=randomBytes(32).toString('hex')
  const owner={Origin:origin,Authorization:`Bearer ${key}`,'X-Turnstile-Token':'local-turnstile-token'}
  const reservation=await request.post(`${base}/submissions`,{headers:owner,data:f.draft})
  expect(reservation.status(),await reservation.text()).toBe(201)
  const upload=await request.put(`${base}/submissions/${f.draft.submissionId}/artwork`,{headers:{...owner,'Content-Type':'image/png'},data:f.png})
  expect(upload.status(),await upload.text()).toBe(200)
  return {record:await upload.json() as GalleryReviewRecord,owner}
}
test('real D1 and R2 enforce advisory machine grants, versions, audit, and revocation',async({request})=>{
  const permitted=await submit(request,11), excluded=await submit(request,12)
  const id=permitted.record.id
  expect((await request.get(`${base}/agent/submissions`,{headers:machine})).status()).toBe(403)
  const create=await request.post(`${base}/admin/agent-grants`,{headers:admin,data:{clientId:'local-agent.access',label:'Local runtime inspector',scopes:['queue:read','submission:read','artwork:read','recommendation:write'],selection:'selected',submissionIds:[id],expiresAt:new Date(Date.now()+86400000).toISOString()}})
  expect(create.status(),await create.text()).toBe(201)
  const grant=await create.json()
  const queue=await request.get(`${base}/agent/submissions`,{headers:machine})
  expect(queue.status(),await queue.text()).toBe(200)
  const items=await queue.json()
  expect(items.submissions.map((item:{id:string})=>item.id)).toEqual([id]);expect(items).not.toHaveProperty('counts')
  expect((await request.get(`${base}/agent/submissions/${excluded.record.id}`,{headers:machine})).status()).toBe(404)
  const detail=await request.get(`${base}/agent/submissions/${id}`,{headers:machine})
  expect(detail.status(),await detail.text()).toBe(200)
  const reviewed=await detail.json() as GalleryReviewRecord
  expect(reviewed.state).toBe('pending')
  for(const forbidden of ['capability_hash','r2_key','PRIVATE_','reviewer-fixture','agent-fixture'])expect(JSON.stringify(reviewed)).not.toContain(forbidden)
  const image=await request.get(`${base}/agent/submissions/${id}/artwork`,{headers:machine})
  expect(image.status(),await image.text().catch(()=>'' )).toBe(200);expect(image.headers()['cache-control']).toBe('no-store')
  expect(createHash('sha256').update(await image.body()).digest('hex')).toBe(reviewed.canonicalHash)
  const thumbnail=await request.get(`${base}/agent/submissions/${id}/thumbnail`,{headers:machine})
  expect(thumbnail.status()).toBe(200);expect(thumbnail.headers()['cache-control']).toBe('no-store')
  const recommendation={schemaVersion:1,expectedVersion:reviewed.version,digest:reviewed.digest,idempotencyKey:randomUUID(),assessment:'needs-attention',findings:[{category:'writing-area',severity:'info',explanation:'Inspect this synthetic blank area before making the human decision.',evidence:[{type:'metadata',field:'writeInArea'}]}]}
  const proposed=await request.post(`${base}/agent/submissions/${id}/recommendations`,{headers:machine,data:recommendation})
  expect(proposed.status(),await proposed.text()).toBe(201)
  const advice=await proposed.json()
  const replay=await request.post(`${base}/agent/submissions/${id}/recommendations`,{headers:machine,data:recommendation})
  expect(replay.status(),await replay.text()).toBe(200);expect((await replay.json()).recommendation.id).toBe(advice.recommendation.id)
  const humanAdvice=await request.get(`${base}/admin/submissions/${id}/recommendations`,{headers:admin})
  const currentAdvice=await humanAdvice.json();expect(currentAdvice.recommendations).toHaveLength(1);expect(currentAdvice.recommendations[0].stale).toBe(false)
  const human=await request.get(`${base}/admin/submissions/${id}`,{headers:admin})
  const saved=await human.json()
  expect(saved.state).toBe('pending');expect(saved.version).toBe(reviewed.version)
  const correction=await request.patch(`${base}/admin/submissions/${id}`,{headers:admin,data:{expectedVersion:saved.version,metadata:{...saved.metadata,edition:'Human corrected edition'}}})
  expect(correction.status(),await correction.text()).toBe(200)
  const corrected=await correction.json()
  expect(corrected.version).toBeGreaterThan(saved.version);expect(corrected.digest).not.toBe(saved.digest)
  const stale=await request.post(`${base}/agent/submissions/${id}/recommendations`,{headers:machine,data:{...recommendation,idempotencyKey:randomUUID()}})
  expect(stale.status(),await stale.text()).toBe(409)
  const afterEdit=await (await request.get(`${base}/admin/submissions/${id}/recommendations`,{headers:admin})).json()
  expect(afterEdit.recommendations).toHaveLength(1);expect(afterEdit.recommendations[0].stale).toBe(true)
  const forbidden=await request.post(`${base}/admin/submissions/${id}/approve`,{headers:{...machine,Origin:origin},data:{expectedVersion:corrected.version,digest:corrected.digest}})
  expect(forbidden.status()).toBe(403)
  expect((await request.post(`${base}/agent/submissions/${id}/approve`,{headers:machine,data:{expectedVersion:corrected.version}})).status()).toBe(404)
  const history=await (await request.get(`${base}/admin/submissions/${id}/history`,{headers:admin})).json()
  expect(history.events.filter((event:{action:string})=>event.action==='recommendation')).toHaveLength(1)
  expect(history.events.some((event:{actorType:string;action:string})=>event.actorType==='agent'&&event.action==='artwork')).toBe(true)
  expect(history.events.some((event:{actorType:string;action:string})=>event.actorType==='human'&&event.action==='correct')).toBe(true)
  const revoke=await request.post(`${base}/admin/agent-grants/${grant.id}/revoke`,{headers:admin,data:{expectedVersion:grant.version}})
  expect(revoke.status(),await revoke.text()).toBe(200)
  expect((await revoke.json()).revokedAt).toBeTruthy()
  for(const suffix of ['',`/${id}`,`/${id}/artwork`,`/${id}/thumbnail`]){
    const denied=await request.get(`${base}/agent/submissions${suffix}`,{headers:{...machine,'If-None-Match':'*','If-Modified-Since':new Date().toUTCString()}})
    expect(denied.status()).toBe(403);expect(denied.headers()['cache-control']).toBe('no-store')
  }
  expect((await request.post(`${base}/agent/submissions/${id}/recommendations`,{headers:machine,data:{...recommendation,expectedVersion:corrected.version,digest:corrected.digest,idempotencyKey:randomUUID()}})).status()).toBe(403)
  expect((await (await request.get(`${base}/admin/submissions/${id}`,{headers:admin})).json()).state).toBe('pending')
  for(const item of [permitted,excluded]){const current=await(await request.get(`${base}/admin/submissions/${item.record.id}`,{headers:admin})).json();expect((await request.post(`${base}/admin/submissions/${item.record.id}/reject`,{headers:admin,data:{expectedVersion:current.version,reason:'unsuitable'}})).status()).toBe(200)}
  const cleanup=await request.get(`/__test/cleanup?now=${encodeURIComponent(new Date(Date.now()+8*86400000).toISOString())}`,{headers:admin})
  expect(cleanup.status(),await cleanup.text()).toBe(200);expect((await cleanup.json()).failures).toBe(0)
  expect((await (await request.get(`${base}/admin/submissions/${id}/recommendations`,{headers:admin})).json()).recommendations).toEqual([])
})
