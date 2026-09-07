import { test, expect } from '@playwright/test'

test('workflow header fits narrow screens and keeps help in the footer', async ({ page }) => {
  await page.goto('/labels/print')
  const navigation = page.getByRole('navigation', { name: 'Workflow' })
  await expect(navigation.getByRole('link', { name: 'Choose labels', exact: true })).toBeVisible()
  await expect(navigation.getByRole('link', { name: 'Print labels', exact: true })).toBeVisible()
  await expect(navigation.getByRole('link', { name: 'Community labels' })).toHaveCount(0)
  await expect(navigation.getByRole('link', { name: 'How it works' })).toHaveCount(0)
  for (const width of [320, 375, 600, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const link of await navigation.getByRole('link').all()) {
      const box = await link.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
    expect(await page.locator('.site-header').evaluate(element => element.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    if (width === 375 || width === 1024) await page.locator('.site-header').screenshot({ path: `/private/tmp/tin-header-${width}.png` })
  }
  const help = page.getByRole('contentinfo').getByRole('link', { name: 'How it works' })
  await expect(help).toHaveAttribute('href', '/labels/help')
  await help.click()
  await expect(page).toHaveURL(/\/labels\/help$/)
  await expect(help).toHaveAttribute('aria-current', 'page')
})
