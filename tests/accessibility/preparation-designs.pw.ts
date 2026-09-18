import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'

const artwork = readFileSync(new URL('../../public/examples/ten-blends/cornell-diehl-autumn-evening.jpg', import.meta.url))

test('manual chooser keeps choices and cancellation reachable with a long name in a short viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 480 })
  await page.goto('/labels/create')
  const input = page.getByRole('combobox', { name: 'Add a blend' })
  await input.fill('My family blend with a very long name '.repeat(4))
  await input.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport()
  await dialog.getByRole('button', { name: 'Create with AI', exact: true }).focus()
  await expect(dialog.getByRole('button', { name: 'Create with AI', exact: true })).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(input).toBeFocused()
})

for (const width of [1280, 768, 320]) for (const count of [1, 3]) {
  test(`preparation shows ${count} complete design previews at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 1000 })
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/thumbnail')) return route.fulfill({ contentType: 'image/jpeg', body: artwork })
      if (url.pathname.endsWith('/labels')) return route.fulfill({ json: { serving: true, nextCursor: null, labels: Array.from({ length: count }, (_, index) => ({
        id: `design-${index}`, catalogId: url.searchParams.get('catalogId'), maker: 'Cornell & Diehl', blend: 'Autumn Evening',
        edition: index === 0 ? '' : `Alternate edition ${index}`, altText: 'Autumn Evening label with a reading chair and blank date area',
      })) } })
      return route.fulfill({ json: {} })
    })
    await page.goto('/labels/create')
    await page.getByRole('combobox', { name: 'Add a blend' }).fill('Autumn Evening')
    await page.getByRole('option', { name: 'Autumn Evening by Cornell & Diehl', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Choose artwork for Autumn Evening', exact: true })
    const previews = dialog.locator('.preparation-design-preview')
    await expect(previews).toHaveCount(count)
    for (const preview of await previews.all()) {
      await preview.scrollIntoViewIfNeeded()
      await expect(preview.locator('.gallery-thumbnail.gallery-image--loaded')).toBeVisible()
      const bounds = await preview.evaluate(element => {
        const image = element.querySelector('img')!, wrapper = element.querySelector('.gallery-thumbnail')!
        const box = wrapper.getBoundingClientRect(), art = image.getBoundingClientRect()
        return { width: box.width, height: box.height, imageWidth: art.width, imageHeight: art.height, top: art.top - box.top, left: art.left - box.left, fit: getComputedStyle(image).objectFit, loaded: image.naturalWidth > 0 }
      })
      expect(bounds.loaded).toBe(true)
      expect(bounds.fit).toBe('contain')
      expect(bounds.width).toBeGreaterThanOrEqual(72)
      expect(bounds.height).toBeCloseTo(bounds.width, 0)
      expect(bounds.imageWidth).toBeCloseTo(bounds.width, 0)
      expect(bounds.imageHeight).toBeCloseTo(bounds.height, 0)
      expect(bounds.top).toBeCloseTo(0, 0)
      expect(bounds.left).toBeCloseTo(0, 0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    await dialog.screenshot({ path: `test-results/design-choices-${count}-${width}.png` })
    await previews.first().focus()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Use this design', exact: true }).first()).toBeFocused()
    await dialog.getByRole('button', { name: 'Create with AI', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: 'Add a blend' })).toBeFocused()
    const row = page.getByRole('article', { name: 'Autumn Evening', exact: true })
    await expect(row).toContainText('To create with AI')
    await page.getByRole('button', { name: 'Continue to creation', exact: true }).click()
    await expect(page).toHaveURL(/\/labels\/artwork$/)
    await expect(page.getByRole('heading', { name: 'Review your request', exact: true })).toBeVisible()
    await page.getByText('Design notes · optional', { exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Requests for Autumn Evening optional' })).toBeVisible()
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
