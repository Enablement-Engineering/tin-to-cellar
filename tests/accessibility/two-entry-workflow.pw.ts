import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import JSZip from 'jszip'
import { readFileSync } from 'node:fs'
import { fixture } from '../gallery/fixtures'
import { buildGalleryPack } from '../../src/lib/gallery/pack'

type Blend = { id: string; maker: string; blend: string }
const catalog = JSON.parse(readFileSync(new URL('../../src/lib/tobacco-catalog/catalog.json', import.meta.url), 'utf8')) as Blend[]
const blends = ['Westminster', 'Autumn Evening', 'Nightcap', 'Briar Fox', 'Bayou Morning', 'Haunted Bookshop', 'Opening Night', 'Old Joe Krantz', 'Stratford', 'Epiphany'].map(name => catalog.find(entry => entry.blend === name && (name !== 'Nightcap' || entry.maker === 'Peterson'))!)

async function library(context: BrowserContext) {
  const source = await fixture(825)
  const alternate = await fixture(825, 30)
  const labels = [...blends.slice(0, 6), blends[0]].map((entry, index) => ({
    ...entry, catalogId: entry.id, id: `43649b43-8094-4a32-b5ee-8be75208fb6${index + 1}`,
    edition: index === 6 ? 'Alternate fixture' : 'Community fixture', description: 'Geometric artwork with an empty date-writing area', geometry: 'circle-2.5',
  }))
  const packs = await Promise.all(labels.map((label, index) => buildGalleryPack({ metadata: { ...(index === 6 ? alternate : source).draft, catalogId: label.catalogId, edition: label.edition }, ...label, packId: label.id, createdAt: '2026-09-07T00:00:00Z' }, index === 6 ? alternate.png : source.png)))
  const outgoing: string[] = []
  context.on('request', request => outgoing.push(request.url() + (request.postData() ?? '')))
  await context.route('**/api/gallery/v1/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/config')) return route.fulfill({ json: { serving: true, intake: false, noticeVersion: 'fixture', turnstileSiteKey: '' } })
    if (url.pathname.endsWith('/labels')) {
      const id = url.searchParams.get('catalogId')
      return route.fulfill({ json: { serving: true, labels: id ? labels.filter(label => label.catalogId === id) : labels, nextCursor: null } })
    }
    const index = labels.findIndex(label => url.pathname.includes(label.id))
    if (index < 0) return route.fulfill({ status: 404 })
    if (url.pathname.endsWith('/pack')) return route.fulfill({ contentType: 'application/zip', body: Buffer.from(packs[index]) })
    return route.fulfill({ contentType: 'image/png', body: index === 6 ? alternate.png : source.png })
  })
  await context.route('**/api/labels/sources?*', route => route.fulfill({ json: { sources: [] } }))
  await context.route('**/api/labels/contributions', route => route.fulfill({ json: { status: 'collected', notesAllowed: true } }))
  return { source, outgoing }
}

async function savedRows(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open('tin-to-cellar-collection', 1)
      opening.onsuccess = () => resolve(opening.result)
      opening.onerror = () => reject(opening.error)
    })
    try {
      return await new Promise<Array<{ blend: string; designId: string | null; previousDesignId?: string | null; quantity: number; createRequested: boolean }>>((resolve, reject) => {
        const read = db.transaction('collection').objectStore('collection').get('active')
        read.onsuccess = () => resolve(read.result?.rows ?? [])
        read.onerror = () => reject(read.error)
      })
    } finally { db.close() }
  })
}

async function reviewOrder(page: Page, entries: Blend[]) {
  const text = page.getByRole('textbox', { name: 'Blend list', exact: true })
  await text.fill(entries.map(entry => `${entry.maker} ${entry.blend}`).join('\n'))
  await page.getByRole('button', { name: 'Find blends', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Review your blends', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Save ${entries.length} ${entries.length === 1 ? 'blend' : 'blends'} and choose designs`, exact: true })).toBeEnabled()
}

async function saveOrder(page: Page, entries: Blend[]) {
  await reviewOrder(page, entries)
  await page.getByRole('button', { name: `Save ${entries.length} ${entries.length === 1 ? 'blend' : 'blends'} and choose designs`, exact: true }).click()
  await expect(page).toHaveURL(/\/labels\/create$/)
  await expect(page.getByRole('heading', { name: 'Your saved selection', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Needs artwork (${entries.length})`, exact: true })).toBeVisible()
}

function card(page: Page, entry: Blend, edition = 'Community fixture') {
  return page.getByRole('article').filter({ has: page.getByRole('heading', { name: `${entry.maker} · ${entry.blend}`, exact: true }) }).filter({ hasText: edition })
}

async function useCommunity(page: Page, entry: Blend) {
  const design = card(page, entry)
  await design.getByRole('button', { name: `Use for your ${entry.blend} label`, exact: true }).click()
  await expect(design.getByRole('button', { name: 'Added to your labels', exact: true })).toBeDisabled()
}

for (const width of [1280, 320]) test(`equal home entrances, local order review, and saved resume at ${width}px`, async ({ context, page }) => {
  await library(context)
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/labels')
  const order = page.getByRole('button', { name: /^Add several blends/ })
  const browse = page.getByRole('button', { name: /^Browse label designs/ })
  await expect(order).toBeVisible(); await expect(browse).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume your labels', exact: true })).toHaveCount(0)
  await order.click()
  await expect(page).toHaveURL(/\/labels\/order$/)
  await expect(page.getByRole('button', { name: /Choose an image or PDF/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add several blends', exact: true })).toHaveCount(0)
  await reviewOrder(page, blends.slice(0, 2))
  expect(await savedRows(page)).toHaveLength(0)
  await page.getByRole('button', { name: 'Cancel review', exact: true }).click()
  expect(await savedRows(page)).toHaveLength(0)
  await saveOrder(page, blends.slice(0, 2))
  await expect(page.getByRole('button', { name: 'Review & print', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Tin to Cellar home', exact: true }).click()
  await page.getByRole('button', { name: 'Resume your labels', exact: true }).click()
  await expect(page).toHaveURL(/\/labels\/create$/)
  await expect(page.getByRole('article', { name: blends[0].blend, exact: true })).toContainText('Needs artwork')
  await page.getByRole('button', { name: 'Browse label designs', exact: true }).click()
  await useCommunity(page, blends[0])
  const saved = await savedRows(page)
  expect(saved).toHaveLength(2)
  expect(saved.filter(row => row.designId)).toHaveLength(1)
  expect(saved.every(row => row.quantity === 1)).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 500))
  await page.getByRole('button', { name: 'View your labels', exact: true }).focus()
  const browsePosition = await page.evaluate(() => window.scrollY)
  await page.getByRole('button', { name: 'View your labels', exact: true }).press('Enter')
  await page.getByRole('button', { name: 'Browse label designs', exact: true }).click()
  await expect.poll(() => page.evaluate(position => Math.abs(window.scrollY - position), browsePosition)).toBeLessThanOrEqual(8)
  await expect(card(page, blends[0]).getByRole('button', { name: 'Added to your labels', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'View your labels', exact: true }).click()
  await page.getByRole('button', { name: 'Needs artwork (1)', exact: true }).click()
  await expect(page.getByRole('article', { name: blends[0].blend, exact: true })).toHaveCount(0)
  await expect(page.getByRole('article', { name: blends[1].blend, exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.getByRole('button', { name: 'Review & print', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 1 label', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(1)
})

test('ten saved requests combine six community choices and three returned designs, leaving the missing request visible', async ({ context, page }) => {
  test.setTimeout(90000)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const { source, outgoing } = await library(context)
  await page.goto('/labels/order')
  await saveOrder(page, blends)
  await page.getByRole('button', { name: 'Browse label designs', exact: true }).click()
  for (const entry of blends.slice(0, 6)) await useCommunity(page, entry)
  await page.getByRole('button', { name: 'View your labels', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ready (6)', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Needs artwork (4)', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Copy prompt/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose artwork to create', exact: true }).click()
  const creation = page.getByRole('dialog', { name: 'Choose artwork to create', exact: true })
  await expect(creation.getByRole('checkbox', { checked: true })).toHaveCount(4)
  await creation.getByRole('button', { name: 'Continue with 4 labels', exact: true }).click()
  await expect(page).toHaveURL(/\/labels\/artwork$/)
  await page.getByRole('button', { name: 'Continue with 4 labels', exact: true }).click()
  await page.getByRole('button', { name: 'Copy instructions for 4 labels', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Copied. Open your AI chat, paste, and send. Return here with the finished ZIP.' })).toBeVisible()
  const prompt = await page.evaluate(() => navigator.clipboard.readText())
  const input = prompt.slice(prompt.lastIndexOf('# Project input'))
  for (const entry of blends.slice(6)) expect(input).toContain(entry.blend)
  for (const entry of blends.slice(0, 6)) expect(input).not.toContain(entry.blend)
  await expect(page.getByRole('heading', { name: 'Create in your AI chat', exact: true })).toBeVisible()

  const manifest = structuredClone(source.manifest)
  manifest.packId = 'urn:uuid:43649b43-8094-4a32-b5ee-8be75208fb69'
  manifest.labels = blends.slice(6, 9).map((entry, index) => ({ ...structuredClone(source.manifest.labels[0]), id: `returned-${index}`, maker: entry.maker, blend: entry.blend, research: { ...source.manifest.labels[0].research, sources: [{ id: 'inert-source', type: 'web' as const, role: 'package-appearance' as const, url: 'https://example.com/DO-NOT-FETCH-TWO-ENTRY', title: 'Fixture reference', retrievedAt: manifest.createdAt }] } }))
  const returned = await new JSZip().file('manifest.json', JSON.stringify(manifest)).file('artwork/fixture-blend.png', source.png).generateAsync({ type: 'nodebuffer' })
  await expect(page.getByRole('button', { name: 'Choose finished ZIP', exact: true })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({ name: 'three-of-four.cellarpack.zip', mimeType: 'application/zip', buffer: returned })
  const review = page.getByRole('dialog', { name: 'Add your new labels', exact: true })
  await expect(review).toBeVisible()
  await expect(review).toContainText(blends[9].blend)
  expect((await savedRows(page)).filter(row => row.designId)).toHaveLength(6)
  await review.getByRole('button', { name: 'Add 3 labels', exact: true }).click()
  await expect.poll(async () => (await savedRows(page)).filter(row => row.designId).length).toBe(9)
  await expect(page).toHaveURL(/\/labels\/create$/)
  await page.getByRole('button', { name: 'Needs artwork (1)', exact: true }).click()
  const missing = page.getByRole('article', { name: blends[9].blend, exact: true })
  await expect(missing).toBeVisible()
  await expect(missing.getByRole('button', { name: 'Choose design', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Review & print', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 9 labels', exact: true })).toBeEnabled()
  await expect(page.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(9)
  const final = await savedRows(page)
  expect(final).toHaveLength(10)
  expect(final.find(row => row.blend === blends[9].blend)?.designId).toBeNull()
  expect(outgoing.some(request => request.includes('DO-NOT-FETCH-TWO-ENTRY') || request.includes('PRIVATE_RESEARCH_SENTINEL'))).toBe(false)
})

test('canceling a gallery replacement on a narrow screen keeps the saved design and print quantity', async ({ context, page }) => {
  await library(context)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/labels/order')
  await saveOrder(page, blends.slice(0, 1))
  await page.getByRole('button', { name: 'Browse label designs', exact: true }).click()
  await useCommunity(page, blends[0])
  await page.getByRole('button', { name: 'Review & print', exact: true }).click()
  await page.getByRole('spinbutton', { name: `Quantity for ${blends[0].blend}`, exact: true }).fill('3')
  await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
  const before = await savedRows(page)
  await page.goto('/gallery')
  await card(page, blends[0], 'Alternate fixture').getByRole('button').click()
  const review = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Replace design', exact: true }) })
  await expect(review).toBeVisible()
  await expect(review.getByRole('button', { name: 'Add separately', exact: true })).toBeVisible()
  await review.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(review).toHaveCount(0)
  expect(await savedRows(page)).toEqual(before)
  await page.getByRole('button', { name: 'Review & print', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
})

for (const width of [1280, 320]) test(`creation replacement can restore previous artwork or cancel and accept a returned ZIP at ${width}px`, async ({ context, page }) => {
  test.setTimeout(90000)
  await library(context)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/labels/order')
  await saveOrder(page, blends.slice(0, 2))
  await page.getByRole('button', { name: 'Browse label designs', exact: true }).click()
  for (const entry of blends.slice(0, 2)) await useCommunity(page, entry)
  await page.getByRole('button', { name: 'Review & print', exact: true }).click()
  await page.getByRole('spinbutton', { name: `Quantity for ${blends[0].blend}`, exact: true }).fill('3')
  await expect(page.getByRole('button', { name: 'Print 4 labels', exact: true })).toBeEnabled()
  const initial = await savedRows(page)
  const original = initial.find(row => row.blend === blends[0].blend)!
  await page.getByRole('button', { name: 'Add more labels', exact: true }).click()
  const replacementRow = page.getByRole('article', { name: blends[0].blend, exact: true })
  const requestReplacement = async () => {
    await replacementRow.getByRole('button', { name: 'Change design', exact: true }).click()
    await replacementRow.getByRole('button', { name: 'Create my own', exact: true }).click()
    await expect(replacementRow.getByRole('button', { name: 'Create my own', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ready (1)', exact: true })).toBeVisible()
    await expect.poll(async () => (await savedRows(page)).find(row => row.blend === blends[0].blend)).toMatchObject({ designId: null, previousDesignId: original.designId, quantity: 3, createRequested: true })
  }
  await requestReplacement()
  await page.getByRole('button', { name: 'Review & print', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 1 label', exact: true })).toBeEnabled()
  await expect(page.getByRole('spinbutton', { name: `Quantity for ${blends[0].blend}`, exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Print 1 label', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Add more labels', exact: true }).click()
  await replacementRow.getByRole('button', { name: 'Use previous design', exact: true }).click()
  await expect.poll(async () => (await savedRows(page)).find(row => row.blend === blends[0].blend)).toMatchObject({ designId: original.designId, quantity: 3, createRequested: false })
  await expect(page.getByRole('button', { name: 'Ready (2)', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Review & print', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 4 labels', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Add more labels', exact: true }).click()
  await requestReplacement()
  await page.getByRole('button', { name: 'Continue to creation', exact: true }).click()
  await expect(page).toHaveURL(/\/labels\/artwork$/)
  await expect(page.getByRole('heading', { name: 'Review your request', exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Requested artwork', exact: true })).toContainText(blends[0].blend)
  await expect(page.getByRole('list', { name: 'Requested artwork', exact: true })).not.toContainText(blends[1].blend)
  await expect(page.getByRole('button', { name: /^Copy instructions/ })).toHaveCount(0)
  await page.getByText('Design notes · optional', { exact: true }).click()
  const notes = page.getByRole('textbox', { name: `Requests for ${blends[0].blend} optional`, exact: true })
  await notes.fill('Keep a generous blank date-writing area.')
  await notes.press('Tab')
  await page.getByRole('button', { name: 'I already have a finished ZIP', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bring back your artwork', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose finished ZIP', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])

  const generated = await fixture(825, 55)
  const manifest = structuredClone(generated.manifest)
  manifest.packId = 'urn:uuid:43649b43-8094-4a32-b5ee-8be75208fb70'
  manifest.labels[0].maker = blends[0].maker
  manifest.labels[0].blend = blends[0].blend
  const returned = { name: 'replacement.cellarpack.zip', mimeType: 'application/zip', buffer: await new JSZip().file('manifest.json', JSON.stringify(manifest)).file('artwork/fixture-blend.png', generated.png).generateAsync({ type: 'nodebuffer' }) }
  const pending = await savedRows(page)
  await page.getByLabel('Label ZIP', { exact: true }).setInputFiles(returned)
  const review = page.getByRole('dialog', { name: 'Add your new labels', exact: true })
  await expect(review).toBeVisible()
  await expect(page).toHaveURL(/\/labels\/artwork$/)
  await review.getByRole('button', { name: 'Cancel import', exact: true }).click()
  await expect(review).toHaveCount(0)
  await expect(page).toHaveURL(/\/labels\/artwork$/)
  await expect(page.getByRole('button', { name: 'Choose finished ZIP', exact: true })).toBeEnabled()
  expect(await savedRows(page)).toEqual(pending)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Review your request', exact: true })).toBeVisible()
  await page.getByText('Design notes · added', { exact: true }).click()
  await expect(notes).toHaveValue('Keep a generous blank date-writing area.')
  await page.getByRole('button', { name: 'I already have a finished ZIP', exact: true }).click()
  await page.getByLabel('Label ZIP', { exact: true }).setInputFiles(returned)
  await expect(review).toBeVisible()
  await review.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  await expect(page).toHaveURL(/\/labels\/create$/)
  await expect(page.getByRole('button', { name: 'Ready (2)', exact: true })).toBeVisible()
  const accepted = (await savedRows(page)).find(row => row.blend === blends[0].blend)!
  expect(accepted.designId).toBeTruthy()
  expect(accepted.designId).not.toBe(original.designId)
  expect(accepted.quantity).toBe(3)
  expect(accepted.createRequested).toBe(false)
  expect(accepted.previousDesignId).toBeUndefined()
  await page.getByRole('button', { name: 'Review & print', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 4 labels', exact: true })).toBeEnabled()
  await expect(page.getByRole('spinbutton', { name: `Quantity for ${blends[0].blend}`, exact: true })).toHaveValue('3')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Print 4 labels', exact: true })).toBeEnabled()
  await expect(page.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(2)
})
