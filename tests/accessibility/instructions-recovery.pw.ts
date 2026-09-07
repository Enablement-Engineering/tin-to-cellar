import { expect, test } from '@playwright/test'

test('instruction download failure recovers after deliberate reload without losing saved labels or focus', async ({ page }) => {
  await page.route('**/api/gallery/v1/config', route => route.fulfill({ json: { intake: false, serving: false } }))
  let fail = true
  let attempts = 0
  await page.route('**/assets/prompt-*.js', route => {
    attempts++
    return fail ? route.abort('failed') : route.continue()
  })
  await page.goto('/labels')
  await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Choose labels' }).click()
  await page.getByRole('combobox', { name: 'Add a blend' }).fill('My saved blend')
  await page.getByRole('button', { name: 'Add blend', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My saved blend' })).toBeVisible()
  await page.getByRole('link', { name: 'How it works', exact: true }).click()
  const retry = page.getByRole('button', { name: 'Reload instructions' })
  await expect(retry).toBeVisible()
  fail = false
  await retry.focus()
  await retry.press('Enter')
  await expect(page.getByRole('link', { name: 'Download instructions' })).toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
  expect(attempts).toBeGreaterThan(1)
  await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Choose labels' }).click()
  await expect(page.getByRole('heading', { name: 'My saved blend' })).toBeVisible()
})
