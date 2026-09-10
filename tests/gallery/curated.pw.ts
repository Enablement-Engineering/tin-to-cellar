import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { decode } from 'fast-png'
import { fixture, tobacco } from './fixtures'

const origin = 'http://127.0.0.1:43928'
const api = '/api/gallery/v1'
const admin = { Origin: origin, 'X-Gallery-Test-Admin': 'reviewer-fixture' }

test('curated browser intake publishes new artwork and keeps replacement review closed', async ({ browser, request }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { 'X-Gallery-Test-Admin': 'reviewer-fixture' } })
  const page = await context.newPage()
  const writes: string[] = []
  page.on('request', r => { if (['POST', 'PUT'].includes(r.method())) writes.push(new URL(r.url()).pathname) })
  try {
    await page.goto('/admin/gallery')
    await page.getByText('Curated CellarPack intake', { exact: true }).click()
    const original = await fixture(825, 16)
    await page.getByLabel('Validated CellarPacks').setInputFiles({ name: 'reviewed.zip', mimeType: 'application/zip', buffer: original.zip })
    await expect(page.getByText('1 unique labels ready from 1 pack.')).toBeVisible()
    expect(writes).toEqual([])
    await page.getByRole('checkbox', { name: /I reviewed the source evidence/ }).check()
    await page.getByRole('button', { name: 'Prepare 1 community resources' }).click()
    await expect(page.getByText('1 of 1 resources prepared or added to private review.')).toBeVisible()
    const queue = await (await request.get(`${api}/admin/submissions`, { headers: admin })).json()
    const pending = queue.submissions.find((r: { metadata: { tobacco: { catalogId: string } } }) => r.metadata.tobacco.catalogId === tobacco.id)
    expect(pending).toBeTruthy()
    const approval = await request.post(`${api}/admin/submissions/${pending.id}/approve`, { headers: admin, data: { expectedVersion: pending.version, digest: pending.digest } })
    expect(approval.status(), await approval.text()).toBe(200)
    const replacement = await fixture(825, 17)
    writes.length = 0
    await page.getByLabel('Validated CellarPacks').setInputFiles({ name: 'replacement.zip', mimeType: 'application/zip', buffer: replacement.zip })
    await expect(page.getByRole('button', { name: 'Prepare 1 community resources' })).toBeVisible()
    await page.getByRole('checkbox', { name: /I reviewed the source evidence/ }).check()
    await page.getByRole('button', { name: 'Prepare 1 community resources' }).click()
    await expect(page.getByText(/A matching public label already exists/)).toBeVisible()
    expect(writes).toEqual([`${api}/admin/reconcile`])
    const listed = await (await request.get(`${api}/labels?catalogId=${tobacco.id}`)).json()
    expect(listed.labels.map((r: { id: string }) => r.id)).toEqual([pending.id])
    const art = await (await request.get(`${api}/labels/${pending.id}/artwork`)).body()
    expect(decode(art).data).toEqual(decode(original.png).data)
    const pack = await JSZip.loadAsync(await (await request.get(`${api}/labels/${pending.id}/pack`)).body())
    const manifest = JSON.parse(await pack.file('manifest.json')!.async('text'))
    expect(manifest.assets.artwork.sha256).toBe(createHash('sha256').update(art).digest('hex'))
    expect(await pack.file('artwork/label.png')!.async('nodebuffer')).toEqual(art)
    const current = await (await request.get(`${api}/admin/submissions/${pending.id}`, { headers: admin })).json()
    expect((await request.post(`${api}/admin/submissions/${pending.id}/unpublish`, { headers: admin, data: { expectedVersion: current.version } })).status()).toBe(200)
  } finally { await context.close() }
})
