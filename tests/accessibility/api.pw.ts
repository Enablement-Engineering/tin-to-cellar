import { expect, test } from '@playwright/test'

test('the local website serves Worker API responses instead of SPA HTML', async ({ request }) => {
  const page = await request.get('/')
  expect(page.status()).toBe(200)
  expect(page.headers()['content-type']).toContain('text/html')

  const access = await request.get('/api/labels/proof-access')
  expect(access.status()).toBe(404)
  expect(access.headers()['content-type']).toContain('application/json')
  expect(await access.json()).toEqual({ error: 'Not found' })

  const protocol = await request.get('/api/labels/protocol/v1/instructions.html')
  expect(protocol.status()).toBe(404)
  expect(await protocol.json()).toEqual({ error: 'Not found' })

  const instructions = await request.get('/agent/tin-to-cellar-prompt.md')
  expect(instructions.status()).toBe(200)
  expect(await instructions.text()).toContain('END TIN TO CELLAR PROTOCOL')

  const retired = await request.get('/api/protocol/v1/instructions.html')
  expect(retired.status()).toBe(404)
  expect(await retired.json()).toEqual({ error: 'Not found' })

  const health = await request.get('/api/health')
  expect(await health.json()).toEqual({ status: 'ok', cloudOcrEnabled: false })

  const missing = await request.get('/api/not-a-real-endpoint')
  expect(missing.status()).toBe(404)
  expect(missing.headers()['content-type']).toContain('application/json')
  expect(await missing.json()).toEqual({ error: 'Not found' })
})
