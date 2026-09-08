import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import JSZip from 'jszip'
import { printablePack } from './pack'

for (const width of [1280, 320]) {
  test(`compact diagnostics and optional notes are accessible at ${width}px`, async ({ page }) => {
    const sent: Array<{ url: string; body: unknown }> = []
    await page.route('**/api/**', route => {
      if (new URL(route.request().url()).pathname === '/api/gallery/v1/config') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ intake: false, serving: false, noticeVersion: '2026-09-06-v1', turnstileSiteKey: '' }) })
      if (route.request().method() === 'POST') sent.push({ url: route.request().url(), body: route.request().postDataJSON() })
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"collected","notesAllowed":true}' })
    })
    await page.route('https://**/*', route => route.abort())
    const zip = await JSZip.loadAsync(await printablePack())
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    const report = { format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '0.0.17', request: { labelCount: 1, shape: 'circle' }, outcome: 'complete', steps: [{ stage: 'proof', status: 'passed', attempts: 2 }], issues: [{ code: 'geometry', stage: 'proof', resolved: true }] }
    const notes = { format: 'tin-to-cellar/retrospective', schemaVersion: '0.1.0', protocolRevision: '0.0.17', capabilities: { 'local-execution': 'available' }, tools: [{ id: 'local-proof', version: 'unknown' }], observations: [{ stage: 'proof', kind: 'helped', explanation: 'The supplied proof program produced an inspectable layout.' }] }
    manifest.extensions = { ...manifest.extensions, 'tin-to-cellar:protocol': { revision: '0.0.17', cellarpackVersion: '0.1.0', feedbackVersion: '0.2.0' }, 'tin-to-cellar:feedback': report, 'tin-to-cellar:retrospective': notes }
    zip.file('manifest.json', JSON.stringify(manifest))
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/labels/print')
    await page.getByLabel('Label ZIP').setInputFiles({ name: 'feedback.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
    await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Your labels' })).toBeVisible()
    await expect(page.getByText('AI run details')).toHaveCount(0)
    await expect(page.getByText('Open and compare saved reports')).toHaveCount(0)
    const trigger = page.getByRole('button', { name: 'View shared diagnostics' })
    await trigger.focus(); await trigger.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Shared diagnostics' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Receipt confirmed')
    expect(sent).toHaveLength(1)
    expect(sent[0].body).not.toHaveProperty('retrospective')
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/diagnostics-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Share process notes' }).click()
    await expect(page.getByRole('button', { name: 'Process notes shared' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused()
    expect(sent).toHaveLength(2)
    expect(sent[1].body).toHaveProperty('retrospective', notes)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(trigger).toBeFocused()
    await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Your labels', exact: true }).click()
    await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Print labels' }).click()
    expect(sent).toHaveLength(2)
  })
}

test('paused standalone diagnostics preserve keyboard focus and do not retry automatically', async ({ page }) => {
  let submissions = 0
  await page.route('**/api/**', route => {
    if (new URL(route.request().url()).pathname === '/api/labels/contributions') {
      submissions++
      return route.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '86400' }, body: JSON.stringify({ code: 'collection_paused', resetAt: new Date(Date.now() + 86400000).toISOString() }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ intake: false, serving: false, noticeVersion: '2026-09-06-v1', turnstileSiteKey: '' }) })
  })
  await page.route('https://**/*', route => route.abort())
  await page.goto('/labels/help')
  await page.getByText('Report a failed AI run', { exact: true }).click()
  const report = { format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '0.0.17', request: { labelCount: 1, shape: 'circle' }, outcome: 'failed', steps: [], issues: [] }
  await page.getByLabel('Open failure report').setInputFiles({ name: 'failure.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(report)) })
  const share = page.getByRole('button', { name: 'Share failure report' })
  await share.focus()
  await share.press('Enter')
  const receipt = page.getByRole('button', { name: 'View prepared diagnostics' })
  await expect(receipt).toBeFocused()
  await expect(page.getByRole('button', { name: 'Retry contribution' })).toBeDisabled()
  await expect(page.getByText('Diagnostic sharing is paused.', { exact: false })).toContainText('Your labels remain available locally, including printing.')
  await receipt.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Prepared diagnostics' })
  await expect(dialog).toContainText('Collection is paused; receipt has not been confirmed.')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(receipt).toBeFocused()
  expect(submissions).toBe(1)
})

test('local Worker accepts diagnostics and notes without a ZIP upload', async ({ request }) => {
  const origin = 'http://127.0.0.1:43927'
  const submissionId = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
  const capability = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
  const ownerHeaders = { Origin: origin, 'X-Diagnostic-Capability': capability }
  const feedback = { format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '0.0.17', request: { labelCount: 1, shape: 'circle' }, outcome: 'failed', steps: [], issues: [] }
  const contribution = { version: 2, submissionId, origin: 'standalone', feedback, sources: [], validation: null }
  const first = await request.post('/api/labels/contributions', { headers: ownerHeaders, data: contribution })
  expect(first.status()).toBe(200)
  expect(await first.json()).toEqual({ status: 'collected', notesAllowed: true })
  const repeated = await request.post('/api/labels/contributions', { headers: ownerHeaders, data: contribution })
  expect(await repeated.json()).toEqual({ status: 'duplicate', notesAllowed: true })
  const retrospective = { format: 'tin-to-cellar/retrospective', schemaVersion: '0.1.0', protocolRevision: '0.0.17', capabilities: {}, tools: [], observations: [{ stage: 'generation', kind: 'friction', explanation: 'No image generator was available in this fixture run.' }] }
  // A distinct synthetic IP keeps this unauthorized request out of the owner's
  // three-request local rate allowance. These fixtures only run against localhost.
  const intruder = await request.post('/api/labels/process-notes', { headers: { Origin: origin, 'X-Diagnostic-Capability': 'b'.repeat(64), 'CF-Connecting-IP': '198.51.100.22' }, data: { submissionId, retrospective } })
  expect(intruder.status()).toBe(403)
  expect(await intruder.json()).toMatchObject({ code: 'notes_unauthorized' })
  const notes = await request.post('/api/labels/process-notes', { headers: ownerHeaders, data: { submissionId, retrospective } })
  expect(notes.status()).toBe(200)
  expect(await notes.json()).toEqual({ status: 'collected' })
  expect((await request.get('/api/labels/diagnostics')).status()).toBe(403)
})
