import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
import AxeBuilder from '@axe-core/playwright'
import { printablePack } from './pack'

test('partial imports report each failure once and rejected replacements preserve saved printing', async ({ page }) => {
  const reports: Array<{ validation: { issues: Array<{ code: string; count: number }> } }> = []
  const externalRequests: string[] = []
  await page.route('**/api/labels/contributions', route => {
    reports.push(route.request().postDataJSON())
    return route.fulfill({ json: { status: 'collected' } })
  })
  await page.route('**/api/gallery/v1/config', route => route.fulfill({ json: { intake: false, serving: false } }))
  await page.route('https://**/*', route => { externalRequests.push(route.request().url()); return route.abort() })
  const zip = await JSZip.loadAsync(await printablePack())
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
  const missing = structuredClone(manifest.labels[0])
  missing.id = 'missing-label'
  missing.blend = 'Missing artwork'
  missing.artworkAssetId = 'undeclared-artwork'
  manifest.labels.push(missing)
  zip.file('manifest.json', JSON.stringify(manifest))
  await page.goto('/labels/print')
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'partial.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
  await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your labels', exact: true })).toBeVisible()
  await expect.poll(() => reports.length).toBe(1)
  const problem = page.getByRole('complementary', { name: 'Import needs attention' })
  await expect(problem).toContainText('1 label was excluded from your last ZIP import.')
  await expect(problem.getByRole('button', { name: 'Copy repair request' })).toBeHidden()
  await problem.getByText('View details', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(problem.getByRole('button', { name: 'Copy repair request' })).toBeVisible()
  expect(reports[0].validation.issues.filter(issue => issue.code === 'MISSING_ARTWORK')).toEqual([{ code: 'MISSING_ARTWORK', count: 1 }])
  await page.getByRole('spinbutton', { name: 'Quantity for Fixture Blend' }).fill('3')
  await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
  await page.getByText('Add labels from a ZIP', { exact: true }).click()
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'broken.zip', mimeType: 'application/zip', buffer: Buffer.from('invalid archive') })
  await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
  await expect(page.getByText('Checking your labels…', { exact: true })).toHaveCount(0)
  zip.file('manifest.json', JSON.stringify(manifest).replace('"schemaVersion":', '"schemaVersion":"2.0.0","schemaVersion":'))
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'duplicate-keys.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
  const invalidManifest = problem.getByText('manifest.json must be valid UTF-8 JSON with unique object keys and nesting depth at most 32.')
  await expect(invalidManifest).toHaveCount(1)
  await problem.getByText('View details', { exact: true }).click()
  await expect(invalidManifest).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
  expect(reports).toHaveLength(1)
  await page.reload()
  await expect(page.getByRole('spinbutton', { name: 'Quantity for Fixture Blend' })).toHaveValue('3')
  await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
  expect(externalRequests).toEqual([])
})

for (const width of [1280, 375]) {
  test(`import history stays secondary and preserves the print job at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/api/labels/contributions', route => route.fulfill({ json: { status: 'collected' } }))
    await page.route('**/api/gallery/v1/config', route => route.fulfill({ json: { intake: false, serving: false } }))
    await page.goto('/labels/print')
    const zip = await JSZip.loadAsync(await printablePack())
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    manifest.title = 'Tin to Cellar — User-approved draft set'
    manifest.extensions = { ...manifest.extensions, 'tin-to-cellar:feedback': {
      format: 'tin-to-cellar/feedback', schemaVersion: '1.0.0', promptVersion: '2026-09-06.1',
      request: { labelCount: 1, shape: 'circle' }, outcome: 'complete',
      steps: [{ stage: 'visual-review', status: 'passed', attempts: 1 }],
      issues: [{ code: 'artwork-fidelity', stage: 'visual-review', resolved: false }],
    } }
    zip.file('manifest.json', JSON.stringify(manifest))
    await page.getByLabel('Label ZIP').setInputFiles({ name: 'labels.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
    await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Print 1 label', exact: true })).toBeEnabled()
    await expect(page.getByText('1 label ready.', { exact: true })).toBeVisible()
    await expect(page.getByText('1 label ready.', { exact: true })).toBeHidden({ timeout: 15000 })
    await expect(page.getByRole('complementary', { name: 'Import needs attention' })).toHaveCount(0)
    await expect(page.getByLabel('Previous import')).toBeHidden()
    await page.getByRole('spinbutton', { name: 'Quantity for Fixture Blend' }).fill('3')
    await page.getByText('Add labels from a ZIP', { exact: true }).click()
    const history = page.locator('.import-history')
    await expect(history).not.toHaveAttribute('open')
    await history.getByText('Import history', { exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(history.getByLabel('Previous import')).toBeVisible()
    await expect(history.getByText('File checks passed', { exact: true })).toBeVisible()
    await expect(history.getByText('Artwork review', { exact: true })).toBeVisible()
    await expect(history.getByRole('complementary', { name: 'Label review notes' })).toContainText('unresolved artwork or layout concern')
    await expect(history).not.toContainText('selected for printing')
    await expect(history).not.toContainText('Choosing a report')
    await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
    await expect(page.getByRole('spinbutton', { name: 'Quantity for Fixture Blend' })).toHaveValue('3')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).include('.importer').analyze()).violations).toEqual([])
    await history.screenshot({ path: testInfo.outputPath('import-history.png') })
    await history.getByText('Import history', { exact: true }).focus()
    await page.keyboard.press('Space')
    await expect(history.getByLabel('Previous import')).toBeHidden()
    await expect(history.getByText('Import history', { exact: true })).toBeFocused()
  })
}
