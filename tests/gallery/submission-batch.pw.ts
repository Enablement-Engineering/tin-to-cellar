import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
import { fixture } from './fixtures'

test('one verification submits selected artwork and covers an upload retry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const fixtures = await Promise.all([0, 1, 2].map(index => fixture(825, index)))
  const manifest = fixtures[0].manifest
  manifest.labels = fixtures.map((f, index) => ({ ...f.manifest.labels[0], id: `batch-label-${index}`, maker: 'Batch fixture', blend: `Blend ${index}`, artworkAssetId: `batch-artwork-${index}` }))
  manifest.assets = Object.fromEntries(fixtures.map((f, index) => [`batch-artwork-${index}`, { ...f.manifest.assets['asset-fixture'], path: `artwork/batch-${index}.png` }]))
  const zip = new JSZip().file('manifest.json', JSON.stringify(manifest))
  fixtures.forEach((f, index) => zip.file(`artwork/batch-${index}.png`, f.png))
  const writes: { path: string; method: string; body: string | null; authorization: string | undefined }[] = []
  page.on('request', request => {
    if (['POST', 'PUT'].includes(request.method()) && request.url().includes('/api/gallery/')) {
      writes.push({ path: new URL(request.url()).pathname, method: request.method(), body: request.method() === 'POST' ? request.postData() : null, authorization: request.headers().authorization })
    }
  })
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.__galleryChecks=0;window.turnstile={render:function(element,options){window.__galleryChecks++;const button=document.createElement('button');button.textContent='Complete test verification';button.onclick=function(){options.callback('local-turnstile-token')};element.append(button);return 'fixture'},remove:function(){},reset:function(){}};`,
  }))
  let failFirst = true
  await page.route('**/api/gallery/v1/submissions/*/artwork', route => {
    if (failFirst && route.request().method() === 'PUT') {
      failFirst = false
      return route.fulfill({ status: 503, json: { error: 'storage_unavailable' } })
    }
    return route.continue()
  })
  await page.goto('/labels/print')
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'batch.cellarpack.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
  await page.getByRole('button', { name: 'Add 3 labels', exact: true }).click()
  await page.getByLabel('Share Batch fixture Blend 0', { exact: true }).check()
  await page.getByLabel('Share Batch fixture Blend 1', { exact: true }).check()
  expect(writes).toEqual([])
  await page.getByLabel('I created or generated these labels', { exact: false }).check()
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click()
  await expect(page.getByText('Verify your submission once for all selected labels.', { exact: true })).toBeVisible()
  const verification = page.getByRole('button', { name: 'Complete test verification' })
  await verification.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Artwork upload was not confirmed.', { exact: false })).toBeVisible()
  await expect(page.getByText('Submitted for review. Your label will appear in the gallery once approved.', { exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Retry this label', exact: true }).click()
  await expect(page.getByText('Submitted for review. Your label will appear in the gallery once approved.', { exact: true })).toHaveCount(2)
  expect(await page.evaluate('window.__galleryChecks')).toBe(1)
  expect(writes.map(write => write.method)).toEqual(['POST', 'PUT', 'PUT', 'PUT'])
  expect(writes[0].path).toBe('/api/gallery/v1/submissions/batch')
  expect(writes[0].body).not.toContain('PRIVATE_')
  const { submissions } = JSON.parse(writes[0].body!)
  expect(submissions.map((draft: { tobacco: { blend: string } }) => draft.tobacco.blend)).toEqual(['Blend 0', 'Blend 1'])
  expect(writes[1].path).toBe(writes[3].path)
  expect(writes.every(write => write.authorization === writes[0].authorization)).toBe(true)
  await expect(verification).toHaveCount(0)
  await expect(page.getByLabel('Share Batch fixture Blend 2', { exact: true })).not.toBeChecked()
})
