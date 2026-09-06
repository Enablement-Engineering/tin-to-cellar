import { expect, it } from 'vitest'
import { parseRetrospective } from './retrospective'
const notes = { format: 'tin-to-cellar/retrospective', schemaVersion: '0.1.0', protocolRevision: '0.0.16', capabilities: { browsing: 'unknown' }, tools: [{ id: 'local-proof', version: 'unknown' }], observations: [{ stage: 'proof', kind: 'recovery', explanation: 'Rerunning the proof after regenerating the image succeeded.', result: 'worked' }] }
it('accepts bounded observable retrospectives with unknown capabilities', () => expect(parseRetrospective(notes)).toEqual(notes))
it('rejects unbounded text, missing recovery results, private fields, and invented capabilities', () => {
  for (const value of [{ ...notes, private: 'secret' }, { ...notes, capabilities: { email: 'available' } }, { ...notes, observations: Array(6).fill(notes.observations[0]) }, { ...notes, observations: [{ ...notes.observations[0], explanation: 'x'.repeat(601) }] }, { ...notes, observations: [{ ...notes.observations[0], result: undefined }] }, { ...notes, tools: [{ id: 'private-tool-name', version: 'unknown' }] }]) expect(parseRetrospective(value)).toBeNull()
})
