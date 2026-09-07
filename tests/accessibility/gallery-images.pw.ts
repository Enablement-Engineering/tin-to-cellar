import { test, expect } from '@playwright/test'

for (const reducedMotion of ['no-preference', 'reduce'] as const) test(`thumbnail reveal respects ${reducedMotion} motion preference`, async ({ page }) => {
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
  await expect(image).toHaveCSS('animation-name', reducedMotion === 'reduce' ? 'none' : 'gallery-thumbnail-reveal')
  await expect(image).toHaveCSS('opacity', '1')
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
