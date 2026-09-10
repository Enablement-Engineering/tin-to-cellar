import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('typing Earl shows the matching designs before a suggestion is selected', async ({ page }) => {
  const matches = [{ id: 'dunhill-early-morning-pipe', maker: 'Dunhill', blend: 'Early Morning Pipe' }, { id: 'peterson-early-morning-pipe', maker: 'Peterson', blend: 'Early Morning Pipe' }]
  const labels = matches.slice(0, 2).map((entry, index) => ({ ...entry, catalogId: entry.id, id: `label-${index}`, altText: `${entry.maker} ${entry.blend} design` }))
  const queries: string[] = []
  await page.route('**/api/gallery/v1/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/config')) return route.fulfill({ json: { serving: true } })
    if (url.pathname.endsWith('/labels')) {
      const catalog = url.searchParams.get('catalogId') ?? ''
      queries.push(catalog)
      return route.fulfill({ json: { labels: catalog ? labels.filter(label => label.catalogId === catalog) : [...labels, { id: 'other', maker: 'Other', blend: 'Unrelated', altText: 'Other design' }], nextCursor: null } })
    }
    return route.fulfill({ status: 204 })
  })
  await page.goto('/gallery')
  const input = page.getByRole('combobox', { name: 'Maker or blend' })
  await expect(page.getByRole('region', { name: 'Label results' }).getByRole('article')).toHaveCount(3)
  await input.fill('earl')
  await expect(page.getByRole('region', { name: 'Label results' }).getByRole('article')).toHaveCount(2)
  expect(queries.slice(1)).toEqual(expect.arrayContaining(matches.map(entry => entry.id)))
  expect(queries.length - 1).toBe(await page.getByRole('listbox', { name: 'Blend suggestions' }).getByRole('option').count())
  await expect(page.getByRole('heading', { name: 'Other · Unrelated' })).toHaveCount(0)
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('aria-expanded', 'true')
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.getByRole('region', { name: 'Label results' }).getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: `${labels[0].maker} · ${labels[0].blend}`, exact: true })).toBeVisible()
  const count = queries.length
  await input.fill('zzzzzzzzzz')
  await expect(page.getByRole('status').filter({ hasText: 'No labels match your search.' })).toBeVisible()
  expect(queries).toHaveLength(count)
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByRole('region', { name: 'Label results' }).getByRole('article')).toHaveCount(3)
})

for (const width of [1280, 320]) test(`automatic blend filtering preserves focus and announces empty results at ${width}px`, async ({ page }) => {
  const queries: string[] = []
  await page.route('**/api/gallery/v1/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/config')) return route.fulfill({ json: { serving: true } })
    if (url.pathname.endsWith('/labels')) {
      const catalog = url.searchParams.get('catalogId') ?? ''
      queries.push(catalog)
      return route.fulfill({ json: { labels: catalog ? [{ id: 'nightcap', maker: 'Peterson', blend: 'Nightcap', altText: 'A cream label with a blank writing area.' }] : [], nextCursor: null } })
    }
    return route.fulfill({ status: 204 })
  })
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/gallery')
  const input = page.getByRole('combobox', { name: 'Maker or blend' })
  const results = page.getByRole('region', { name: 'Label results' })
  await expect(page.getByRole('status').filter({ hasText: 'No labels match your search.' })).toBeVisible()
  await input.fill('Peterson Nightcap')
  await expect(page.getByRole('region', { name: 'Label results' }).getByRole('article')).toHaveCount(1)
  const typedQueries = queries.length
  await input.press('ArrowDown')
  await expect(input).toBeFocused()
  const active = await input.getAttribute('aria-activedescendant')
  expect(active).toBeTruthy()
  await expect(page.locator(`[id="${active}"]`)).toHaveAttribute('aria-selected', 'true')
  expect(queries).toHaveLength(typedQueries)
  await input.press('Escape')
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  expect(queries).toHaveLength(typedQueries)
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.getByRole('region', { name: 'Label results' }).getByRole('article')).toHaveCount(1)
  await expect(results).toHaveAttribute('aria-busy', 'false')
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await expect(input).not.toHaveAttribute('aria-activedescendant')
  await input.press('Tab')
  await expect(page.getByRole('button', { name: 'Clear search' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('')
  await expect(page.getByRole('status').filter({ hasText: 'No labels match your search.' })).toBeVisible()
  expect(queries).toHaveLength(typedQueries + 2)
  await input.fill('Peterson Nightcap')
  await input.press('ArrowDown')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await input.fill('zzzzzzzzzz')
  await expect(page.getByRole('status').filter({ hasText: 'No matching blends.' })).toBeVisible()
})
