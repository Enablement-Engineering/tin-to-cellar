import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import JSZip from 'jszip'
import { decode, encode } from 'fast-png'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import { printablePack } from './pack'

const a4 = 'tin-to-cellar:a4-63.5-circle-12@1'
const letter = 'tin-to-cellar:avery-94502@1'

test('A4 persists, prints exact artwork on two sheets, and calibrates in millimetres', async ({ page }, testInfo) => {
  const zip = await JSZip.loadAsync(await printablePack())
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
  const data = new Uint8Array(825 * 825 * 4)
  for (let i = 0; i < data.length; i += 4) { data[i] = 220; data[i + 3] = 255 }
  const png = encode({ width: 825, height: 825, channels: 4, data })
  manifest.assets['asset-fixture'].sha256 = createHash('sha256').update(png).digest('hex')
  zip.file('manifest.json', JSON.stringify(manifest))
  zip.file('artwork/fixture-blend.png', png)
  await page.setViewportSize({ width: 1100, height: 1000 })
  await page.goto('/labels/print')
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'a4.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
  await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  const paper = page.getByRole('combobox', { name: 'Label paper', exact: true })
  await expect(paper).toHaveValue(letter)
  await page.getByRole('button', { name: 'More Fixture Blend', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(paper).toBeFocused()
  // Native popup keystrokes vary by OS; exercise the native selection through Playwright.
  await paper.selectOption(a4)
  await expect(paper).toHaveValue(a4)
  await page.getByRole('spinbutton', { name: 'Quantity for Fixture Blend' }).fill('12')
  await page.getByText('Paper and alignment', { exact: true }).click()
  await page.getByLabel('Start at slot', { exact: true }).selectOption('12')
  await page.getByLabel('Horizontal adjustment', { exact: true }).fill('2.54')
  await page.getByLabel('Vertical adjustment', { exact: true }).fill('-2.54')
  await expect(page.getByRole('button', { name: 'Print 12 labels', exact: true })).toBeEnabled()
  await page.reload()
  await expect(paper).toHaveValue(a4)
  await page.getByText('Paper and alignment', { exact: true }).click()
  await expect(page.getByLabel('Start at slot', { exact: true })).toHaveValue('12')
  await expect(page.getByLabel('Horizontal adjustment', { exact: true })).toHaveValue('2.54')
  const preview = page.locator('.simple-sheet')
  const previewBox = await preview.boundingBox()
  const previewSlot = await page.locator('.preview-slot').first().boundingBox()
  expect((previewSlot!.x - previewBox!.x) / previewBox!.width).toBeCloseTo((5.25 + 2.54) / 210, 2)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: testInfo.outputPath('a4-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect((await new AxeBuilder({ page }).include('.simple-print').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('a4-mobile.png'), fullPage: true })
  await page.getByLabel('Start at slot', { exact: true }).selectOption('2')
  await page.getByLabel('Horizontal adjustment', { exact: true }).fill('0')
  await page.getByLabel('Vertical adjustment', { exact: true }).fill('0')
  await expect(page.getByRole('button', { name: 'Print 12 labels', exact: true })).toBeEnabled()
  await page.emulateMedia({ media: 'print' })
  const slot = page.locator('.production-slot').nth(1)
  const trim = await slot.locator('.label-art').boundingBox()
  const artwork = await slot.locator('img').boundingBox()
  expect(trim!.width).toBeCloseTo(240, 1)
  expect(artwork!.width).toBeCloseTo(264, 1)
  const pdf = await page.pdf({ path: testInfo.outputPath('a4-labels.pdf'), preferCSSPageSize: true, printBackground: true })
  const task = getDocument({ data: new Uint8Array(pdf) })
  try {
    const document = await task.promise
    expect(document.numPages).toBe(2)
    for (let i = 1; i <= 2; i++) {
      const pdfPage = await document.getPage(i)
      expect(Math.abs(pdfPage.view[2] - 210 / 25.4 * 72)).toBeLessThan(1)
      expect(Math.abs(pdfPage.view[3] - 297 / 25.4 * 72)).toBeLessThan(1)
      const viewport = pdfPage.getViewport({ scale: 96 / 72 })
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
      await pdfPage.render({ canvas: null, canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D, viewport }).promise
      const raster = canvas.toBuffer('image/png')
      await writeFile(testInfo.outputPath(`a4-page-${i}.png`), raster)
      const image = decode(raster)
      const red = (xMm: number, yMm: number) => {
        const index = (Math.floor(yMm / 25.4 * 96) * image.width + Math.floor(xMm / 25.4 * 96)) * image.channels
        return image.data[index] > 180 && image.data[index + 1] < 60
      }
      expect(red(37, 46.5)).toBe(i === 2) // Skipped first slot, then overflow on page two.
      expect(red(105, 46.5)).toBe(i === 1)
      if (i === 1) {
        expect(red(173, 250.5)).toBe(true) // Last row is on the page.
        expect(red(73.25 - .5, 46.5)).toBe(true) // Supplied bleed is exposed.
        expect(red(73.25 - 1.5, 46.5)).toBe(false)
        expect(red(71, 46.5)).toBe(false) // Clear gutter.
        expect(red(73.5, 15)).toBe(false) // Circular clipping.
      }
    }
  } finally { await task.destroy() }
  await page.emulateMedia({ media: 'screen' })
  await page.getByLabel('Horizontal adjustment', { exact: true }).fill('2.54')
  await page.getByLabel('Vertical adjustment', { exact: true }).fill('-2.54')
  await page.evaluate(() => { window.print = () => {} })
  await page.getByRole('button', { name: 'Print alignment sheet' }).click()
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(async () => (await page.locator('.proof-slot').first().boundingBox())!.x).toBeCloseTo((5.25 + 2.54) / 25.4 * 96, 1)
  const proof = await page.locator('.proof-slot').first().boundingBox()
  expect(proof!.x).toBeCloseTo((5.25 + 2.54) / 25.4 * 96, 1)
  expect(proof!.y).toBeCloseTo((14.75 - 2.54) / 25.4 * 96, 1)
  expect((await page.locator('.calibration-print-ruler').boundingBox())!.width).toBeCloseTo(50 / 25.4 * 96, 1)
  const alignment = await page.pdf({ path: testInfo.outputPath('a4-alignment.pdf'), preferCSSPageSize: true })
  const alignmentTask = getDocument({ data: new Uint8Array(alignment) })
  try { expect((await alignmentTask.promise).numPages).toBe(1) } finally { await alignmentTask.destroy() }
  await page.emulateMedia({ media: 'screen' })
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await paper.selectOption(letter)
  await expect(page.getByLabel('Start at slot', { exact: true })).toHaveValue('1')
  await expect(page.getByLabel('Horizontal adjustment', { exact: true })).toHaveValue('0')
  await expect(page.getByRole('button', { name: 'Print 12 labels', exact: true })).toBeEnabled()
  const letterPdf = await page.pdf({ preferCSSPageSize: true })
  const letterTask = getDocument({ data: new Uint8Array(letterPdf) })
  try { expect((await (await letterTask.promise).getPage(1)).view).toEqual([0, 0, 612, 792]) } finally { await letterTask.destroy() }
})
