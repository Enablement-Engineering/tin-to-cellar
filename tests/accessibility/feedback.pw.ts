import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import JSZip from 'jszip'
import { printablePack } from './pack'

for (const width of [1280, 320]) {
  test(`compact diagnostics and optional notes are accessible at ${width}px`, async ({ page }) => {
    const sent: Array<{ url: string; body: unknown }> = []
    await page.route('**/api/**', route => { sent.push({ url: route.request().url(), body: route.request().postDataJSON() }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"collected"}' }) })
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
    expect(sent).toHaveLength(2)
    expect(sent[1].body).toHaveProperty('retrospective', notes)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(trigger).toBeFocused()
    await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Make a prompt' }).click()
    await page.getByRole('navigation', { name: 'Workflow' }).getByRole('link', { name: 'Print labels' }).click()
    expect(sent).toHaveLength(2)
  })
}
test('local Worker accepts diagnostics and notes without a ZIP upload', async ({ request }) => {
  const origin = 'http://127.0.0.1:43927'
  const submissionId = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
  const feedback = { format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '0.0.17', request: { labelCount: 1, shape: 'circle' }, outcome: 'failed', steps: [], issues: [] }
  const contribution = { version: 2, submissionId, origin: 'standalone', feedback, sources: [], validation: null }
  const first = await request.post('/api/labels/contributions', { headers: { Origin: origin }, data: contribution })
  expect(first.status()).toBe(200)
  expect(await first.json()).toEqual({ status: 'collected' })
  const repeated = await request.post('/api/labels/contributions', { headers: { Origin: origin }, data: contribution })
  expect(await repeated.json()).toEqual({ status: 'duplicate' })
  const retrospective = { format: 'tin-to-cellar/retrospective', schemaVersion: '0.1.0', protocolRevision: '0.0.17', capabilities: {}, tools: [], observations: [{ stage: 'generation', kind: 'friction', explanation: 'No image generator was available in this fixture run.' }] }
  const notes = await request.post('/api/labels/process-notes', { headers: { Origin: origin }, data: { submissionId, retrospective } })
  expect(notes.status()).toBe(200)
  expect(await notes.json()).toEqual({ status: 'collected' })
  expect((await request.get('/api/labels/diagnostics')).status()).toBe(403)
})
