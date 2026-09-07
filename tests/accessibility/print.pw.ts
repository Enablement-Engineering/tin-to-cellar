import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { decode, encode } from 'fast-png'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import { writeFile } from 'node:fs/promises'
import { printablePack } from './pack'

test('printed circles match trim, leave gutters, and paginate at actual Letter size', async ({ page }, testInfo) => {
  // A solid red asset makes excess bleed visible in rendered pixels.
  const zip = await JSZip.loadAsync(await printablePack())
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
  const data = new Uint8Array(825 * 825 * 4)
  for (let i = 0; i < data.length; i += 4) { data[i] = 220; data[i + 3] = 255 }
  const png = encode({ width: 825, height: 825, channels: 4, data })
  manifest.assets['asset-fixture'].sha256 = createHash('sha256').update(png).digest('hex')
  zip.file('manifest.json', JSON.stringify(manifest))
  zip.file('artwork/fixture-blend.png', png)
  await page.setViewportSize({ width: 1000, height: 1200 })
  await page.goto('/labels/print')
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'print.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) })
  await expect(page.getByRole('heading', { name: 'Your labels' })).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Quantity for Fixture Blend' }).fill('10')
  await page.getByText('Paper and alignment', { exact: true }).click()
  await page.getByLabel('Start at slot', { exact: true }).selectOption('2')
  await page.emulateMedia({ media: 'print' })
  const sheet = page.locator('.production-page').first()
  const box = await sheet.boundingBox()
  expect(box).toEqual({ x: 0, y: 0, width: 816, height: 1056 })
  let shot = decode(await sheet.screenshot({ path: testInfo.outputPath('print-trim.png') }))
  const red = (x: number, y: number) => {
    const i = (y * shot.width + x) * shot.channels
    return shot.data[i] > 180 && shot.data[i + 1] < 50
  }
  // First slot stays empty. Occupied slots are exactly 240px at 96px/in.
  expect(red(156, 216)).toBe(false)
  for (const x of [288, 540]) {
    expect(red(x - 2, 216)).toBe(false)
    expect(red(x + 2, 216)).toBe(true)
    expect(red(x + 237, 216)).toBe(true)
    expect(red(x + 241, 216)).toBe(false)
    expect(red(x + 120, 94)).toBe(false)
    expect(red(x + 120, 98)).toBe(true)
    expect(red(x + 120, 333)).toBe(true)
    expect(red(x + 120, 338)).toBe(false)
    expect(red(x + 2, 98)).toBe(false) // Circular crop, not a square.
  }
  const pdf = await page.pdf({ path: testInfo.outputPath('labels.pdf'), preferCSSPageSize: true, printBackground: true })
  const loadingTask = getDocument({ data: new Uint8Array(pdf) })
  const document = await loadingTask.promise
  expect(document.numPages).toBe(2)
  for (let i = 1; i <= document.numPages; i++) {
    expect((await document.getPage(i)).view).toEqual([0, 0, 612, 792])
  }
  const pdfPage = await document.getPage(1)
  const viewport = pdfPage.getViewport({ scale: 96 / 72 })
  const canvas = createCanvas(viewport.width, viewport.height)
  await pdfPage.render({ canvas: null, canvasContext: canvas.getContext('2d') as unknown as CanvasRenderingContext2D, viewport }).promise
  const raster = canvas.toBuffer('image/png')
  await writeFile(testInfo.outputPath('labels-pdf.png'), raster)
  shot = decode(raster)
  expect(red(156, 216)).toBe(false)
  for (const x of [288, 540]) {
    expect(red(x - 2, 216)).toBe(false)
    expect(red(x + 2, 216)).toBe(true)
    expect(red(x + 237, 216)).toBe(true)
    expect(red(x + 241, 216)).toBe(false)
  }
  await loadingTask.destroy()

  // Calibration and artwork use the same physical coordinates and offsets.
  await page.emulateMedia({ media: 'screen' })
  await page.getByLabel('Horizontal adjustment', { exact: true }).fill('0.1')
  await page.getByLabel('Vertical adjustment', { exact: true }).fill('-0.1')
  await page.evaluate(() => { window.print = () => {} })
  await page.getByRole('button', { name: 'Print alignment sheet' }).click()
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.production-pages')).toBeHidden()
  const proof = await page.locator('.proof-slot').first().boundingBox()
  expect(proof!.x).toBeCloseTo(45.6, 1)
  expect(proof!.y).toBeCloseTo(86.4, 1)
  expect(proof!.width).toBeCloseTo(240, 3)
  expect(proof!.height).toBeCloseTo(240, 3)
})
