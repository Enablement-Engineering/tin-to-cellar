import { expect, test } from '@playwright/test'
import { encode } from 'fast-png'

const png = Buffer.from(encode({ width: 12, height: 12, channels: 4, data: Uint8Array.from({ length: 12 * 12 * 4 }, (_, i) => [28, 66, 102, 255][i % 4]) }))
const previewDataUrl = `data:image/png;base64,${png.toString('base64')}`
const label = { catalogId: 'peterson-nightcap', artworkProfileId: 'circle-2.5@1', publishedAt: '2026-09-01', id: 'design-one', maker: 'Peterson', blend: 'Nightcap', altText: 'A dark blue evening design', previewDataUrl }

for (const reducedMotion of ['no-preference', 'reduce'] as const) test(`blur previews survive delayed loads with ${reducedMotion} motion`, async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion })
  let releaseThumbnail!: () => void, releaseArtwork!: () => void
  const thumbnailReady = new Promise<void>(resolve => { releaseThumbnail = resolve })
  const artworkReady = new Promise<void>(resolve => { releaseArtwork = resolve })
  await page.route('**/api/gallery/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/config')) return route.fulfill({ json: { serving: true } })
    if (path.endsWith('/browse')) return route.fulfill({ json: { labels: [label], nextCursor: null, serving: true } })
    await (path.endsWith('/thumbnail') ? thumbnailReady : artworkReady)
    return route.fulfill({ contentType: 'image/png', body: png })
  })
  await page.goto('/gallery')
  const card = page.locator('.gallery-thumbnail')
  const image = card.getByRole('img')
  await expect(card).toHaveClass(/gallery-image--pending/)
  await expect(card.locator('.gallery-image-placeholder')).toHaveJSProperty('naturalWidth', 12)
  await expect(card.locator('.gallery-image-placeholder')).toHaveCSS('opacity', '1')
  await expect(image).toHaveCSS('opacity', '0')
  await card.screenshot({ path: testInfo.outputPath('blur-placeholder.png') })
  const before = await card.boundingBox()
  releaseThumbnail()
  await expect(card).toHaveClass(/gallery-image--loaded/)
  await expect(image).toHaveCSS('opacity', '1')
  await expect(image).toHaveCSS('filter', 'none')
  await expect(image).toHaveCSS('transition-duration', reducedMotion === 'reduce' ? '0s' : '0.2s, 0.2s')
  expect(await card.boundingBox()).toEqual(before)
  await page.getByRole('button', { name: 'View full-resolution Nightcap by Peterson artwork' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nightcap', exact: true })
  await expect(dialog.locator('.gallery-image')).toHaveClass(/gallery-image--pending/)
  await expect(dialog.locator('.gallery-image-placeholder')).toHaveJSProperty('naturalWidth', 12)
  await expect(dialog.getByRole('img')).toHaveCount(1)
  releaseArtwork()
  await expect(dialog.locator('.gallery-image')).toHaveClass(/gallery-image--loaded/)
  await expect(dialog.getByRole('img')).toHaveCSS('opacity', '1')
  await page.keyboard.press('Escape')
  // Reopening must also work for images already decoded by the browser.
  await page.getByRole('button', { name: 'View full-resolution Nightcap by Peterson artwork' }).click()
  await expect(dialog.locator('.gallery-image')).toHaveClass(/gallery-image--loaded/)
})

test('missing previews and failed images keep space and show a fallback', async ({ page }) => {
  let release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/gallery/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/config')) return route.fulfill({ json: { serving: true } })
    if (path.endsWith('/browse')) return route.fulfill({ json: { labels: [{ ...label, previewDataUrl: undefined }], nextCursor: null, serving: true } })
    await ready
    return route.fulfill({ status: 503 })
  })
  await page.goto('/gallery')
  const card = page.locator('.gallery-thumbnail')
  await expect(card).toHaveClass(/gallery-image--pending/)
  const before = await card.boundingBox()
  expect(before!.height).toBeGreaterThan(100)
  release()
  await expect(card.getByText('Image unavailable')).toBeVisible()
  expect(await card.boundingBox()).toEqual(before)
  await page.getByRole('button', { name: 'View full-resolution Nightcap by Peterson artwork' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nightcap', exact: true })
  await expect(dialog.getByRole('alert')).toHaveText('The image could not load. Try opening the direct image link.')
  await expect(dialog.getByRole('link', { name: 'Open original image (new tab)' })).toBeVisible()
})

test('mobile cards reserve square space and defer distant thumbnails', async ({ page }) => {
  const requested: string[] = []
  await page.setViewportSize({ width: 320, height: 900 })
  await page.route('**/api/gallery/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/config')) return route.fulfill({ json: { serving: true } })
    if (path.endsWith('/browse')) return route.fulfill({ json: { labels: Array.from({ length: 24 }, (_, i) => ({ ...label, id: `design-${i}` })), nextCursor: null, serving: true } })
    requested.push(path)
    return route.fulfill({ contentType: 'image/png', body: png })
  })
  await page.goto('/gallery')
  const cards = page.locator('.gallery-thumbnail')
  await expect(cards).toHaveCount(24)
  await expect(cards.first()).toHaveClass(/gallery-image--loaded/)
  const box = await cards.first().boundingBox()
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(1)
  expect(requested.length).toBeLessThan(24)
  await cards.last().scrollIntoViewIfNeeded()
  await expect(cards.last()).toHaveClass(/gallery-image--loaded/)
  expect(requested.every(path => path.endsWith('/thumbnail'))).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
