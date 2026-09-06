import { expect, test } from '@playwright/test'

test('the local website serves Worker API responses instead of SPA HTML', async ({ request }) => {
  const page = await request.get('/')
  expect(page.status()).toBe(200)
  expect(page.headers()['content-type']).toContain('text/html')

  const access = await request.get('/api/proof-access')
  expect(access.status()).toBe(200)
  expect(access.headers()['content-type']).toContain('application/json')
  expect(await access.json()).toHaveProperty('siteKey')

  const health = await request.get('/api/health')
  expect(await health.json()).toEqual({ status: 'ok', cloudOcrEnabled: false })

  const missing = await request.get('/api/not-a-real-endpoint')
  expect(missing.status()).toBe(404)
  expect(missing.headers()['content-type']).toContain('application/json')
  expect(await missing.json()).toEqual({ error: 'Not found' })
})
