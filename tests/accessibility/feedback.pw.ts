import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import JSZip from 'jszip'
import { printablePack } from './pack'

for (const width of [1280, 320]) {
  test(`run details remain optional and readable at ${width}px`, async ({ page }) => {
    await page.route('**/api/**', route => route.fulfill({ status: 503, body: '{}' }))
    await page.route('https://**/*', route => route.abort())
    const zip = await JSZip.loadAsync(await printablePack())
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    const report = {
      format: 'tin-to-cellar/feedback', schemaVersion: '2.0.0', protocolRevision: 2,
      request: { labelCount: 1, shape: 'circle' }, outcome: 'complete',
      steps: [{ stage: 'generation', status: 'passed', attempts: 1 }],
      issues: [
        { code: 'image-handoff-unavailable', stage: 'generation', resolved: false },
        { code: 'write-area', stage: 'visual-review', resolved: true },
      ],
    }
    manifest.extensions = { ...manifest.extensions, 'tin-to-cellar:feedback': report }
    zip.file('manifest.json', JSON.stringify(manifest))
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/#print')
    await page.getByLabel('Label ZIP').setInputFiles({ name: 'feedback.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
    await expect(page.getByRole('heading', { name: 'Your labels' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Current run' }).getByText('Blank date area needed attention')).toBeHidden()
    const toggle = page.locator('summary').filter({ hasText: 'AI run details' })
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: 'Current run' }).getByText('Blank date area needed attention')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Choose reports' })).toBeHidden()
    await page.locator('.feedback-panel').screenshot({ path: `test-results/feedback-${width}.png` })
    await page.getByText('Open and compare saved reports', { exact: true }).click()
    await page.getByLabel('Open saved feedback reports').setInputFiles({ name: 'report.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(report)) })
    await expect(page.getByRole('status').filter({ hasText: '1 report loaded' })).toBeVisible()
    await page.getByText('View all reports JSON', { exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  })
}
