import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
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
