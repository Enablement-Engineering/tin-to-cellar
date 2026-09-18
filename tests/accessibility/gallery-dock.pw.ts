import { expect, test } from '@playwright/test'
import { printablePack } from './pack'

for (const reducedMotion of ['no-preference', 'reduce'] as const) test(`gallery dock resize respects ${reducedMotion}`, async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, body: '{}' }))
  await page.route('https://**/*', route => route.abort())
  await page.setViewportSize({ width: 831, height: 900 })
  await page.emulateMedia({ reducedMotion })
  await page.goto('/labels/print')
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'dock.zip', mimeType: 'application/zip', buffer: await printablePack() })
  await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  await expect(page.locator('.avery-sheet')).toBeVisible()
  await page.goto('/gallery')
  const summary = page.locator('.gallery-page > .preparation-summary')
  const view = summary.getByRole('button', { name: 'View your labels' })
  await expect(view).toBeVisible()
  await view.focus()
  expect(await summary.evaluate(element => element.getAnimations().length)).toBe(0)
  for (const width of [390, 831]) {
    const before = (await summary.boundingBox())!
    // WebKit can finish its resize command after the short animation has ended.
    // Observe frames before requesting the resize so we capture motion in both engines.
    const frames = summary.evaluate(element => new Promise<{ y: number; moving: boolean }[]>(resolve => {
      const samples: { y: number; moving: boolean }[] = []
      const start = performance.now()
      const sample = () => {
        samples.push({ y: element.getBoundingClientRect().y, moving: element.getAnimations().length > 0 })
        if (performance.now() - start < 700) requestAnimationFrame(sample)
        else resolve(samples)
      }
      requestAnimationFrame(sample)
    }))
    await page.setViewportSize({ width, height: 900 })
    const samples = await frames
    const after = (await summary.boundingBox())!
    if (reducedMotion === 'no-preference') {
      // Motion must travel between the two docks, not only fade or jump.
      expect(samples.some(frame => frame.moving && frame.y > Math.min(before.y, after.y) + 2 && frame.y < Math.max(before.y, after.y) - 2), JSON.stringify({ before, after, samples })).toBe(true)
    } else {
      expect(samples.some(frame => frame.moving)).toBe(false)
    }
    await expect(view).toBeFocused()
    await expect(summary).toHaveCSS('position', width <= 680 ? 'fixed' : 'sticky')
    const box = (await summary.boundingBox())!
    if (width <= 680) expect(Math.abs(box.y + box.height - 900)).toBeLessThan(2)
    else expect(box.y + box.height).toBeLessThan(700)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
