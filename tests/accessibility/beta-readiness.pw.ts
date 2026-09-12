import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import JSZip from 'jszip'
import { printablePack } from './pack'

test('records static request counts for the deferred routing change', async ({ page }, testInfo) => {
  let requests: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.origin === new URL(testInfo.project.use.baseURL!).origin && (request.resourceType() === 'document' || /\.(?:js|mjs|css)$/.test(url.pathname))) requests.push(url.pathname)
  })
  await page.goto('/labels')
  await page.waitForLoadState('networkidle')
  const cold = [...requests]; requests = []
  await page.reload()
  await page.waitForLoadState('networkidle')
  const result = { cold: { count: cold.length, paths: cold }, warm: { count: requests.length, paths: requests }, note: 'Browser request counts on local Worker-first delivery; not Cloudflare invoice savings.' }
  await testInfo.attach('static-request-counts', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
  console.log(JSON.stringify(result))
  expect(cold.length).toBeGreaterThan(0)
})

test('gallery pagination waits for keyboard activation and preserves retry', async ({ page }) => {
  let lists = 0
  await page.route('**/api/gallery/v1/**', route => {
    if (route.request().url().endsWith('/config')) return route.fulfill({ json: { serving: true, intake: false } })
    if (!new URL(route.request().url()).pathname.endsWith('/labels')) return route.fulfill({ status: 404 })
    lists++
    if (lists === 2) return route.fulfill({ status: 503, json: { error: 'storage_unavailable' } })
    return route.fulfill({ json: { labels: lists === 1 ? [{ id: 'design-one', catalogId: 'peterson-nightcap', maker: 'Peterson', blend: 'Nightcap', altText: 'Synthetic test design.', artworkProfileId: 'circle-2.5@1', publishedAt: '2026-09-12' }] : [], nextCursor: lists === 1 ? 'design-one' : null } })
  })
  await page.goto('/gallery')
  const more = page.getByRole('button', { name: 'Show more labels' })
  await expect(more).toBeVisible()
  await more.scrollIntoViewIfNeeded()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(lists).toBe(1)
  await more.focus()
  await page.keyboard.press('Enter')
  const retry = page.getByRole('button', { name: 'Retry loading labels' })
  await expect(retry).toBeVisible()
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect(retry).toHaveCount(0)
  expect(lists).toBe(3)
})

test('editorial pages and demand opt-out remain readable and keyboard accessible at 320px', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [path, heading] of [['/about', 'Behind the labels'], ['/labels/help', 'What happens behind the scenes'], ['/privacy', 'Aggregate label demand']]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  }
  const preference = page.getByRole('checkbox', { name: 'Allow aggregate label-demand counts' })
  await preference.focus()
  await expect(preference).toBeFocused()
  await page.keyboard.press('Space')
  await expect(preference).not.toBeChecked()
  await page.screenshot({ path: testInfo.outputPath('privacy-opt-out.png'), fullPage: true })
})

test('canonical print intent is best effort, opt-out is silent and loaded printing survives offline', async ({ page, context }) => {
  const events: unknown[] = []
  await page.route('**/api/analytics/v1/config', route => route.fulfill({ json: { enabled: true } }))
  await page.route('**/api/analytics/v1/print-intent', route => {
    events.push(route.request().postDataJSON())
    return route.fulfill({ status: 429, json: { error: 'rate_limited' } })
  })
  await page.route('**/api/gallery/v1/config', route => route.fulfill({ json: { serving: false, intake: false } }))
  const zip = await JSZip.loadAsync(await printablePack())
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
  manifest.labels[0].maker = 'Peterson'; manifest.labels[0].blend = 'Nightcap'
  zip.file('manifest.json', JSON.stringify(manifest))
  await page.goto('/labels/print')
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'test.cellarpack.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
  await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Print 1 label', exact: true })).toBeEnabled()
  expect(events).toEqual([])
  await page.getByRole('link', { name: 'Your labels', exact: true }).click()
  await page.getByRole('link', { name: 'Print labels', exact: true }).click()
  await expect.poll(() => events.length).toBe(1)
  expect(events[0]).toEqual({ event: 'selected-for-print', labels: [{ catalogId: 'peterson-nightcap', quantity: 1 }] })
  await page.getByRole('spinbutton', { name: 'Quantity for Nightcap' }).fill('3')
  const print = page.getByRole('button', { name: 'Print 3 labels', exact: true })
  await expect(print).toBeEnabled()
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.testPrints = String(Number(document.documentElement.dataset.testPrints ?? 0) + 1) } })
  await print.click()
  await expect.poll(() => events.length).toBe(2)
  expect(events[1]).toEqual({ event: 'print-job-requested', labels: [{ catalogId: 'peterson-nightcap', quantity: 3 }] })
  await expect(page.locator('html')).toHaveAttribute('data-test-prints', '1')
  await page.getByRole('link', { name: 'Privacy', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Allow aggregate label-demand counts' }).uncheck()
  await page.getByRole('link', { name: 'Print labels', exact: true }).click()
  await context.setOffline(true)
  await print.click()
  await expect(page.locator('html')).toHaveAttribute('data-test-prints', '2')
  expect(events).toHaveLength(2)
  await context.setOffline(false)
})
