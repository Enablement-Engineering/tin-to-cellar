import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const width of [1280, 320]) for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`motion preserves native focus, disclosure and copy behavior at ${width}px with ${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion })
    await page.route('**/api/**', route => route.fulfill({ status: 503, body: '{}' }))
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => undefined } })
    })
    await page.goto('/labels/create')
    const search = page.getByRole('combobox', { name: 'Add a blend' })
    await search.fill('Motion review blend')
    await search.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Choose artwork for Motion review blend' })
    await expect(dialog.getByRole('heading', { level: 2 })).toBeFocused()
    expect(await dialog.evaluate(element => getComputedStyle(element).animationName)).toBe(reducedMotion === 'reduce' ? 'none' : 'tc-dialog-enter')
    expect(await dialog.evaluate(element => getComputedStyle(element, '::backdrop').animationName)).toBe(reducedMotion === 'reduce' ? 'none' : 'tc-backdrop-enter')
    // Dismissal retains native modality while the dialog and backdrop fade out.
    const closing = await dialog.evaluate(element => {
      element.dispatchEvent(new Event('cancel', { cancelable: true }))
      return {
        open: element.hasAttribute('open'),
        animation: getComputedStyle(element).animationName,
        backdrop: getComputedStyle(element, '::backdrop').animationName,
        focusInside: element.contains(document.activeElement),
      }
    })
    if (reducedMotion === 'no-preference') {
      expect(closing).toEqual({ open: true, animation: 'tc-dialog-exit', backdrop: 'tc-backdrop-exit', focusInside: true })
    }
    await expect(dialog).toHaveCount(0)
    await expect(search).toBeFocused()
    await search.press('Enter')
    // A preference change must also stop an already-open dialog's motion.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await dialog.evaluate(element => getComputedStyle(element).animationName)).toBe('none')
    expect(await dialog.evaluate(element => getComputedStyle(element, '::backdrop').animationName)).toBe('none')
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(search).toBeFocused()

    await page.emulateMedia({ reducedMotion })
    await search.press('Enter')
    await dialog.getByRole('button', { name: 'Create with AI', exact: true }).click()
    await expect(search).toBeFocused()
    await expect(page.getByRole('article', { name: 'Motion review blend' })).toContainText('To create with AI')
    await page.reload()
    await expect(page.getByRole('article', { name: 'Motion review blend' })).toBeVisible()
    await expect(page.locator('.preparation-row[data-confirmed]')).toHaveCount(0)
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto')

    await page.getByRole('button', { name: 'Continue to creation', exact: true }).click()
    const summary = page.locator('.creation-notes > summary')
    await summary.focus()
    await summary.press('Enter')
    const notes = page.getByRole('textbox', { name: 'Requests for Motion review blend optional' })
    await expect(notes).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(notes).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await summary.press('Enter')
    await expect(notes).toBeHidden()
    await expect(summary).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Continue with 1 label' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Create in your AI chat' })).toBeFocused()

    const copy = page.getByRole('button', { name: 'Copy instructions for 1 label', exact: true })
    const before = await copy.boundingBox()
    await copy.click()
    await expect(page.locator('.handoff .copy-status')).toContainText('Copied. Open your AI chat')
    await expect(copy.locator('[data-copied="true"]')).toHaveCount(1)
    expect((await copy.boundingBox())!.width).toBeCloseTo(before!.width, 1)
    if (reducedMotion === 'reduce') {
      expect(await copy.locator('.copy-feedback-icon > svg').first().evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s')
    }
    await expect(page.getByRole('button', { name: 'Choose finished ZIP', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  })
}
