import { test, expect, type Page, type APIRequestContext, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { fixture, tobacco } from '../gallery/fixtures'
import { printablePack } from '../accessibility/pack'

const choiceKey = 'tin-to-cellar:usage-choice-v2'
const progressKey = 'tin-to-cellar:local-progress-v2'
const allowed = 'on:00000000-0000-0000-0000-000000000000'
const capabilities = { version: 2, demandEnabled: true, workflowEnabled: true, progressEnabled: true }

async function setup(page: Page, optedIn = true) {
  const pack = await fixture(825)
  const errors: string[] = [], requests: string[] = [], navigations: string[] = [], recovery: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (request.url().includes('/api/analytics/')) requests.push(request.url())
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url())
    if (request.url().includes('/app-version.json')) recovery.push(request.url())
  })
  await page.addInitScript(({ optedIn, choiceKey, allowed }) => {
    if (!localStorage.getItem(choiceKey) && optedIn) localStorage.setItem(choiceKey, allowed)
    window.print = () => { document.body.dataset.printCalls = String(Number(document.body.dataset.printCalls ?? 0) + 1) }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { document.body.dataset.copiedLength = String(text.length) } } })
  }, { optedIn, choiceKey, allowed })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/analytics/v2/config') return route.fulfill({ json: capabilities })
    if (path.startsWith('/api/analytics/')) return route.fulfill({ json: { recorded: true } })
    if (path === '/api/gallery/v1/config') return route.fulfill({ json: { serving: true, intake: false, publication: false } })
    if (path === '/api/gallery/v1/labels' || path === '/api/gallery/v1/browse') return route.fulfill({ json: { serving: true, nextCursor: null, labels: [{ id: pack.draft.submissionId, catalogId: tobacco.id, maker: tobacco.maker, blend: tobacco.blend, altText: 'Synthetic test label', publishedAt: '2026-09-17T00:00:00Z' }] } })
    if (path.endsWith('/thumbnail') || path.endsWith('/artwork')) return route.fulfill({ contentType: 'image/png', body: pack.png })
    if (path.endsWith('/pack')) return route.fulfill({ contentType: 'application/zip', body: pack.zip })
    return route.fulfill({ json: { status: 'collected', sources: [] } })
  })
  return { errors, requests, navigations, recovery }
}

async function blockModules(page: Page, request: APIRequestContext, info: TestInfo, dependency = false, evaluation = false) {
  let blocked = 0
  let paths: string[] = []
  if (info.project.name === 'built') {
    const report = await (await request.get('/usage-boundary.json')).json() as { runtime: string; optional: string[]; initial: string[] }
    expect(report.optional).toContain(report.runtime)
    expect(report.optional.filter(file => report.initial.includes(file))).toEqual([])
    paths = report.optional.map(file => `/${file}`)
  }
  await page.route(url => info.project.name === 'built'
    ? paths.includes(url.pathname)
    : dependency ? url.pathname === '/src/lib/analytics/payloads.ts' : url.pathname.startsWith('/src/lib/analytics/'), route => {
    blocked++
    return evaluation
      ? route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("Synthetic optional module evaluation failure")' })
      : route.abort('blockedbyclient')
  })
  return () => blocked
}

async function importAndPrint(page: Page) {
  await page.getByRole('link', { name: 'Print labels', exact: true }).click()
  const input = page.getByLabel('Label ZIP')
  if (!await input.isVisible()) await page.getByText('Add labels from a ZIP', { exact: true }).click()
  await input.setInputFiles({ name: 'private-local.cellarpack.zip', mimeType: 'application/zip', buffer: await printablePack() })
  await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  const print = page.getByRole('button', { name: /^Print \d+ labels?$/ })
  await expect(print).toBeEnabled()
  await print.click()
  await expect(page.locator('body')).toHaveAttribute('data-print-calls', /[1-9]/)
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download labels', exact: true }).click()
  expect(await (await downloaded).failure()).toBeNull()
}

test('blocked optional module leaves browsing, saved designs, copying, import, export and printing usable', async ({ page, request }, info) => {
  const observed = await setup(page)
  const blocked = await blockModules(page, request, info)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Keep the character of the tin.' })).toBeVisible()
  await expect.poll(blocked).toBeGreaterThan(0)
  await page.getByRole('contentinfo').getByRole('link', { name: 'Gallery', exact: true }).click()
  await page.getByRole('button', { name: 'Add to your labels', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Added to your labels', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Your labels', exact: true }).click()
  const add = page.getByRole('combobox', { name: 'Add a blend' })
  await add.fill('Private test blend')
  await add.press('Enter')
  await page.getByRole('button', { name: 'Create with AI', exact: true }).click()
  await page.getByRole('button', { name: 'Continue to creation', exact: true }).click()
  await page.getByRole('button', { name: 'Continue with 1 label', exact: true }).click()
  await page.getByRole('button', { name: 'Copy instructions for 1 label', exact: true }).click()
  await expect.poll(async () => Number(await page.locator('body').getAttribute('data-copied-length'))).toBeGreaterThan(0)
  await importAndPrint(page)
  expect(observed.requests).toEqual([])
  expect(observed.errors).toEqual([])
  expect(observed.recovery).toEqual([])
  expect(observed.navigations).toHaveLength(1)
})

for (const mode of ['dependency blocked', 'evaluation failed']) test(`${mode} keeps privacy controls and local imports usable`, async ({ page, request }, info) => {
  const observed = await setup(page)
  const blocked = await blockModules(page, request, info, true, mode === 'evaluation failed')
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/privacy')
  await expect.poll(blocked).toBeGreaterThan(0)
  const choice = page.getByRole('checkbox', { name: 'Allow app-action, request-progress, and label-demand counts' })
  await expect(choice).toBeChecked()
  await page.evaluate(key => localStorage.setItem(key, '[]'), progressKey)
  await choice.focus(); await page.keyboard.press('Space')
  await expect(choice).not.toBeChecked()
  expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBeNull()
  expect((await new AxeBuilder({ page }).include('#data-choices').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await choice.check()
  await importAndPrint(page)
  expect(observed.requests).toEqual([])
  expect(observed.errors).toEqual([])
  expect(observed.recovery).toEqual([])
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy and data choices', exact: true }).click()
  await choice.uncheck()
  await page.reload()
  await expect(choice).not.toBeChecked()
})

for (const mode of ['blocked config', 'malformed config', 'blocked POST']) test(`${mode} stops subsequent collection without stopping actions`, async ({ page }) => {
  const observed = await setup(page)
  await page.route('**/api/analytics/**', route => {
    const config = route.request().url().endsWith('/config')
    if (mode === 'malformed config') return route.fulfill({ json: { version: 2, demandEnabled: 'true' } })
    if (mode === 'blocked POST' && config) return route.fulfill({ json: capabilities })
    return route.abort('blockedbyclient')
  })
  await page.goto('/labels/print')
  await expect.poll(() => observed.requests.length).toBe(1)
  await importAndPrint(page)
  const count = observed.requests.length
  expect(count).toBe(mode === 'blocked POST' ? 2 : 1)
  await page.getByRole('link', { name: 'Your labels', exact: true }).click()
  await page.getByRole('link', { name: 'Print labels', exact: true }).click()
  await page.getByRole('button', { name: 'Print 1 label', exact: true }).click()
  const choice = page.getByRole('checkbox', { name: 'Allow app-action, request-progress, and label-demand counts' })
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy and data choices', exact: true }).click()
  await choice.uncheck(); await choice.check()
  expect(observed.requests).toHaveLength(count)
  expect(observed.errors).toEqual([])
})

test('opted-out startup never requests the optional runtime', async ({ page, request }, info) => {
  const observed = await setup(page, false)
  const blocked = await blockModules(page, request, info)
  await page.goto('/labels/print')
  await importAndPrint(page)
  expect(blocked()).toBe(0)
  expect(observed.requests).toEqual([])
  expect(observed.errors).toEqual([])
})
