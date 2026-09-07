// Opt-in local evidence only. Supply a JSON array of absolute ZIP paths in
// GALLERY_TEST_PACKS. Original archives and metadata are never copied to the repo.
import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { decode } from 'fast-png'
import type { GalleryLabelDraftV1, GalleryReceipt } from '../../src/lib/gallery/types'
import { resolveTobaccoId } from '../../src/lib/tobacco-catalog'

const paths: string[] = JSON.parse(process.env.GALLERY_TEST_PACKS ?? '[]')
const api = '/api/gallery/v1'
const rejectedPath = process.env.GALLERY_TEST_REJECTED_PACK
if (rejectedPath) test('local Downloads unsupported profile remains printable and private', async ({ page, request }) => {
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: 'window.turnstile={render:function(e,o){setTimeout(function(){o.callback("local-turnstile-token")},10);return "fixture"},remove:function(){},reset:function(){}};' }))
  await page.goto('/labels/print')
  await page.getByLabel('Label ZIP').setInputFiles(rejectedPath)
  await page.getByRole('button', { name: /^Add \d+ labels?$/ }).click()
  const sharing = page.getByRole('region', { name: 'Share your labels' })
  await sharing.getByRole('checkbox', { name: /^Share / }).first().check()
  await sharing.getByLabel('I created or generated these labels', { exact: false }).check()
  const uploaded = page.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname.startsWith(`${api}/submissions/`))
  await sharing.getByRole('button', { name: 'Submit for review', exact: true }).click()
  const response = await uploaded
  expect(response.status()).toBe(400)
  expect(await response.json()).toMatchObject({ error: 'unsupported_image' })
  await expect(sharing.getByText(/without an embedded ICC profile/)).toBeVisible()
  await expect(sharing.getByRole('button', { name: 'Retry this label' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Print 1 label', exact: true })).toBeVisible()
  const id = new URL(response.url()).pathname.split('/').at(-2)
  expect((await request.get(`${api}/labels/${id}/artwork`)).status()).toBe(404)
})
for (const [index, path] of paths.entries()) test(`local Downloads submission: ${basename(path)}`, async ({ page, request, browser }) => {
  const writes: { url: string; body: string | null }[] = []
  page.on('request', req => { if (['POST', 'PUT'].includes(req.method()) && new URL(req.url()).pathname.startsWith(api)) writes.push({ url: new URL(req.url()).pathname, body: req.method() === 'POST' ? req.postData() : null }) })
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: 'window.turnstile={render:function(e,o){setTimeout(function(){o.callback("local-turnstile-token")},10);return "fixture"},remove:function(){},reset:function(){}};' }))
  await page.goto('/labels/print')
  await page.getByLabel('Label ZIP').setInputFiles(path)
  await page.getByRole('button', { name: /^Add \d+ labels?$/ }).click()
  const sharing = page.getByRole('region', { name: 'Share your labels' })
  await expect(sharing).toBeVisible()
  expect(writes).toEqual([])
  await sharing.getByRole('checkbox', { name: /^Share / }).first().check()
  await sharing.getByLabel('Edition, if known').fill(`Local test ${index + 1}`)
  await sharing.getByLabel('I created or generated these labels', { exact: false }).check()
  const uploaded = page.waitForResponse(response => response.request().method() === 'PUT' && new URL(response.url()).pathname.startsWith(`${api}/submissions/`))
  await sharing.getByRole('button', { name: 'Submit for review', exact: true }).click()
  const response = await uploaded
  expect(response.status(), await response.text()).toBe(200)
  const receipt = await response.json() as GalleryReceipt
  expect(receipt.state).toBe('pending')
  const draft = JSON.parse(writes.find(w => w.url === `${api}/submissions`)!.body!) as GalleryLabelDraftV1
  expect(draft.references).toEqual([])
  expect(writes).toHaveLength(2)
  expect((await request.get(`${api}/labels/${receipt.id}/artwork`)).status()).toBe(404)
  await page.screenshot({ path: `output/gallery/download-${index + 1}-pending.png`, fullPage: true })
  await expect(sharing.getByText('Submitted for review. Your label will appear in the gallery once approved.', {exact:true})).toBeVisible()
  await expect(sharing.getByRole('link', {name:'Private status and withdrawal link'})).toHaveCount(0)
  const original = await JSZip.loadAsync(await readFile(path))
  const manifest = JSON.parse(await original.file('manifest.json')!.async('string'))
  const asset = Object.values(manifest.assets).find((a) => (a as { sha256: string }).sha256 === draft.image.sha256) as { path: string }
  const originalPng = await original.file(asset.path)!.async('nodebuffer')
  expect(createHash('sha256').update(originalPng).digest('hex')).toBe(draft.image.sha256)
  const approval = await request.post(`${api}/admin/submissions/${receipt.id}/approve`, { headers: { Origin: 'http://127.0.0.1:43928', 'X-Gallery-Test-Admin': 'reviewer-fixture' }, data: { expectedVersion: receipt.version, digest: receipt.digest } })
  expect(approval.status(), await approval.text()).toBe(200)
  const canonical = await (await request.get(`${api}/labels/${receipt.id}/artwork`)).body()
  expect(decode(canonical).data).toEqual(decode(originalPng).data)
  const pack = await request.get(`${api}/labels/${receipt.id}/pack`)
  expect(pack.status()).toBe(200)
  const publicContext = await browser.newContext()
  const publicPage = await publicContext.newPage()
  await publicPage.goto('http://127.0.0.1:43928/gallery')
  const tobacco = resolveTobaccoId(draft.catalogId!)!
  const search = publicPage.getByRole('combobox', { name: 'Maker or blend', exact: true })
  await search.fill(`${tobacco.maker} ${tobacco.blend}`); await search.press('ArrowDown'); await search.press('Enter')
  await publicPage.getByRole('button', { name: 'Add to your labels' }).first().click()
  await expect(publicPage.getByRole('button', { name: 'Added to your labels' })).toBeVisible()
  await publicPage.getByRole('button', { name: 'View your labels' }).click()
  await expect(publicPage.getByRole('button', { name: 'Print 1 label', exact: true })).toBeVisible()
  await expect(publicPage.getByRole('heading', { name: 'Share your labels' })).toHaveCount(0)
  await publicPage.screenshot({ path: `output/gallery/download-${index + 1}-print-preview.png`, fullPage: true })
  await publicPage.pdf({ path: `output/gallery/download-${index + 1}-print.pdf`, format: 'Letter', printBackground: true })
  await publicContext.close()
  const approved=await approval.json()
  const unpublished=await request.post(`${api}/admin/submissions/${receipt.id}/unpublish`,{headers:{Origin:'http://127.0.0.1:43928','X-Gallery-Test-Admin':'reviewer-fixture'},data:{expectedVersion:approved.version}})
  expect(unpublished.status()).toBe(200)
  expect((await request.get(`${api}/labels/${receipt.id}/pack`)).status()).toBe(404)
})
