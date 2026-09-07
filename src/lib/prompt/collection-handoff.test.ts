import { describe, expect, it } from 'vitest'
import { buildCollectionHandoff, buildGenericChatHandoff } from './index'
import { PROTOCOL_REVISION } from '../protocol'

describe('collection handoff', () => {
  it('rejects zero or blank creation targets instead of using the chat inventory', () => {
    expect(() => buildCollectionHandoff({ tobaccos: [] })).toThrow('at least one')
    expect(() => buildCollectionHandoff({ tobaccos: [{ blend: '  ' }] })).toThrow('at least one')
  })

  it('scopes the complete handoff to chosen targets and preserves the exact snapshot', () => {
    const input = { tobaccos: [{ maker: 'Peterson', blend: 'Early Morning Pipe', notes: 'Current tin' }], websiteUrl: 'https://tintocellar.com/labels/create', artDirection: 'Keep the birds.' }
    const handoff = buildCollectionHandoff(input)
    expect(handoff.request).toContain('- Peterson — Early Morning Pipe — notes: Current tin')
    expect(handoff.request).toContain('only for the explicitly listed tobaccos')
    expect(handoff.request).toContain('do not recreate them, retrieve them, or include them')
    expect(handoff.request).not.toContain('the tobacco list the user supplied in this conversation')
    expect(handoff.prompt).toContain('Complete CellarPack 0.1 JSON Schema')
    expect(handoff.prompt).toContain('https://tintocellar.com/labels/print')
    expect(handoff.protocolRevision).toBe(PROTOCOL_REVISION)
    input.tobaccos.push({ maker: 'Other', blend: 'Later edit', notes: '' })
    expect(handoff.prompt).not.toContain('Later edit')
  })

  it('retains an explicit generic chat entrance and describes additive returns', () => {
    const handoff = buildGenericChatHandoff()
    expect(handoff.request).toContain('the tobacco list the user supplied in this conversation')
    expect(handoff.prompt).toContain('Importing does not automatically replace existing selected artwork')
    expect(handoff.prompt).not.toContain('importing replaces the current pack')
  })
})
