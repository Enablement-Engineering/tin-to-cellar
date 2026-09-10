import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { encode } from 'fast-png'
import type { GalleryReviewRecord } from '../../src/lib/gallery/types'
import { reviewFixture } from '../fixtures/gallery-review'
const id='11111111-1111-4111-8111-111111111111'
const tobacco={id:'cornell-and-diehl-briar-fox',maker:'Cornell & Diehl',blend:'Briar Fox'}
function artwork() {
  const data=new Uint8Array(825*825*4)
  for(let y=0;y<825;y++)for(let x=0;x<825;x++){
    const r=Math.hypot(x-412,y-412);const light=r>390||(y>500&&y<600&&x>200&&x<625);const gold=r>335&&r<345
    data.set(light?[251,248,243,255]:gold?[201,174,120,255]:[63,81,64,255],(y*825+x)*4)
  }
  return Buffer.from(encode({width:825,height:825,channels:4,data}))
}
function fixture():GalleryReviewRecord { const item = reviewFixture(id, tobacco.blend); item.maker = tobacco.maker; item.metadata!.edition = 'Synthetic review fixture'; return item }
for(const width of [1280,320])test(`expanded human gallery review is accessible at ${width}px`,async({page,request})=>{
  const item=fixture(), png=artwork();const external:string[]=[]
  // UI-only harness: production admin HTML still requires real Access authentication.
  const shell=await (await request.get('/')).text()
  await page.route('https://**/*',route=>{external.push(route.request().url());return route.abort()})
  // Intercept every request on this host; fetch application assets only from local Wrangler.
  await page.route('https://admin-staging.tintocellar.com/**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:shell});const response=await request.get(`${url.pathname}${url.search}`);return route.fulfill({response})})
  await page.route('**/api/gallery/v1/admin/**',route=>{
    const path=new URL(route.request().url()).pathname
    if(path.endsWith('/artwork')||path.endsWith('/thumbnail'))return route.fulfill({status:200,contentType:'image/png',body:png})
    let body:unknown=item
    if(path.endsWith('/submissions'))body={submissions:[item],nextCursor:null,counts:{pending:1,reservedBytes:41943040,oldestPendingAt:item.createdAt}}
    if(path.endsWith('/history'))body={events:[{id:'event',action:'submitted',actorType:'contributor',actor:'contributor',version:2,digest:item.digest,createdAt:item.createdAt,result:'pending'}],nextCursor:null}
    if(path.endsWith('/recommendations'))body={recommendations:[{id:'advice',submissionId:id,version:2,digest:item.digest,actorLabel:'Local inspection helper',createdAt:item.createdAt,stale:false,recommendation:{schemaVersion:1,expectedVersion:2,digest:item.digest,idempotencyKey:'fixture',assessment:'needs-attention',findings:[{category:'writing-area',severity:'info',explanation:'Review the blank writing area at print size.'}]}}]}
    if(path.endsWith('/operations'))body={pending:1,cleanupWaiting:0,overdue:0,oldestOverdue:null,lastCleanupAt:item.createdAt,lastCleanupFailures:0,reservedBytes:41943040}
    if(path.endsWith('/agent-grants'))body={grants:[]}
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
  })
  await page.setViewportSize({width,height:900});await page.goto('https://admin-staging.tintocellar.com/')
  const queue=page.getByRole('button',{name:new RegExp(`${tobacco.maker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}.*pending`)})
  await queue.focus();await queue.press('Enter')
  await expect(page.getByRole('heading',{name:`${tobacco.maker} ${tobacco.blend}`,exact:true})).toBeFocused()
  await expect(page.getByText('Open full-resolution artwork')).toBeVisible()
  await expect(page.getByRole('button',{name:'Approve and publish'})).toBeDisabled()
  await page.getByText('Geometry and validation',{exact:true}).click()
  await expect(page.getByText('Image format and geometry checks passed.',{exact:false})).toBeVisible()
  await page.getByText('Agent recommendations (1)', {exact:true}).click()
  await expect(page.getByText('Review the blank writing area at print size.')).toBeVisible()
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.evaluate(()=>window.scrollTo(0,0))
  await page.screenshot({path:`test-results/gallery-admin-review-${width}.png`,fullPage:true})
  await page.getByRole('button',{name:'Operations',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Storage and cleanup'})).toBeVisible()
  await page.getByRole('button',{name:'Agent permissions',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Advisory agent access'})).toBeVisible()
  await expect(page.getByLabel('Only selected pending submissions')).toBeChecked()
  expect(await page.getByLabel('Only selected pending submissions').evaluate(input=>input.getBoundingClientRect().width)).toBeLessThan(24)
  await expect(page.getByRole('button',{name:'Register agent grant'})).toBeDisabled()
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.evaluate(()=>window.scrollTo(0,0))
  await page.screenshot({path:`test-results/gallery-admin-grants-${width}.png`,fullPage:true})
  expect(external).toEqual([])
})
