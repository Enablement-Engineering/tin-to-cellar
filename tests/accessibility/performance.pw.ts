import { expect, test } from '@playwright/test'
import { gzipSync } from 'node:zlib'

test('home loads no archived instructions or admin code and reduces initial JavaScript by at least 30 percent', async ({ page }) => {
  const scripts = new Map<string, Promise<Buffer>>()
  page.on('response', response => {
    if (new URL(response.url()).pathname.endsWith('.js') && response.request().resourceType() === 'script') {
      scripts.set(response.url(), response.body())
    }
  })
  await page.goto('/')
  await expect(page.locator('main')).toBeVisible()
  await page.waitForLoadState('networkidle')
  const bodies = await Promise.all(scripts.values())
  expect(bodies.length).toBeGreaterThan(0)
  const gzipBytes = bodies.reduce((total, body) => total + gzipSync(body).length, 0)
  // Same gzip calculation across every requested script, not just the entry chunk.
  expect(gzipBytes).toBeLessThan(850_990 * 0.7)
  for (const [url, body] of scripts) {
    expect(url).not.toMatch(/GalleryAdmin|protocol-archive/i)
    expect((await body).toString()).not.toContain('Protocol revision: 1')
    expect((await body).toString()).not.toContain('END TIN TO CELLAR PROTOCOL 0.0.22')
  }
  await test.info().attach('initial-javascript.json', { contentType: 'application/json', body: JSON.stringify({ baselineGzipBytes: 850990, gzipBytes, scripts: [...scripts.keys()].map(url => new URL(url).pathname) }, null, 2) })
})
