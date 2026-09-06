import { afterEach, expect, it, vi } from 'vitest'
import { issueAccess } from './access'
import worker from './index'
afterEach(() => vi.unstubAllGlobals())
const request = (origin = 'https://tintocellar.com', body = 'challenge') => new Request('https://tintocellar.com/api/labels/proof-access', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body })
it('requires server verification with matching hostname and action before issuance', async () => {
  const issue = vi.fn(async () => Response.json({ token: 'private' }))
  const binding = { getByName: () => ({ fetch: issue }) }
  const verify = vi.fn(async () => Response.json({ success: true, hostname: 'tintocellar.com', action: 'proof-access' }))
  vi.stubGlobal('fetch', verify)
  expect((await issueAccess(request('https://attacker.example'), 'secret', binding)).status).toBe(403)
  expect((await issueAccess(request(undefined, 'x'.repeat(2049)), 'secret', binding)).status).toBe(400)
  expect(verify).not.toHaveBeenCalled()
  for (const result of [{ success: false }, { success: true, hostname: 'attacker.example', action: 'proof-access' }, { success: true, hostname: 'tintocellar.com', action: 'wrong' }]) {
    verify.mockResolvedValueOnce(Response.json(result))
    expect((await issueAccess(request(), 'secret', binding)).status).toBe(403)
  }
  expect(issue).not.toHaveBeenCalled()
  expect((await issueAccess(request(), 'secret', binding)).status).toBe(200)
  expect(issue).toHaveBeenCalledOnce()
  verify.mockRejectedValueOnce(new Error('offline'))
  expect((await issueAccess(request(), 'secret', binding)).status).toBe(503)
  expect(issue).toHaveBeenCalledOnce()
})
it('rejects missing/malformed proof credentials before reading uploads or calling Images', async () => {
  const images = { input: vi.fn() }, budget = { getByName: vi.fn() }
  for (const authorization of ['', 'Bearer fake', 'Bearer ' + 'a'.repeat(65)]) {
    const req = new Request('https://tintocellar.com/api/labels/proof', { method: 'POST', headers: { Authorization: authorization }, body: 'unread' })
    expect((await worker.fetch(req, { ASSETS: { fetch: vi.fn() }, IMAGES: images, PROOF_BUDGET: budget, PROOFS_ENABLED: 'true', PROOF_RATE_LIMITER: { limit: async () => ({ success: true }) } })).status).toBe(401)
  }
  expect(images.input).not.toHaveBeenCalled()
  expect(budget.getByName).not.toHaveBeenCalled()
})
