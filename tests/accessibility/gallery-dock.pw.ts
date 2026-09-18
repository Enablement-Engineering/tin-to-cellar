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
  // Pause actual browser animations midway so slow CI frame delivery cannot
  // skip over the position we need to inspect.
  await summary.evaluate(element => {
    const animate = element.animate.bind(element)
    element.animate = (keyframes, options) => {
      const animation = animate(keyframes, options)
      animation.pause()
      animation.currentTime = 0
      return animation
    }
  })
  for (const width of [390, 831]) {
    const before = (await summary.boundingBox())!
    await page.setViewportSize({ width, height: 900 })
    await expect(summary).toHaveCSS('position', width <= 680 ? 'fixed' : 'sticky')
    if (reducedMotion === 'no-preference') {
      await expect.poll(() => summary.evaluate(element => element.getAnimations().length)).toBe(1)
      const { during, after } = await summary.evaluate(element => {
        const animation = element.getAnimations()[0]!
        animation.currentTime = Number(animation.effect!.getTiming().duration) / 2
        const during = element.getBoundingClientRect().y
        animation.finish()
        return { during, after: element.getBoundingClientRect().y }
      })
      await expect.poll(() => summary.evaluate(element => element.getAnimations().length)).toBe(0)
      // Motion must travel between the two docks, not only fade or jump.
      expect(during).toBeGreaterThan(Math.min(before.y, after) + 2)
      expect(during).toBeLessThan(Math.max(before.y, after) - 2)
    } else {
      expect(await summary.evaluate(element => element.getAnimations().length)).toBe(0)
    }
    await expect(view).toBeFocused()
    await expect(summary).toHaveCSS('position', width <= 680 ? 'fixed' : 'sticky')
    const box = (await summary.boundingBox())!
    if (width <= 680) expect(Math.abs(box.y + box.height - 900)).toBeLessThan(2)
    else expect(box.y + box.height).toBeLessThan(700)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
