import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { printablePack } from '../accessibility/pack'

test('CSP permits theme, local OCR/PDF and artwork while blocking injected scripts', async ({ page, context }) => {
  test.setTimeout(90000)
  const violations: string[] = []
  await page.exposeFunction('recordCspViolation', (directive: string) => violations.push(directive))
  await page.addInitScript(() => {
    localStorage.setItem('tin-to-cellar:theme', 'dark')
    document.addEventListener('securitypolicyviolation', event => {
      void (window as unknown as { recordCspViolation(value: string): Promise<void> }).recordCspViolation(event.effectiveDirective)
    })
  })
  await page.goto('/labels/order')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 900; canvas.height = 160
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'black'; ctx.font = '40px sans-serif'
    ctx.fillText('Cornell & Diehl', 30, 60)
    ctx.fillText('Autumn Evening', 30, 120)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('Blend list file').setInputFiles({ name: 'order.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64') })
  await expect(page.getByRole('heading', { name: 'Review your blends' })).toBeVisible({ timeout: 60000 })
  await page.getByRole('button', { name: 'Cancel review', exact: true }).click()

  const fixture = await context.newPage()
  await fixture.setContent('<p>Cornell &amp; Diehl</p><p>Autumn Evening</p>')
  const pdf = await fixture.pdf()
  await fixture.close()
  await page.getByLabel('Blend list file').setInputFiles({ name: 'order.pdf', mimeType: 'application/pdf', buffer: pdf })
  await expect(page.getByRole('heading', { name: 'Review your blends' })).toBeVisible()

  await page.goto('/labels/print')
  await page.getByLabel('Label ZIP').setInputFiles({ name: 'print.zip', mimeType: 'application/zip', buffer: await printablePack() })
  await page.getByRole('button', { name: 'Add 1 label', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your labels' })).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.production-slot img').first()).toBeVisible()
  expect(await page.locator('.production-slot img').first().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  expect(violations).toEqual([])

  // Trigger from a real browser event: DevTools evaluation can bypass CSP itself.
  await page.evaluate(() => {
    const button = document.createElement('button')
    button.textContent = 'Probe dynamic JavaScript'
    button.onclick = () => {
      try { new Function('document.documentElement.dataset.evaluated = "yes"')() }
      catch (error) { document.documentElement.dataset.evalBlocked = error instanceof EvalError ? 'yes' : 'unexpected' }
    }
    document.body.append(button)
  })
  await page.emulateMedia({ media: 'screen' })
  await page.getByRole('button', { name: 'Probe dynamic JavaScript' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-eval-blocked', 'yes')
  expect(await page.locator('html').getAttribute('data-evaluated')).toBeNull()
  await expect.poll(() => violations.filter(value => value === 'script-src').length).toBe(1)
  violations.length = 0

  await page.evaluate(() => {
    const script = document.createElement('script')
    script.textContent = 'document.documentElement.dataset.injected = "yes"'
    document.head.append(script)
    const remote = document.createElement('script')
    remote.src = 'https://untrusted.invalid/inject.js'
    document.head.append(remote)
  })
  await expect.poll(() => violations.length).toBeGreaterThanOrEqual(2)
  expect(await page.locator('html').getAttribute('data-injected')).toBeNull()
  expect(violations.every(value => value === 'script-src-elem')).toBe(true)
})

test('create page works directly and refuses a foreign-origin frame', async ({ page }) => {
  const direct = await page.goto('/labels/create')
  expect(direct?.headers()['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(direct?.headers()['x-frame-options']).toBe('DENY')
  await expect(page.locator('main')).toBeVisible()
  const session = await page.context().newCDPSession(page)
  const violations: string[] = []
  await session.send('Audits.enable')
  session.on('Audits.issueAdded', ({ issue }) => {
    const details = issue.details.contentSecurityPolicyIssueDetails
    if (details?.violatedDirective.includes('frame-ancestors')) violations.push(details.violatedDirective)
  })
  // Serve the parent over a real loopback connection: intercepted responses have
  // a public address classification in Chrome and can trigger local-network blocks.
  const parent = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end('<h1>Security audit frame test</h1><iframe title="Target" src="http://127.0.0.1:43929/labels/create" width="1100" height="850"></iframe>')
  })
  await new Promise<void>(resolve => parent.listen(0, '127.0.0.1', resolve))
  try {
    const address = parent.address() as { port: number }
    await page.goto(`http://127.0.0.1:${address.port}/`)
    await expect.poll(() => violations.length).toBeGreaterThan(0)
    await expect(page.frameLocator('iframe').locator('main')).toHaveCount(0)
    await page.screenshot({path:'output/security-frame-blocked.png',fullPage:true})
  } finally { await new Promise<void>((resolve, reject) => parent.close(error => error ? reject(error) : resolve())) }
})
