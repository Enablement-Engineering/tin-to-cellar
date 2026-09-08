import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import JSZip from 'jszip'
import { fixture } from '../gallery/fixtures'

for (const width of [1280, 320]) test(`import a second pack at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const first = await fixture(825)
  const second = await fixture(825, 20)
  // The second pack contains different artwork for a saved blend, plus a new blend.
  const newLabel = structuredClone(second.manifest.labels[0])
  newLabel.id = 'new-blend'
  newLabel.maker = 'Test maker'
  newLabel.blend = 'Another blend'
  second.manifest.labels.push(newLabel)
  const secondZip = await new JSZip().file('manifest.json', JSON.stringify(second.manifest)).file('artwork/fixture-blend.png', second.png).generateAsync({ type: 'nodebuffer' })
  const uploadSecond = () => page.locator('input[type=file]').first().setInputFiles({ name: 'second.zip', mimeType: 'application/zip', buffer: secondZip })
  await page.goto('/labels/print')
  await page.locator('input[type=file]').first().setInputFiles({ name: 'first.zip', mimeType: 'application/zip', buffer: first.zip })
  await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  const quantity = page.getByRole('spinbutton', { name: `Quantity for ${first.manifest.labels[0].blend}`, exact: true })
  await quantity.fill('3')
  await uploadSecond()
  const dialog = page.getByRole('dialog', { name: 'Add your new labels' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Add your new labels' })).toBeFocused()
  await expect(dialog.getByRole('combobox')).toHaveCount(0)
  await expect(dialog.getByRole('radio', { name: 'Keep current', exact: true })).toBeChecked()
  await expect(dialog.getByRole('button', { name: 'Replace saved labels with this pack' })).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(quantity).toHaveValue('3')
  await uploadSecond()
  const useImported = dialog.getByRole('radio', { name: 'Use imported artwork', exact: true })
  await useImported.focus()
  await page.keyboard.press('Space')
  await expect(useImported).toBeChecked()
  await expect(dialog.getByRole('img')).toHaveCount(2)
  await page.screenshot({ path: testInfo.outputPath('second-pack.png') })
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(dialog.getByRole('button', { name: 'Apply changes', exact: true })).toBeInViewport()
  await dialog.getByRole('button', { name: 'Apply changes', exact: true }).click()
  await expect(quantity).toHaveValue('3')
  await expect(page.getByRole('spinbutton', { name: 'Quantity for Another blend', exact: true })).toHaveValue('1')
  await page.reload()
  await expect(quantity).toHaveValue('3')
  await uploadSecond()
  await expect(dialog.getByRole('radio')).toHaveCount(0)
  await expect(dialog).toContainText('2 already saved')
  await dialog.getByRole('button', { name: 'Keep current labels', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: /^Quantity for / })).toHaveCount(2)
})
