import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { decode, encode } from 'fast-png'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import { writeFile } from 'node:fs/promises'
import { printablePack } from './pack'

test('printing exposes 1mm of bleed without scaling artwork or overlapping neighbors', async ({ page }, testInfo) => {
  // Red through the supplied bleed makes clipping visible in rendered pixels.
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
  await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your labels' })).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Quantity for Fixture Blend' }).fill('10')
  await page.getByText('Paper and alignment', { exact: true }).click()
  await page.getByLabel('Start at slot', { exact: true }).selectOption('2')
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => window.scrollTo(0, 0))
  const sheet = page.locator('.production-page').first()
  const box = await sheet.boundingBox()
  expect(box).toEqual({ x: 0, y: 0, width: 816, height: 1056 })
  let shot = decode(await sheet.screenshot({ path: testInfo.outputPath('print-trim.png') }))
  const red = (x: number, y: number, maxGreen = 50) => {
    const i = (y * shot.width + x) * shot.channels
    return shot.data[i] > 180 && shot.data[i + 1] < maxGreen
  }
  // The trim remains 240px and the supplied 2.75-inch image remains 264px.
  // Only clipping changes; resizing either box would alter the composition.
  const slot = page.locator('.production-slot').nth(1)
  const trim = await slot.locator('.label-art').boundingBox()
  const artwork = await slot.locator('img').boundingBox()
  expect(trim).toEqual({ x: 288, y: 96, width: 240, height: 240 })
  expect(artwork).toEqual({ x: 276, y: 84, width: 264, height: 264 })
  const checkBleed = () => {
    expect(red(156, 216)).toBe(false) // First slot stays empty.
    for (const x of [288, 540]) {
      // 1mm is about 3.78px at 96px/in, on every side of the finished circle.
      expect(red(x - 2, 216)).toBe(true)
      expect(red(x - 5, 216)).toBe(false)
      expect(red(x + 241, 216)).toBe(true)
      expect(red(x + 245, 216)).toBe(false)
      expect(red(x + 120, 94)).toBe(true)
      expect(red(x + 120, 91)).toBe(false)
      expect(red(x + 120, 338)).toBe(true)
      expect(red(x + 120, 341)).toBe(false)
      expect(red(x + 2, 98)).toBe(false) // Circular crop, not a square.
      // Simulate a die cut displaced by 1mm in eight directions. Sample just
      // inside its edge to avoid judging raster antialiasing as a white rim.
      for (let direction = 0; direction < 8; direction++) {
        const angle = direction * Math.PI / 4
        for (let sample = 0; sample < 48; sample++) {
          const edge = sample * Math.PI / 24
          // Select the pixel containing the point, rather than rounding into
          // the next pixel at the antialiased outer edge. Require at least 75%
          // red coverage here: Linux Chromium can rasterize a boundary pixel
          // as (226, 50, 50), while another platform makes it fully red.
          // The cardinal bleed limits and empty gutters retain stricter probes.
          expect(red(Math.floor(x + 120 + Math.cos(angle) * 96 / 25.4 + Math.cos(edge) * 119),
            Math.floor(216 + Math.sin(angle) * 96 / 25.4 + Math.sin(edge) * 119), 64)).toBe(true)
        }
      }
    }
    // A clear gutter separates adjacent designs, including on lower rows.
    for (const y of [216, 528, 840]) expect(red(534, y)).toBe(false)
  }
  checkBleed()
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
  checkBleed()
  await loadingTask.destroy()

  // Calibration and artwork use the same physical coordinates and offsets.
  await page.emulateMedia({ media: 'screen' })
  await page.getByLabel('Horizontal adjustment', { exact: true }).fill('0.1')
  await page.getByLabel('Vertical adjustment', { exact: true }).fill('-0.1')
  await page.evaluate(() => { window.print = () => {} })
  await page.getByRole('button', { name: 'Print alignment sheet' }).click()
  await page.emulateMedia({ media: 'print' })
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(page.locator('.production-pages')).toBeHidden()
  const proof = await page.locator('.proof-slot').first().boundingBox()
  expect(proof!.x).toBeCloseTo(45.6, 1)
  expect(proof!.y).toBeCloseTo(86.4, 1)
  expect(proof!.width).toBeCloseTo(240, 3)
  expect(proof!.height).toBeCloseTo(240, 3)
})
