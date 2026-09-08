import { test, expect } from '@playwright/test'

for (const reducedMotion of ['no-preference', 'reduce'] as const) test(`thumbnails appear immediately with ${reducedMotion} motion preference`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion })
  await page.route('**/api/gallery/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/config')) return route.fulfill({ json: { serving: true } })
    if (path.endsWith('/labels')) return route.fulfill({ json: { labels: [{ id: 'one', maker: 'Test maker', blend: 'One', description: 'A label design' }], nextCursor: null } })
    return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=', 'base64') })
  })
  await page.goto('/gallery')
  const image = page.getByRole('img', { name: 'A label design' })
  await expect(page.locator('.gallery-thumbnail--loaded')).toBeVisible()
  await expect(image).toHaveCSS('animation-name', 'none')
  await expect(image).toHaveCSS('opacity', '1')
  await expect(image).toHaveCSS('filter', 'none')
  await expect(image).toBeVisible()
})

for (const width of [1280, 320]) test(`gallery defers distant thumbnails and reserves image space at ${width}px`, async ({ page }) => {
  const requested = new Set<string>()
  const labels = Array.from({ length: 24 }, (_, index) => ({ id: `label-${String(index).padStart(2, '0')}`, maker: 'Test maker', blend: `Blend ${index}`, description: `Label design ${index}` }))
  await page.route('**/api/gallery/v1/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/config')) return route.fulfill({ json: { serving: true } })
    if (url.pathname.endsWith('/labels')) return route.fulfill({ json: { labels, nextCursor: null } })
    requested.add(url.pathname)
    // Keep images unavailable to verify layout does not depend on their bytes.
    return route.fulfill({ status: 204 })
  })
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/gallery')
  const images = page.getByRole('region', { name: 'Label results' }).getByRole('img')
  await expect(images).toHaveCount(24)
  await expect.poll(() => requested.has('/api/gallery/v1/labels/label-00/thumbnail')).toBe(true)
  const box = await images.first().boundingBox()
  expect(box!.height).toBeGreaterThan(100)
  expect(Math.abs(box!.width - box!.height)).toBeLessThan(1)
  expect(requested.has('/api/gallery/v1/labels/label-23/thumbnail')).toBe(false)
  expect(requested.size).toBeLessThan(24)
  await images.last().scrollIntoViewIfNeeded()
  await expect.poll(() => requested.has('/api/gallery/v1/labels/label-23/thumbnail')).toBe(true)
  expect([...requested].every(path => path.endsWith('/thumbnail'))).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

for (const width of [1280, 390]) test(`gallery preloads the next page without moving existing cards at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const labels = Array.from({ length: 48 }, (_, index) => ({ id: `label-${String(index).padStart(2, '0')}`, maker: 'Test maker', blend: `Blend ${index}`, description: `Label design ${index}` }))
  let releasePage: () => void = () => {}
  const nextPage = new Promise<void>(resolve => { releasePage = resolve })
  let nextRequested = false
  await page.route('**/api/gallery/v1/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/config')) return route.fulfill({ json: { serving: true } })
    if (url.pathname.endsWith('/labels')) {
      if (url.searchParams.has('cursor')) {
        nextRequested = true
        await nextPage
        return route.fulfill({ json: { labels: labels.slice(24), nextCursor: null } })
      }
      return route.fulfill({ json: { labels: labels.slice(0, 24), nextCursor: 'label-23' } })
    }
    return route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAt8AAAAASUVORK5CYII=', 'base64') })
  })
  await page.goto('/gallery')
  await expect(page.locator('.gallery-card')).toHaveCount(24)
  await page.evaluate(async () => { await document.fonts.ready })
  expect(nextRequested).toBe(false)
  // Start loading while the end is still a full 1,000px below the viewport.
  await page.getByRole('button', { name: 'Show more labels', exact: true }).evaluate(element => {
    window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - innerHeight - 1000, behavior: 'instant' })
  })
  await expect.poll(() => nextRequested).toBe(true)
  const existingCard = page.locator('.gallery-card').nth(20)
  const before = await existingCard.boundingBox()
  const scrollBefore = await page.evaluate(() => scrollY)
  releasePage()
  await expect(page.locator('.gallery-card')).toHaveCount(48)
  const after = await existingCard.boundingBox()
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(1)
  expect(Math.abs(await page.evaluate(() => scrollY) - scrollBefore)).toBeLessThan(1)
  await expect(page.getByText(/^Showing \d+ labels/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show more labels', exact: true })).toHaveCount(0)
  await expect(page.locator('.gallery-pagination [role="status"]')).toBeEmpty()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
