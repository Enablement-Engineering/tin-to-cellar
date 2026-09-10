import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'

const labels = [
  { id: 'golden', maker: 'Orlik', blend: 'Golden Sliced', altText: 'Red and gold circular label with a portrait and a cream writing area.' },
  { id: 'autumn', maker: 'Cornell & Diehl', blend: 'Autumn Evening', altText: 'An armchair and lamp against a dark blue background, with a cream writing area.' },
  { id: 'long', maker: 'A maker with a longer name', blend: 'A longer blend name that needs several lines', altText: 'Red and gold label artwork.' },
]
for (const [width, largeText] of [[1280, false], [320, false], [640, true]] as const) test(`browse cards at ${width}px with large text ${largeText}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/gallery/v1/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/config')) return route.fulfill({ json: { serving: true, intake: false } })
    if (path.endsWith('/labels')) return route.fulfill({ json: { labels, nextCursor: null } })
    const file = path.includes('autumn') ? 'cornell-diehl-autumn-evening.jpg' : 'orlik-golden-sliced.jpg'
    return route.fulfill({ contentType: 'image/jpeg', body: readFileSync(`public/examples/ten-blends/${file}`) })
  })
  await page.goto('/gallery')
  if (largeText) await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  const card = page.getByRole('article', { name: 'Golden Sliced Orlik', exact: true })
  await expect(card.getByRole('heading', { level: 2, name: 'Golden Sliced', exact: true })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Add to your labels', exact: true })).toHaveAccessibleDescription('Golden Sliced Orlik')
  await expect(page.getByText('About this design')).toHaveCount(0)
  const orderedCards = page.getByRole('region', { name: 'Label results' }).getByRole('article')
  await orderedCards.first().getByRole('link').focus()
  await expect(orderedCards.first().getByRole('link')).toHaveCSS('outline-style', 'solid')
  await page.keyboard.press('Tab')
  await expect(orderedCards.first().getByRole('button')).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(orderedCards.nth(1).getByRole('link')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  for (const button of await page.locator('.gallery-card button').all()) {
    const bounds = await button.boundingBox()
    expect(bounds!.height).toBeGreaterThanOrEqual(44)
  }
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('browse-cards.png'), fullPage: true })
})
