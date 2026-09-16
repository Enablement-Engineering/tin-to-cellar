import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { printablePack } from './pack'

async function choose(page: Page, theme: 'System' | 'Light' | 'Dark') {
  await page.getByRole('button', { name: /^Theme:/ }).click()
  await page.getByRole('radio', { name: theme, exact: true }).check()
  await page.keyboard.press('Escape')
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, body: '{}' }))
  await page.route('https://**/*', route => route.abort())
})

test('system changes, saved overrides, reset and another tab stay in sync', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: 'Theme: System' })).toBeVisible()
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await choose(page, 'Dark')
  await expect(page.getByRole('button', { name: 'Theme: Dark' })).toBeFocused()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#24231f')
  const other = await context.newPage()
  await other.goto('/privacy')
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark')
  await choose(page, 'Light')
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await choose(page, 'System')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await page.evaluate(() => localStorage.getItem('tin-to-cellar:theme'))).toBeNull()
})

test('saved preference is applied before the application starts', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(() => localStorage.setItem('tin-to-cellar:theme', 'light'))
  await page.route('**/src/main.tsx', route => route.abort())
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f5f0e8')
})

test('blocked storage still allows theme changes', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage blocked', 'SecurityError') }
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError') }
    Storage.prototype.removeItem = () => { throw new DOMException('Storage blocked', 'SecurityError') }
  })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await choose(page, 'Light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await choose(page, 'System')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('an invalid saved preference follows the system', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tin-to-cellar:theme', 'invalid'))
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Theme: System' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('keyboard focus leaving the theme control closes the panel', async ({ page }) => {
  await page.goto('/labels/create')
  const trigger = page.getByRole('button', { name: 'Theme: System' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('group', { name: 'Appearance' })).toBeHidden()
  await expect(page.getByRole('combobox').first()).toBeFocused()
})

test('dark mode keeps imported artwork, sheet previews and printed pages intact', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.goto('/labels/print')
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'theme-print.zip', mimeType: 'application/zip', buffer: await printablePack() })
  await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  await expect(page.locator('.avery-sheet')).toBeVisible()
  await expect(page.locator('.avery-sheet')).toHaveCSS('background-color', 'rgb(251, 248, 243)')
  await expect(page.locator('.label-art').first()).toHaveCSS('filter', 'none')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('dark-print-workspace.png'), fullPage: true })
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await expect(page.locator('.production-page')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(page.locator('.production-page')).toHaveCSS('color', 'rgb(0, 0, 0)')
  const darkPrint = await page.locator('.production-page').screenshot()
  await page.emulateMedia({ media: 'screen' })
  await choose(page, 'Light')
  await page.emulateMedia({ media: 'print' })
  expect(await page.locator('.production-page').screenshot()).toEqual(darkPrint)
  await page.evaluate(() => { document.body.dataset.printMode = 'calibration' })
  await expect(page.locator('.proof-slot').first()).toHaveCSS('color', 'rgb(0, 0, 0)')
})

test('gallery artwork dialog remains readable in dark mode', async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.route('**/api/gallery/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/config')) return route.fulfill({ json: { serving: true, intake: false } })
    if (path.endsWith('/browse')) return route.fulfill({ json: { labels: [{ id: 'design-one', catalogId: 'peterson-nightcap', maker: 'Peterson', blend: 'Nightcap', edition: '', altText: 'A dark blue evening design.', artworkProfileId: 'circle-2.5@1', publishedAt: '2026-09-01' }], nextCursor: null, serving: true } })
    if (/\/(artwork|thumbnail)$/.test(path)) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1500"><circle cx="750" cy="750" r="750" fill="#123456"/></svg>' })
    return route.fulfill({ status: 503, body: '{}' })
  })
  await page.goto('/gallery')
  await page.getByRole('button', { name: 'View full-resolution Nightcap by Peterson artwork' }).click()
  await expect(page.getByRole('dialog', { name: 'Nightcap', exact: true })).toBeVisible()
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('dark-gallery-dialog.png') })
})

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [1280, 320]) {
    test(`${colorScheme} theme at ${width}px has readable pages and keyboard controls`, async ({ page }, testInfo) => {
      test.setTimeout(60_000)
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      for (const route of ['/', '/labels/create', '/labels/print', '/labels/help', '/privacy']) {
        await page.goto(route)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        if (route === '/') await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true })
      }
      const button = page.getByRole('button', { name: 'Theme: System' })
      await button.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked()
      await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked()
      await page.getByRole('radio', { name: 'Dark', exact: true }).click({ trial: true })
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath('theme-control.png') })
      await page.keyboard.press('Escape')
      await expect(page.getByRole('button', { name: 'Theme: Dark' })).toBeFocused()
      await page.getByRole('button', { name: 'Theme: Dark' }).click()
      // Use the page margin: the open panel can cover the heading on mobile.
      await page.mouse.click(8, 350)
      await expect(page.getByRole('group', { name: 'Appearance' })).toBeHidden()
      await page.emulateMedia({ forcedColors: 'active' })
      await page.getByRole('button', { name: 'Theme: Dark' }).focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(page.getByRole('button', { name: 'Theme: Dark' })).toHaveCSS('outline-style', 'solid')
    })
  }
}
