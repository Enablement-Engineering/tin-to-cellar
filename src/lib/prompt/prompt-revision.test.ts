import { describe, expect, it, vi } from 'vitest'

vi.mock('../protocol', async (importOriginal) => {
  const original = await importOriginal<typeof import('../protocol')>()
  return { ...original, PROTOCOL_REVISION: 2 }
})

import { buildCellarPackRepairPrompt } from './prompt'
import { PROTOCOL_REVISION, resolveProtocolContext } from '../protocol'

describe('repair after a protocol release advances', () => {
  it('keeps a revision 1 pack pinned when the bundled current revision becomes 2', () => {
    expect(PROTOCOL_REVISION).toBe(2)
    const context = resolveProtocolContext({
      'tin-to-cellar:protocol': { revision: 1, cellarpackVersion: '1.0.0', feedbackVersion: '2.0.0' },
    })
    expect(context).toEqual({ status: 'known', revision: 1 })
    const repair = buildCellarPackRepairPrompt([{ message: 'Artwork hash does not match.' }], context)
    expect(repair).toContain('Protocol revision: 1')
    expect(repair).not.toContain('/releases/2/')
    expect(repair).toContain('do not switch to current')
  })
})
