import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import JSZip from 'jszip'
import { readFile } from 'node:fs/promises'
import { fixture } from '../gallery/fixtures'
import { buildGalleryPack } from '../../src/lib/gallery/pack'

for (const width of [1280, 320]) test(`community designs share the durable print collection at ${width}px`, async ({ page }) => {
  const source = await fixture(825)
  const labels = ['One', 'Two'].map((blend, index) => ({ id: `43649b43-8094-4a32-b5ee-8be75208fb6${index + 3}`, maker: 'Test Maker', blend, description: 'Cream writing area on a green label' }))
  const packs = await Promise.all(labels.map(label => buildGalleryPack({ metadata: source.draft, ...label, packId: label.id, createdAt: '2026-09-06T00:00:00Z' }, source.png)))
  await page.route('**/api/gallery/v1/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/config')) return route.fulfill({ json: { serving: true } })
    if (url.pathname.endsWith('/labels')) return route.fulfill({ json: { serving: true, labels, nextCursor: null } })
    if (url.pathname.endsWith('/pack')) return route.fulfill({ contentType: 'application/zip', body: Buffer.from(packs[labels.findIndex(label => url.pathname.includes(label.id))]) })
    return route.fulfill({ contentType: 'image/png', body: source.png })
  })
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/gallery')
  await page.getByRole('button', { name: 'Add to your labels', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Added to your labels', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Add to your labels', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Added to your labels', exact: true })).toHaveCount(2)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Added to your labels', exact: true })).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: `test-results/gallery-ready-${width}.png`, fullPage: true })
  await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Print labels', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Quantity for One', exact: true })).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: 'Quantity for Two', exact: true })).toBeVisible()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download labels', exact: true }).click()
  const download = await downloading
  const zip = await JSZip.loadAsync(await readFile((await download.path())!))
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
  expect(manifest.labels.map((label: { blend: string }) => label.blend)).toEqual(['One', 'Two'])
  for (const asset of Object.values(manifest.assets) as { path: string }[]) expect(await zip.file(asset.path)!.async('nodebuffer')).toEqual(source.png)
  await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Choose labels', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your labels', exact: true })).toBeVisible()
  await page.screenshot({ path: `test-results/preparation-ready-${width}.png`, fullPage: true })
})
