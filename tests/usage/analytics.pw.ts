import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { printablePack } from '../accessibility/pack'
import { fixture, tobacco } from '../gallery/fixtures'
const summary = {
  from: '2026-08-18', through: '2026-09-16', cohortFrom: '2026-08-17', admissionBlockedNow: false, refreshedAt: '2026-09-16T12:00:00Z', allowance: 1000,
  capabilities: { version: 2, demandEnabled: false, workflowEnabled: false, progressEnabled: false, webTrafficEnabled: false },
  events: [{ period_start: '2026-09-16', event: 'instructions-copy-result', outcome: 'copied', count: 12 }],
  progress: [{ cohort: '2026-09-14', milestone: 'started', elapsed: 'same-day', count: 12 }, { cohort: '2026-09-14', milestone: 'imported', elapsed: 'same-day', count: 5 }],
  collection: [{ period_start: '2026-09-16', admitted: 29, recorded: 27, allowance: 1000, allowance_reached: 0 }], cleanup: null,
}
for (const width of [1280,320]) test(`Usage report is accessible without mounting review at ${width}px`, async ({ page, request }) => {
  const shell = await (await request.get('/')).text(), reviewRequests: string[] = [], external: string[] = []
  await page.route('https://**/*', route => { external.push(route.request().url()); return route.abort() })
  await page.route('https://admin-staging.tintocellar.com/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/usage') return route.fulfill({ status: 200, contentType: 'text/html', body: shell })
    if (url.pathname.startsWith('/api/gallery/')) reviewRequests.push(url.pathname)
    if (url.pathname.startsWith('/api/analytics/v2/admin/')) return route.fulfill({ json: url.pathname.endsWith('/summary') ? summary : { blends: [{ catalog_id: 'example', maker: 'Example maker', blend: 'Example blend', added: 9, selected: 6, jobs: 3, quantity: 18, artwork: 1 }], hasMore: false, nextCursor: null, serving: true, refreshedAt: summary.refreshedAt } })
    return route.fulfill({ response: await request.get(`${url.pathname}${url.search}`) })
  })
  await page.setViewportSize({ width, height: 900 })
  await page.goto('https://admin-staging.tintocellar.com/usage')
  await expect(page.getByRole('heading', { name: 'Locally matched request progress' })).toBeVisible()
  await expect(page.getByText('Example maker — Example blend')).toBeVisible()
  for (const label of ['Admissions and successful recording','Elapsed-time buckets','Daily activity table']) await page.getByText(label, { exact: true }).click()
  expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/usage-${width}.png`, fullPage: true })
  expect(reviewRequests).toEqual([]); expect(external).toEqual([])
  await page.route('**/api/analytics/v2/admin/summary*', route => route.fulfill({ status: 503, json: { error: 'reports_unavailable' } }))
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Usage reports are unavailable. No counts have been substituted.')
  await expect(page.getByText('0 received events in this period.')).toHaveCount(0)
})
test('local D1 accepts only v2 aggregates and denies public report reads', async ({ request }) => {
  expect(await (await request.get('/api/analytics/v1/config')).json()).toEqual({ enabled: false })
  expect(await (await request.get('/api/analytics/v2/config')).json()).toMatchObject({ version: 2, workflowEnabled: true, progressEnabled: true })
  const headers = { Origin: 'http://127.0.0.1:43931' }
  const data = { version: 2, event: 'print-requested', outcome: 'requested' }
  expect(await (await request.post('/api/analytics/v2/events', { headers, data })).json()).toEqual({ recorded: true })
  expect((await request.post('/api/analytics/v2/events', { headers, data: { ...data, requestId: 'must-be-rejected' } })).status()).toBe(400)
  expect((await request.post('/api/analytics/v1/print-intent', { headers, data })).status()).toBe(204)
  expect((await request.get('/api/analytics/v2/admin/summary')).status()).toBe(404)
})
test('privacy choice defaults off and clears local progress on opt-out', async ({ page }) => {
  const analytics: string[] = []
  page.on('request', request => { if (request.url().includes('/api/analytics/')) analytics.push(request.url()) })
  await page.goto('/')
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy and data choices', exact: true }).click()
  const choice = page.getByRole('checkbox', { name: 'Allow app-action, request-progress, and label-demand counts' })
  await expect(choice).not.toBeChecked()
  expect(analytics).toEqual([])
  await choice.check()
  await expect.poll(() => analytics.filter(url => url.endsWith('/v2/config')).length).toBe(1)
  await page.evaluate(() => localStorage.setItem('tin-to-cellar:local-progress-v2','[]'))
  await choice.uncheck()
  expect(await page.evaluate(() => localStorage.getItem('tin-to-cellar:local-progress-v2'))).toBeNull()
  expect(analytics.filter(url => !url.endsWith('/config'))).toEqual([])
})
test('opted-in local import and print produce bounded events without file details', async ({ page }) => {
  const events: Record<string, unknown>[] = []
  page.on('request', request => { if (request.url().endsWith('/api/analytics/v2/events')) events.push(request.postDataJSON()) })
  await page.addInitScript(() => { window.print = () => undefined })
  await page.goto('/privacy')
  await page.getByRole('checkbox', { name: 'Allow app-action, request-progress, and label-demand counts' }).check()
  await page.getByRole('link', { name: 'Print labels', exact: true }).click()
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'PRIVATE_filename.cellarpack.zip', mimeType: 'application/zip', buffer: await printablePack() })
  const add = page.getByRole('button', { name: /^Add \d+ labels?$/ })
  await add.click()
  await expect(page.getByRole('button', { name: 'Print 1 label', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Print 1 label', exact: true }).click()
  await expect.poll(() => events.map(e => e.event)).toEqual(expect.arrayContaining(['pack-check-result','pack-import-applied','print-requested']))
  expect(JSON.stringify(events)).not.toContain('PRIVATE_')
  expect(JSON.stringify(events)).not.toContain('Fixture')
  for (const event of events) expect(Object.keys(event).sort()).toEqual(['event','outcome','version'])
})
test('matches copied instructions, returned artwork, and printing entirely on the device', async ({ page }) => {
  const progress: Record<string, unknown>[] = []
  page.on('request', request => { if (request.url().endsWith('/api/analytics/v2/progress')) progress.push(request.postDataJSON()) })
  await page.addInitScript(() => {
    window.print = () => undefined
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => undefined }, configurable: true })
  })
  await page.goto('/privacy')
  const config = page.waitForResponse('**/api/analytics/v2/config')
  await page.getByRole('checkbox', { name: 'Allow app-action, request-progress, and label-demand counts' }).check()
  await config
  await page.getByRole('link', { name: 'Your labels', exact: true }).click()
  const input = page.getByRole('combobox', { name: 'Add a blend' })
  await input.fill(`${tobacco.maker} ${tobacco.blend}`)
  await input.press('ArrowDown'); await input.press('Enter')
  await page.getByRole('button', { name: 'Create with AI', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to creation', exact: true }).click()
  await page.getByRole('button', { name: 'Continue with 1 label', exact: true }).click()
  await page.getByRole('button', { name: 'Copy instructions for 1 label', exact: true }).click()
  await expect.poll(() => progress.map(e => e.milestone)).toEqual(['started'])
  // The receipt must return before a later matching action is eligible.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tin-to-cellar:local-progress-v2') ?? '[]')[0]?.startRecorded)).toBe(true)
  await page.getByRole('link', { name: 'Print labels', exact: true }).click()
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'PRIVATE_returned.cellarpack.zip', mimeType: 'application/zip', buffer: (await fixture()).zip })
  await expect(page.getByRole('checkbox', { name: 'Use this design for the requested blend' })).toBeChecked()
  expect(progress.map(e => e.milestone)).toEqual(['started'])
  await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  await expect.poll(() => progress.map(e => e.milestone)).toEqual(['started','imported'])
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tin-to-cellar:local-progress-v2') ?? '[]')[0]?.importRecorded)).toBe(true)
  await page.getByRole('button', { name: 'Print 1 label', exact: true }).click()
  await expect.poll(() => progress.map(e => e.milestone)).toEqual(['started','imported','print-requested'])
  for (const event of progress) expect(Object.keys(event).sort()).toEqual(['cohort','elapsed','milestone','version'])
  expect(JSON.stringify(progress)).not.toContain(tobacco.id)
  expect(JSON.stringify(progress)).not.toContain('PRIVATE_')
})
