import { expect, it, vi } from 'vitest'
import { PROTOCOL_KEY, resolveProtocolContext } from './index'
const provenance = { revision: 1, cellarpackVersion: '1.0.0', feedbackVersion: '2.0.0' }
it('validates optional provenance locally and refuses conflicting or malformed attribution', () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  expect(resolveProtocolContext(undefined)).toEqual({ status: 'legacy' })
  expect(resolveProtocolContext({ [PROTOCOL_KEY]: provenance })).toEqual({ status: 'known', revision: 1 })
  expect(resolveProtocolContext({ [PROTOCOL_KEY]: { ...provenance, revision: 999 } })).toEqual({ status: 'unknown', revision: 999 })
  for (const bad of [{ ...provenance, url: 'https://private.example' }, { ...provenance, revision: '../secret' }, { ...provenance, revision: 0 }, { ...provenance, cellarpackVersion: '2.0.0' }]) expect(resolveProtocolContext({ [PROTOCOL_KEY]: bad }).status).toBe('invalid')
  expect(resolveProtocolContext({ [PROTOCOL_KEY]: provenance, 'tin-to-cellar:feedback': { format: 'tin-to-cellar/feedback', schemaVersion: '2.0.0', protocolRevision: 2 } }).status).toBe('conflict')
  expect(fetch).not.toHaveBeenCalled()
  fetch.mockRestore()
})
