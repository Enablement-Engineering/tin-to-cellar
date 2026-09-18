import { expect, test, type Page } from '@playwright/test'
import { ProductionServer } from './production-server'

const server = new ProductionServer()
test.beforeAll(async () => { test.setTimeout(180000); await server.start() })
test.afterAll(async () => { await server.close() })
test.beforeEach(() => server.reset())

function countDocuments(page: Page) {
  const documents: string[] = []
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(request.url()) })
  return documents
}

async function openLabels(page: Page) {
  await page.goto(`${server.origin}/labels`)
  await expect(page.getByRole('navigation', { name: 'Workflow' })).toBeVisible()
}

async function openHelp(page: Page) {
  await page.getByRole('link', { name: 'How it works', exact: true }).click()
}

async function expectSettledWithoutReload(page: Page, documents: string[], expected = 1) {
  await expect.poll(() => server.requests.filter(item => item.path === '/app-version.json').length).toBeGreaterThan(0)
  // Observe beyond the version check and scheduled refresh rather than asserting
  // absence immediately before the recovery promise has had a chance to resolve.
  await page.waitForTimeout(1200)
  expect(documents).toHaveLength(expected)
}

async function readRecoveryCheckpoints(page: Page) {
  return page.evaluate(async () => {
    const entries = await new Promise<Array<{ name: string; blob: Blob }>>((resolve, reject) => {
      const request = indexedDB.open('tin-to-cellar-app-recovery', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const read = database.transaction('files', 'readonly').objectStore('files').getAll()
        read.onerror = () => { database.close(); reject(read.error) }
        read.onsuccess = () => { database.close(); resolve(read.result) }
      }
    })
    return Promise.all(entries.map(async entry => ({ name: entry.name, bytes: Array.from(new Uint8Array(await entry.blob.arrayBuffer())) })))
  })
}

test('an old tab refreshes once into the new release and restores its route, focus, and saved labels', async ({ page }) => {
  const documents = countDocuments(page)
  await openLabels(page)
  await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Your labels' }).click()
  await page.getByRole('combobox', { name: 'Add a blend' }).fill('Recovery saved blend')
  await page.getByRole('button', { name: 'Add blend', exact: true }).click()
  await page.getByRole('button', { name: 'Create with AI', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Recovery saved blend', exact: true })).toBeVisible()
  server.current = 'B'
  await openHelp(page)
  await expect(page.getByRole('link', { name: 'Download instructions' })).toBeVisible()
  await expect(page).toHaveURL(`${server.origin}/labels/help`)
  await expect(page.getByRole('main')).toBeFocused()
  expect(documents).toHaveLength(2)
  expect(server.requests.some(item => /\/assets\/prompt-.*\.js$/.test(item.path) && item.status === 404)).toBe(true)
  expect(server.requests.some(item => /\/assets\/prompt-.*\.js$/.test(item.path) && item.status === 200 && item.build === 'B')).toBe(true)
  await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Your labels' }).click()
  await expect(page.getByRole('heading', { name: 'Recovery saved blend', exact: true })).toBeVisible()
})

test('retained old lazy assets let an old tab continue across a deployment without refreshing', async ({ page }) => {
  const documents = countDocuments(page)
  await openLabels(page)
  server.current = 'B'
  server.retainPrevious = true
  await openHelp(page)
  await expect(page.getByRole('link', { name: 'Download instructions' })).toBeVisible()
  expect(documents).toHaveLength(1)
  expect(server.requests.some(item => /\/assets\/prompt-.*\.js$/.test(item.path) && item.status === 200 && item.build === 'A')).toBe(true)
  expect(server.requests.filter(item => item.status === 404 && item.path.startsWith('/assets/'))).toEqual([])
})

test('a same-build module failure does not automatically refresh', async ({ page }) => {
  const documents = countDocuments(page)
  await openLabels(page)
  server.failPrompt = true
  await openHelp(page)
  await expectSettledWithoutReload(page, documents)
  await expect(page.getByRole('link', { name: 'Download instructions' })).not.toBeVisible()
})

test('an unavailable version endpoint does not turn a network failure into a refresh', async ({ page }) => {
  const documents = countDocuments(page)
  await openLabels(page)
  server.failPrompt = true
  server.versionUnavailable = true
  await openHelp(page)
  await expectSettledWithoutReload(page, documents)
  expect(server.requests.some(item => item.path === '/app-version.json' && item.status === 503)).toBe(true)
})

test('another failed release immediately after recovery cannot cause a reload loop', async ({ page }) => {
  const documents = countDocuments(page)
  await openLabels(page)
  server.current = 'B'
  server.failPrompt = true
  server.advertiseNextAfterReload = true
  await openHelp(page)
  await expect.poll(() => documents.length).toBe(2)
  await expect.poll(() => server.requests.filter(item => item.path === '/app-version.json').length).toBeGreaterThanOrEqual(2)
  await page.waitForTimeout(1200)
  expect(documents).toHaveLength(2)
  await expect(page.getByRole('link', { name: 'Download instructions' })).not.toBeVisible()
})

test('a module failure during printing keeps the current document open', async ({ page }) => {
  const documents = countDocuments(page)
  await openLabels(page)
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  server.current = 'B'
  await openHelp(page)
  await expectSettledWithoutReload(page, documents)
})

test('a delayed update check cannot refresh away a draft started on another screen', async ({ page }) => {
  const documents = countDocuments(page)
  await openLabels(page)
  server.current = 'B'
  server.holdVersion = true
  await openHelp(page)
  await expect.poll(() => server.versionRequests).toBe(1)
  await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Your labels' }).click()
  const draft = page.getByRole('combobox', { name: 'Add a blend' })
  await draft.fill('Unfinished recovery draft')
  server.releaseVersion()
  await expectSettledWithoutReload(page, documents)
  await expect(draft).toHaveValue('Unfinished recovery draft')
  await expect(page.getByRole('region', { name: 'App recovery' }).getByRole('button', { name: 'Reload app', exact: true })).toBeDisabled()
})

test('a failed ZIP reader preserves the selected bytes across refresh and waits for explicit resume before parsing', async ({ page }) => {
  const documents = countDocuments(page)
  const posts: string[] = []
  page.on('request', request => { if (request.method() === 'POST') posts.push(request.url()) })
  await page.goto(`${server.origin}/labels/print`)
  const input = page.getByLabel('Label ZIP', { exact: true })
  await expect(input).toBeEnabled()
  server.current = 'B'
  const bytes = Buffer.from('invalid ZIP bytes')
  await input.setInputFiles({ name: 'selected-before-update.cellarpack.zip', mimeType: 'application/zip', buffer: bytes })
  await expect.poll(() => documents.length).toBe(2)
  const recovery = page.getByRole('region', { name: 'Selected ZIP recovery' })
  await expect(recovery).toContainText('selected-before-update.cellarpack.zip')
  await expect(recovery.getByRole('button', { name: 'Resume ZIP review' })).toBeEnabled()
  expect(await readRecoveryCheckpoints(page)).toEqual([{ name: 'selected-before-update.cellarpack.zip', bytes: [...bytes] }])
  await page.waitForTimeout(1200)
  expect(documents).toHaveLength(2)
  expect(posts).toEqual([])
  await expect(page.locator('.import-report')).not.toBeVisible()

  // Observe storage at the actual parser download boundary, not merely after
  // parsing succeeds: the checkpoint must already be consumed if parsing fails.
  const checkpointsAtParserDownload: Awaited<ReturnType<typeof readRecoveryCheckpoints>>[] = []
  await page.route('**/assets/*.js', async route => {
    checkpointsAtParserDownload.push(await readRecoveryCheckpoints(page))
    await route.continue()
  })
  await recovery.getByRole('button', { name: 'Resume ZIP review' }).click()
  await expect(page.locator('.import-report').first()).toContainText('The file is not a well-formed standard ZIP archive.')
  await expect(recovery).not.toBeVisible()
  expect(checkpointsAtParserDownload.length).toBeGreaterThan(0)
  expect(checkpointsAtParserDownload.every(entries => entries.length === 0)).toBe(true)
  expect(await readRecoveryCheckpoints(page)).toEqual([])
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Print labels', exact: true })).toBeVisible()
  await expect(recovery).not.toBeVisible()
})

test('failed temporary ZIP storage blocks refresh until the user dismisses the selected file', async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.transaction.db.name === 'tin-to-cellar-app-recovery') throw new DOMException('Recovery test storage quota', 'QuotaExceededError')
      return key === undefined ? put.call(this, value) : put.call(this, value, key)
    }
  })
  const documents = countDocuments(page)
  await page.goto(`${server.origin}/labels/print`)
  const input = page.getByLabel('Label ZIP', { exact: true })
  await expect(input).toBeEnabled()
  server.current = 'B'
  await input.setInputFiles({ name: 'not-yet-preserved.cellarpack.zip', mimeType: 'application/zip', buffer: Buffer.from('invalid ZIP bytes') })
  const recovery = page.getByRole('region', { name: 'Selected ZIP recovery' })
  await expect(recovery).toContainText('The ZIP could not be kept for the update.')
  await expectSettledWithoutReload(page, documents)
  await expect(page.getByRole('region', { name: 'App recovery' }).getByRole('button', { name: 'Reload app', exact: true })).toBeDisabled()
  expect(await readRecoveryCheckpoints(page)).toEqual([])
  await recovery.getByRole('button', { name: 'Dismiss selected ZIP' }).click()
  await expect.poll(() => documents.length).toBe(2)
  await expect(page.getByRole('heading', { name: 'Print labels', exact: true })).toBeVisible()
  await expect(recovery).not.toBeVisible()
})
