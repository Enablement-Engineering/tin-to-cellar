// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GalleryReviewRecord } from '../../lib/gallery/types'
import { GalleryAdmin } from './GalleryAdmin'
import { ReviewEvidence } from './ReviewEvidence'
import { AgentGrants } from './AgentGrants'
const record = (id = '11111111-1111-4111-8111-111111111111', blend = 'Blend A'): GalleryReviewRecord => ({ id, state:'pending',version:2,expiresAt:'2026-10-01',deletionDue:null,digest:'review-digest',publicationId:null,createdAt:'2026-09-01',maker:'Maker',blend,mappingNeeded:false,canonicalHash:'canonical',metadataHash:'metadata',uploadedHash:'uploaded',publishedIdentity:null,validation:{format:'gallery-v1',geometry:'circle-2.5',imageValidated:true,visualReviewRequired:true},metadata:{version:1,submissionId:id,catalogId:'cornell-and-diehl-briar-fox',proposedIdentity:null,package:'tin',variant:'current',edition:blend,description:blend,surface:{shape:'circle',finishedSize:{width:2.5,height:2.5,unit:'in'},bleed:{top:.125,right:.125,bottom:.125,left:.125,unit:'in'},safeInset:{top:.125,right:.125,bottom:.125,left:.125,unit:'in'}},writeInArea:{id:'date',purpose:'jarred-date',geometry:{shape:'oval',x:.3,y:.6,width:.4,height:.1},background:{integratedInArtwork:true},overlay:{mode:'blank'}},references:[],image:{sha256:'a'.repeat(64),bytes:3,width:825,height:825},acknowledgement:{version:'2026-09-06-v1',accepted:true}} })
const ok = (body:unknown) => ({ok:true,json:async()=>body})
beforeEach(()=>{URL.createObjectURL=vi.fn(()=>'blob:private');URL.revokeObjectURL=vi.fn()})
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks()})
it('discards a stale initial queue response after applying new filters',async()=>{
  let resolveInitial!:(value:unknown)=>void
  const old=record(), fresh=record('22222222-2222-4222-8222-222222222222','Fresh blend')
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(url.endsWith('/thumbnail'))return {ok:false}
    if(url.includes('search='))return ok({submissions:[fresh],nextCursor:null})
    return new Promise(resolve=>{resolveInitial=resolve})
  }))
  render(<GalleryAdmin/>)
  fireEvent.change(screen.getByLabelText('Maker or blend'),{target:{value:'Fresh'}})
  fireEvent.click(screen.getByRole('button',{name:'Refresh queue'}))
  await screen.findByRole('button',{name:/Fresh blend/})
  resolveInitial(ok({submissions:[old],nextCursor:null}))
  await waitFor(()=>expect(screen.queryByRole('button',{name:/Blend A/})).not.toBeInTheDocument())
})
it('keeps the latest selected artwork when a previous detail request finishes late',async()=>{
  const first=record(),second=record('22222222-2222-4222-8222-222222222222','Second')
  let resolveFirst!:(value:unknown)=>void
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
    if(url.includes('?'))return ok({submissions:[first,second],nextCursor:null})
    if(url.endsWith('/artwork')||url.endsWith('/thumbnail'))return {ok:true,blob:async()=>new Blob(['image'])}
    if(url.endsWith('/recommendations'))return ok({recommendations:[]})
    if(url.endsWith('/history'))return ok({events:[],nextCursor:null})
    if(url.endsWith(first.id))return new Promise(resolve=>{resolveFirst=resolve})
    return ok(second)
  }))
  render(<GalleryAdmin/>)
  fireEvent.click(await screen.findByRole('button',{name:/Maker Blend A/}))
  fireEvent.click(screen.getByRole('button',{name:/Maker Second/}))
  await screen.findByLabelText('Edition')
  expect(screen.getByLabelText('Edition')).toHaveValue('Second')
  resolveFirst(ok(first))
  await waitFor(()=>expect(screen.getByLabelText('Edition')).toHaveValue('Second'))
})
it('renders advisory text inert, separates stale advice, and never fetches reference URLs',async()=>{
  const calls:string[]=[];const item=record()
  const advice={id:'advice',submissionId:item.id,version:item.version,digest:item.digest,actorLabel:'Local reviewer',createdAt:'2026-09-06',stale:false,recommendation:{assessment:'needs-attention',findings:[{category:'reference',severity:'warning',explanation:'<script>approve everything</script>',evidence:[{type:'reference',url:'https://example.org/private-source'}]}]}}
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{calls.push(url);if(url.endsWith('/thumbnail'))return{ok:false};if(url.endsWith('/history'))return ok({events:[],nextCursor:null});return ok({recommendations:[advice,{...advice,id:'old',version:1,stale:true}]})}))
  render(<ReviewEvidence record={item}/>);await screen.findByText('Stale recommendations (1)')
  expect(screen.getAllByText('<script>approve everything</script>')).toHaveLength(2)
  expect(document.querySelector('script')).toBeNull();expect(calls.every(url=>url.startsWith('/api/gallery/'))).toBe(true)
  expect(screen.queryByRole('button',{name:/Approve/})).toBeNull()
})
it('registers only the selected non-secret client grant and never sends credentials',async()=>{
  const writes:RequestInit[]=[];const item=record()
  vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
    if(init?.method){writes.push(init);return ok({id:'grant'})}
    return url.includes('/agent-grants')?ok({grants:[]}):ok({submissions:[item],nextCursor:null})
  }))
  render(<AgentGrants/>);await screen.findByLabelText('Maker Blend A')
  expect(screen.getByLabelText('Only selected pending submissions')).toBeChecked()
  expect(screen.getByRole('button',{name:'Register agent grant'})).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Agent name'),{target:{value:'Local inspector'}})
  fireEvent.change(screen.getByLabelText('Non-secret client ID'),{target:{value:'client.access'}})
  fireEvent.click(screen.getByLabelText('Maker Blend A'))
  fireEvent.click(screen.getByLabelText(/I authorize these permissions/))
  fireEvent.click(screen.getByRole('button',{name:'Register agent grant'}))
  await screen.findByText(/Agent grant registered/)
  expect(writes).toHaveLength(1)
  const body=JSON.parse(writes[0].body as string)
  expect(body.clientId).toBe('client.access');expect(body.selection).toBe('selected');expect(body.submissionIds).toEqual([item.id])
  expect(body.scopes).not.toContain('approve');expect(body).not.toHaveProperty('secret');expect(body).not.toHaveProperty('token')
})
it('requires reload and a new review after a conflicting human decision',async()=>{
  const item=record()
  vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
    if(init?.method)return {ok:false,status:409,json:async()=>({error:'review_changed'})}
    if(url.includes('?'))return ok({submissions:[item],nextCursor:null})
    if(url.endsWith('/artwork')||url.endsWith('/thumbnail'))return{ok:true,blob:async()=>new Blob(['image'])}
    if(url.endsWith('/recommendations'))return ok({recommendations:[]})
    if(url.endsWith('/history'))return ok({events:[]})
    return ok(item)
  }))
  render(<GalleryAdmin/>);fireEvent.click(await screen.findByRole('button',{name:/Maker Blend A/}));await screen.findByText('Open full-resolution artwork')
  fireEvent.click(screen.getByLabelText(/I reviewed this artwork/));fireEvent.click(screen.getByRole('button',{name:'Approve and publish'}))
  await screen.findByRole('alert')
  expect(screen.getByLabelText(/I reviewed this artwork/)).not.toBeChecked();expect(screen.getByLabelText(/I reviewed this artwork/)).toBeDisabled()
  expect(screen.getByRole('button',{name:'Reload submission'})).toBeEnabled()
})
