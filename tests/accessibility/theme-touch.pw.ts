import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch interaction requires a mobile project')
  await page.route('**/api/**', route => route.fulfill({ status: 503, body: '{}' }))
  await page.route('https://**/*', route => route.abort())
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/labels/create')
})

for (const target of ['radio', 'text', 'label-space'] as const) test(`theme responds to taps on ${target}, persists and follows System`, async ({ page }, testInfo) => {
  const trigger = page.getByRole('button', { name: /^Theme:/ })
  await trigger.tap()
  await expect(page.getByRole('group', { name: 'Appearance' })).toBeVisible()
  const pick = async (name: 'Dark' | 'Light' | 'System') => {
    if (target === 'radio') await page.getByRole('radio', { name, exact: true }).tap()
    else {
      const label = page.locator('.theme-panel label').filter({ hasText: name })
      if (target === 'text') await label.locator('span').tap()
      else {
        const box = await label.boundingBox()
        await label.tap({ position: { x: box!.width - 12, y: box!.height / 2 } })
      }
    }
  }
  await pick('Dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(36, 35, 31)')
  await expect(trigger).toHaveAttribute('aria-label', 'Theme: Dark')
  await page.screenshot({ path: testInfo.outputPath('dark-touch.png') })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await trigger.tap()
  await pick('Light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(245, 240, 232)')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await pick('System')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => localStorage.getItem('tin-to-cellar:theme'))).toBeNull()
  await page.getByRole('heading', { name: 'Your labels', exact: true }).tap()
  await expect(page.getByRole('group', { name: 'Appearance' })).toBeHidden()
})
