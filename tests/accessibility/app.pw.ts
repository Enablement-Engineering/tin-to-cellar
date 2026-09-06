import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Keep the audit local and deterministic. Third-party verification and video
// accessibility require separate manual checks against the hosted services.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, body: '{}' }))
  await page.route('https://**/*', route => route.abort())
})
async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  expect(results.violations).toEqual([])
}
for (const width of [1280, 320]) {
  for (const route of ['home', 'create', 'print', 'help', 'about', 'inspiration', 'privacy']) {
    test(`${route} at ${width}px has no automated violations or horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/#${route}`)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await audit(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }
}
test('skip link is first, preserves the route, and route changes set focus and title', async ({ page }) => {
  await page.goto('/#create')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page).toHaveURL(/#create$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Make a prompt' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Workflow' }).getByRole('button', { name: 'Print labels' }).click()
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page).toHaveTitle('Print labels | Tin to Cellar')
  await page.goBack()
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page).toHaveTitle('Make a prompt | Tin to Cellar')
})
test('keyboard suggestions and removal preserve focus', async ({ page }) => {
  await page.goto('/#create')
  const input = page.getByRole('combobox', { name: 'Tobaccos' })
  await input.fill('Peterson')
  await input.press('ArrowDown')
  await audit(page)
  await input.press('Enter')
  await expect(input).toBeFocused()
  await input.press('Tab')
  await expect(page.getByRole('button', { name: /^Remove / })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(input).toBeFocused()
  await expect(input).not.toHaveAttribute('aria-controls')
})
test('order review can be completed by keyboard and returns focus to its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/#create')
  const trigger = page.getByRole('button', { name: 'Import order', exact: true })
  await trigger.focus()
  await trigger.press('Enter')
  await page.getByRole('textbox', { name: 'Order text' }).fill('G. L. Pease\nQuiet Nights 2oz')
  await page.getByRole('button', { name: 'Find tobaccos' }).press('Enter')
  await audit(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Add selected tobaccos' }).press('Enter')
  await expect(trigger).toBeFocused()
})
test('ZIP input has one visible keyboard entry and failed imports announce a result', async ({ page }) => {
  await page.goto('/#print')
  await page.getByRole('link', { name: 'Skip to main content' }).focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Choose ZIP' })).toBeFocused()
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'invalid.zip', mimeType: 'application/zip', buffer: Buffer.from('invalid archive') })
  await expect(page.getByRole('status').filter({ hasText: 'ZIP needs repair' })).toBeVisible()
  await audit(page)
})
test('forced colors retain a field outline and reduced motion disables smooth scrolling', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  await page.goto('/#create')
  const input = page.getByRole('combobox', { name: 'Tobaccos' })
  await input.focus()
  await expect(input).toHaveCSS('outline-style', 'solid')
  await expect(input).toHaveCSS('outline-width', '2px')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto')
})

test('expanded prompt stays accessible at narrow width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/#create')
  await page.getByText('Read prompt', { exact: true }).click()
  await page.getByText('More options', { exact: true }).click()
  await audit(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Markdown source' }).click()
  await audit(page)
})

for (const width of [1280, 640, 320]) {
  test(`imported sheet, alignment and pagination are accessible at ${width}px`, async ({ page }) => {
    const { printablePack } = await import('./pack')
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#print')
    const status = page.getByRole('status').first()
    await page.getByRole('button', { name: 'Choose ZIP' }).focus()
    await page.getByLabel('Label ZIP').setInputFiles({ name: 'fixture.zip', mimeType: 'application/zip', buffer: await printablePack() })
    await expect(status).toContainText('Labels ready to print')
    await expect(page.getByRole('heading', { name: 'Your labels' })).toBeFocused()
    await page.getByText('Paper and alignment', { exact: true }).click()
    await page.getByRole('spinbutton', { name: 'Quantity for Fixture Blend' }).fill('10')
    await page.getByRole('button', { name: 'Next sheet' }).press('Enter')
    const preview = page.getByRole('region', { name: 'Preview sheet 2' })
    await expect(preview.getByRole('img', { name: 'Slot 1: Fixture Maker — Fixture Blend' })).toBeVisible()
    await expect(preview.getByRole('img', { name: 'Slot 2: empty', exact: true })).toBeVisible()
    await audit(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/print-${width}.png`, fullPage: true })
  })
}
