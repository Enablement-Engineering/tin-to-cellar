import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'

const artwork = readFileSync(new URL('../../public/examples/ten-blends/cornell-diehl-autumn-evening.jpg', import.meta.url))

for (const width of [1280, 768, 320]) for (const count of [1, 3]) {
  test(`preparation shows ${count} complete design previews at ${width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width, height: 1000 })
    await page.route('**/api/**', route => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/thumbnail')) return route.fulfill({ contentType: 'image/jpeg', body: artwork })
      if (url.pathname.endsWith('/labels')) return route.fulfill({ json: { serving: true, nextCursor: null, labels: Array.from({ length: count }, (_, index) => ({
        id: `design-${index}`, catalogId: url.searchParams.get('catalogId'), maker: 'Cornell & Diehl', blend: 'Autumn Evening',
        edition: index === 0 ? '' : `Alternate edition ${index}`, description: 'Autumn Evening label with a reading chair and blank date area',
      })) } })
      return route.fulfill({ json: {} })
    })
    await page.goto('/labels/create')
    await page.getByRole('combobox', { name: 'Add a blend' }).fill('Autumn Evening')
    await page.getByRole('option', { name: 'Autumn Evening by Cornell & Diehl', exact: true }).click()
    const row = page.getByRole('article', { name: 'Autumn Evening', exact: true })
    const previews = row.locator('.preparation-design-preview')
    await expect(previews).toHaveCount(count)
    for (const preview of await previews.all()) {
      await preview.scrollIntoViewIfNeeded()
      await expect(preview.locator('.gallery-thumbnail--loaded')).toBeVisible()
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
    await row.screenshot({ path: `test-results/design-choices-${count}-${width}.png` })
    await previews.first().focus()
    await page.keyboard.press('Tab')
    await expect(row.getByRole('button', { name: 'Use this design', exact: true }).first()).toBeFocused()
    await row.getByRole('button', { name: 'Create my own', exact: true }).click()
    await expect(row.getByRole('textbox', { name: 'Requests for Autumn Evening optional' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
