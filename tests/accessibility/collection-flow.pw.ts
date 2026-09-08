import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import JSZip from 'jszip'
import { readFile, readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { fixture } from '../gallery/fixtures'
import { buildGalleryPack } from '../../src/lib/gallery/pack'
import type { CellarPackManifest } from '../../src/lib/cellarpack/types'

const read = promisify(readFile)
const catalog = JSON.parse(readFileSync(new URL('../../src/lib/tobacco-catalog/catalog.json', import.meta.url), 'utf8')) as Array<{ id: string; maker: string; blend: string }>
const known = ['Westminster', 'Autumn Evening', 'Nightcap'].map(blend => catalog.find(entry => entry.blend === blend && (blend !== 'Nightcap' || entry.maker === 'Peterson'))!)

async function installLibrary(context: BrowserContext) {
  const source = await fixture(825)
  const labels = known.slice(0, 2).map((entry, index) => ({ ...entry, catalogId: entry.id, id: `43649b43-8094-4a32-b5ee-8be75208fb6${index + 3}`, edition: 'Synthetic test', description: 'Green label with a blank cream writing area', geometry: 'circle-2.5' }))
  const packs = await Promise.all(labels.map(label => buildGalleryPack({ metadata: { ...source.draft, catalogId: label.catalogId }, ...label, packId: label.id, createdAt: '2026-09-06T00:00:00Z' }, source.png)))
  const contributions: unknown[] = []
  const requests: string[] = []
  context.on('request', request => requests.push(request.url()))
  await context.route('**/api/gallery/v1/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/config')) return route.fulfill({ json: { serving: true, intake: false, noticeVersion: 'fixture', turnstileSiteKey: '' } })
    if (url.pathname.endsWith('/labels')) {
      const catalogId = url.searchParams.get('catalogId')
      return route.fulfill({ json: { serving: true, labels: catalogId ? labels.filter(label => label.catalogId === catalogId) : labels, nextCursor: null } })
    }
    if (url.pathname.endsWith('/pack')) return route.fulfill({ contentType: 'application/zip', body: Buffer.from(packs[labels.findIndex(label => url.pathname.includes(label.id))]) })
    return route.fulfill({ contentType: 'image/png', body: source.png })
  })
  await context.route('**/api/labels/sources?*', route => route.fulfill({ json: { catalogId: new URL(route.request().url()).searchParams.get('catalogId'), sources: [] } }))
  await context.route('**/api/labels/contributions', route => {
    contributions.push(route.request().postDataJSON())
    return route.fulfill({ json: { status: 'collected' } })
  })
  return { source, contributions, requests }
}

async function expectPersistentMobileAction(page: Page, action: Locator) {
  if ((page.viewportSize()?.width ?? 1280) > 680) return
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => action.evaluate(button => {
    const bounds = button.getBoundingClientRect()
    const x = bounds.left + bounds.width / 2, y = bounds.top + bounds.height / 2
    return bounds.top >= 0 && bounds.bottom <= innerHeight && button.contains(document.elementFromPoint(x, y))
  })).toBe(true)
  // The reserved space belongs after the footer, so its final copy stays above
  // the fixed actions when the user reaches the bottom of the document.
  await expect.poll(async () => {
    const notice = await page.locator('.site-footer .footer-notice').boundingBox()
    const actions = await action.locator('..').boundingBox()
    return !!notice && !!actions && notice.y + notice.height <= actions.y
  }).toBe(true)
  await action.click({ trial: true })
}

async function selectExisting(page: Page, count = 2) {
  await page.goto('/gallery')
  for (let index = 0; index < count; index++) {
    await page.getByRole('button', { name: 'Add to your labels', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Added to your labels', exact: true })).toHaveCount(index + 1)
  }
  const review = page.getByRole('button', { name: 'Review & print', exact: true })
  await expectPersistentMobileAction(page, review)
  await review.click()
  await expect(page.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(count)
}

for (const width of [1280, 320]) test(`existing community labels survive reload and print without generation at ${width}px`, async ({ context, page }) => {
  const { source, contributions } = await installLibrary(context)
  await page.setViewportSize({ width, height: 900 })
  await selectExisting(page)
  await page.getByRole('spinbutton', { name: `Quantity for ${known[0].blend}`, exact: true }).fill('3')
  await expect(page.getByRole('button', { name: 'Print 4 labels', exact: true })).toBeEnabled()
  await expectPersistentMobileAction(page, page.getByRole('button', { name: 'Print 4 labels', exact: true }))
  await page.reload()
  await expect(page.getByRole('spinbutton', { name: `Quantity for ${known[0].blend}`, exact: true })).toHaveValue('3')
  await page.getByRole('button', { name: 'Add more labels', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /^2 selected · 2 ready to print · 0 need artwork$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Copy prompt/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Review & print', exact: true })).toBeEnabled()
  await expectPersistentMobileAction(page, page.getByRole('button', { name: 'Review & print', exact: true }))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Review & print', exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download labels', exact: true }).click()
  const download = await downloading
  const zip = await JSZip.loadAsync(await read((await download.path())!))
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string')) as CellarPackManifest
  expect(manifest.labels.map(label => label.blend)).toEqual(known.slice(0, 2).map(entry => entry.blend))
  for (const asset of Object.values(manifest.assets)) expect(await zip.file(asset.path)!.async('nodebuffer')).toEqual(source.png)
  expect(contributions).toHaveLength(0)
})

test('mixed collection freezes only requested artwork and merges a returned ZIP across tabs without replay', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const { source, contributions, requests } = await installLibrary(context)
  await selectExisting(page)
  await page.getByRole('spinbutton', { name: `Quantity for ${known[0].blend}`, exact: true }).fill('3')
  await expect(page.getByRole('button', { name: 'Print 4 labels', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Add more labels', exact: true }).click()
  const third = known[2]
  await page.getByRole('combobox', { name: 'Add a blend', exact: true }).fill(`${third.maker} ${third.blend}`)
  await page.getByRole('option', { name: `${third.blend} by ${third.maker}`, exact: true }).click()
  const row = page.getByRole('article', { name: third.blend, exact: true })
  await expect(row.getByText('No community designs for this blend yet.', { exact: true })).toBeVisible()
  await row.getByRole('button', { name: 'Create my own', exact: true }).click()
  await page.getByRole('button', { name: 'Copy prompt for 1 label', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Prompt and all instructions copied.' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  const request = copied.slice(copied.lastIndexOf('# Project input'))
  expect(request).toContain(`${third.maker} — ${third.blend}`)
  for (const entry of known.slice(0, 2)) expect(request).not.toContain(entry.blend)
  await page.reload()
  await page.getByRole('button', { name: 'Copy prompt for 1 label', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Prompt and all instructions copied.' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(copied)

  const returnedManifest = structuredClone(source.manifest)
  returnedManifest.packId = 'urn:uuid:43649b43-8094-4a32-b5ee-8be75208fb69'
  returnedManifest.labels[0].maker = third.maker
  returnedManifest.labels[0].blend = third.blend
  returnedManifest.labels[0].research.sources = [{ id: 'reference', type: 'web', role: 'package-appearance', url: 'https://example.com/DO-NOT-FETCH', title: 'Fixture package reference', retrievedAt: returnedManifest.createdAt }]
  const returnedZip = await new JSZip().file('manifest.json', JSON.stringify(returnedManifest)).file('artwork/fixture-blend.png', source.png).generateAsync({ type: 'nodebuffer' })
  const returned = { name: 'new-artwork.cellarpack.zip', mimeType: 'application/zip', buffer: returnedZip }
  const returnTab = await context.newPage()
  await returnTab.goto('/labels/print')
  await expect(returnTab.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(2)
  await returnTab.locator('input[type=file]').first().setInputFiles(returned)
  await expect(returnTab.getByRole('heading', { name: 'Add your new labels', exact: true })).toBeVisible()
  await expect(returnTab.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(0)
  await expect(returnTab.locator('.sheet-stage, .production-pages')).toHaveCount(0)
  await returnTab.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  await expect(returnTab.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(3)
  await expect(returnTab.getByRole('spinbutton', { name: `Quantity for ${known[0].blend}`, exact: true })).toHaveValue('3')
  await expect.poll(() => contributions.length).toBe(1)
  expect(JSON.stringify(contributions[0])).not.toContain('PRIVATE_')
  await returnTab.reload()
  await expect(returnTab.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(3)
  await returnTab.locator('input[type=file]').first().setInputFiles(returned)
  await expect(returnTab.getByText('Already in your labels. No extra copy will be added.', { exact: true })).toBeVisible()
  await returnTab.getByRole('button', { name: 'Keep current labels', exact: true }).click()
  await expect(returnTab.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(3)
  await expect(returnTab.getByRole('button', { name: 'Print 5 labels', exact: true })).toBeEnabled()
  await page.bringToFront()
  await expect(page.getByRole('status').filter({ hasText: /^3 selected · 3 ready to print · 0 need artwork$/ })).toBeVisible()
  expect(contributions).toHaveLength(1)
  expect(requests.some(url => url.includes('example.com/DO-NOT-FETCH'))).toBe(false)
})

test('home example pack can replace an existing selection, and print reset requires confirmation', async ({ context, page }) => {
  test.setTimeout(60000)
  await installLibrary(context)
  await selectExisting(page)
  await page.getByRole('spinbutton', { name: `Quantity for ${known[0].blend}`, exact: true }).fill('3')
  await expect(page.getByRole('button', { name: 'Print 4 labels', exact: true })).toBeEnabled()
  await page.getByRole('link', { name: 'Tin to Cellar home' }).click()
  await page.getByRole('button', { name: 'Try the example pack', exact: true }).click()
  const replace = page.getByRole('button', { name: 'Replace saved labels with this pack', exact: true })
  await expect(replace).toBeEnabled()
  await expect(page.getByRole('button', { name: /^Print \d+ labels?$/ })).toHaveCount(0)
  await expect(page.locator('.sheet-stage, .production-pages')).toHaveCount(0)
  page.once('dialog', dialog => dialog.dismiss())
  await replace.click()
  await expect(replace).toBeEnabled()
  await page.getByRole('button', { name: 'Cancel import', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 4 labels', exact: true })).toBeEnabled()
  await page.getByRole('link', { name: 'Tin to Cellar home' }).click()
  await page.getByRole('button', { name: 'Try the example pack', exact: true }).click()
  await expect(replace).toBeEnabled()
  page.once('dialog', dialog => dialog.accept())
  await replace.click()
  await expect(page.getByRole('button', { name: 'Print 10 labels', exact: true })).toBeEnabled()
  await expect(page.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(10)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Print 10 labels', exact: true })).toBeEnabled()
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Reset labels', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 10 labels', exact: true })).toBeEnabled()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reset labels', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Choose ZIP', exact: true })).toBeEnabled()
  await expect(page.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(0)
})


test('an empty collection opens the home template directly in print preview with reset available', async ({ page }) => {
  test.setTimeout(60000)
  await page.goto('/labels')
  await page.getByRole('button', { name: 'Try the example pack', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 10 labels', exact: true })).toBeEnabled()
  await expect(page.locator('.sheet-stage')).toBeVisible()
  await expect(page.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(10)
  await expect(page.getByRole('button', { name: 'Add 10 labels', exact: true })).toHaveCount(0)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reset labels', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(0)
  await page.getByRole('button', { name: 'Import preview pack with ten labels', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 10 labels', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Print 10 labels', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Reset labels', exact: true })).toBeEnabled()
})

for (const width of [1280, 320]) test(`blend additions keep an accurate visible selection count and search focus at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/labels/create')
  const input = page.getByRole('combobox', { name: 'Add a blend', exact: true })
  for (let index = 1; index <= 3; index++) {
    await input.fill(`Test custom blend ${index}`)
    await input.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: `Test custom blend ${index} added · ${index} ${index === 1 ? 'blend' : 'blends'} selected.` })).toBeVisible()
    await expect(input).toBeFocused()
  }
  const summary = page.locator('[aria-label="Selection summary"]')
  await expect(summary).toContainText('3 selected · 0 ready to print · 3 need artwork')
  await expect(summary.getByRole('button', { name: 'Review & print' })).toHaveCount(0)
  await page.getByRole('button', { name: 'View selected', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your labels', exact: true })).toBeFocused()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(summary).toBeInViewport()
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
})
