import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
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
  expect(reports[0].validation.issues.filter(issue => issue.code === 'MISSING_ARTWORK')).toEqual([{ code: 'MISSING_ARTWORK', count: 1 }])
  await page.getByRole('spinbutton', { name: 'Quantity for Fixture Blend' }).fill('3')
  await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'broken.zip', mimeType: 'application/zip', buffer: Buffer.from('invalid archive') })
  await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
  await expect(page.getByText('Checking your labels…', { exact: true })).toHaveCount(0)
  zip.file('manifest.json', JSON.stringify(manifest).replace('"schemaVersion":', '"schemaVersion":"2.0.0","schemaVersion":'))
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'duplicate-keys.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
  await expect(page.getByText('manifest.json must be valid UTF-8 JSON with unique object keys and nesting depth at most 32.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
  expect(reports).toHaveLength(1)
  await page.reload()
  await expect(page.getByRole('spinbutton', { name: 'Quantity for Fixture Blend' })).toHaveValue('3')
  await expect(page.getByRole('button', { name: 'Print 3 labels', exact: true })).toBeEnabled()
  expect(externalRequests).toEqual([])
})
