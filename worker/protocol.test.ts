// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import worker from './index'
import { PROTOCOL_REVISION, protocolInstructions, protocolReleases } from '../src/lib/protocol'
const env = { ASSETS: { fetch: vi.fn() }, PROOFS_ENABLED: 'false' }
const get = (path: string, init?: RequestInit) => worker.fetch(new Request(`https://tintocellar.com${path}`, init), env)
describe('hosted protocol', () => {
  it('serves readable HTML with both complete schemas and escaped instruction text', async () => {
    const response = await get('/api/labels/protocol/v1/instructions.html')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    const html = await response.text()
    const page = new DOMParser().parseFromString(html, 'text/html')
    const markdown = protocolInstructions()
    const schemas = [...markdown.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]))
    expect([...page.querySelectorAll('pre code')].map(el => JSON.parse(el.textContent!))).toEqual(schemas)
    expect(schemas).toHaveLength(2)
    expect(page.body.textContent).toContain(`END TIN TO CELLAR PROTOCOL ${PROTOCOL_REVISION}`)
    expect(page.body.textContent).toContain('artwork/<label-id>.png')
    expect(page.querySelectorAll('script, label-id')).toHaveLength(0)
    const pinned = await get(`/api/labels/protocol/v1/releases/${PROTOCOL_REVISION}/instructions.html`)
    expect(await pinned.text()).toBe(html)
    expect(pinned.headers.get('Cache-Control')).toContain('immutable')
    expect(response.headers.get('ETag')).not.toBe((await get('/api/labels/protocol/v1')).headers.get('ETag'))
    expect((await get('/api/labels/protocol/v1/instructions.html', { method: 'POST' })).status).toBe(405)
  })
  it('serves a complete current bundle without any proof services and pins exact immutable content', async () => {
    const current = await get('/api/labels/protocol/v1')
    expect(current.status).toBe(200)
    expect(current.headers.get('Content-Type')).toContain('text/markdown')
    expect(current.headers.get('Cache-Control')).toBe('no-cache')
    const body = await current.text()
    expect(body).toBe(protocolInstructions())
    expect(body).toContain(`https://tintocellar.com/api/labels/protocol/v1/releases/${PROTOCOL_REVISION}/instructions.md`)
    expect(body).toContain('https://tintocellar.com/api/labels/proof')
    expect(body).not.toMatch(/\/api\/(?:protocol|proof|sources|contributions)/)
    expect(body).toContain(`END TIN TO CELLAR PROTOCOL ${PROTOCOL_REVISION}`)
    expect(body).toContain(`Set protocolRevision to the numeric revision of these instructions (${PROTOCOL_REVISION}), matching the pack protocol extension.`)
    expect(body).toContain('"$defs"')
    expect(body).not.toMatch(/Authorization: Bearer\s+[A-Za-z0-9_-]{20}/)
    const pinned = await get(`/api/labels/protocol/v1/releases/${PROTOCOL_REVISION}/instructions.md`)
    expect(await pinned.text()).toBe(body)
    expect(pinned.headers.get('Cache-Control')).toContain('immutable')
    expect(env.ASSETS.fetch).not.toHaveBeenCalled()
  })
  it('serves exact hashed resources for every retained release, with HEAD and conditional caching', async () => {
    for (const release of Object.values(protocolReleases)) for (const [file, content] of Object.entries(release.files)) {
      const path = `/api/labels/protocol/v1/releases/${release.revision}/${file}`
      const response = await get(path)
      expect(await response.text()).toBe(content)
      expect(createHash('sha256').update(content).digest('hex')).toBe(release.hashes[file])
      if (file.endsWith('.json')) expect(response.headers.get('Content-Type')).toContain('application/json')
      const head = await get(path, { method: 'HEAD' })
      expect(head.status).toBe(200)
      expect(await head.text()).toBe('')
      expect((await get(path, { headers: { 'If-None-Match': response.headers.get('ETag')! } })).status).toBe(304)
    }
  })
  it('fails explicitly for unknown routes and unsupported methods', async () => {
    for (const path of ['/api/labels/protocol', '/api/labels/protocol/v2', '/api/labels/protocol/v1/releases/999/instructions.md', '/api/labels/protocol/v1/releases/1/nope', '/api/labels/protocol/v1/releases/01/instructions.md']) {
      const result = await get(path)
      expect(result.status).toBe(404)
      expect(await result.text()).not.toContain('<html')
    }
    const post = await get('/api/labels/protocol/v1', { method: 'POST', body: 'not consumed' })
    expect(post.status).toBe(405)
    expect(post.headers.get('Allow')).toBe('GET, HEAD')
  })
})
