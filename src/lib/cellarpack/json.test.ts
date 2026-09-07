import { describe, expect, it } from 'vitest'
import { parseArchiveJson } from './json'

const parse = (text: string) => parseArchiveJson(new TextEncoder().encode(text))

describe('archive JSON trust boundary', () => {
  it.each([
    '{"id":1,"id":2}',
    '{"nested":[{"id":1,"\\u0069d":2}]}',
    '{"__proto__":{},"__proto__":{}}',
  ])('rejects duplicate keys: %s', (text) => {
    expect(() => parse(text)).toThrow('Duplicate JSON object key')
  })

  it('allows repeated keys in separate objects and ignores syntax inside strings', () => {
    const value = { a: [{ id: 1 }, { id: 2 }], b: '"id":1,{[\\"id":2}' }
    expect(parse(JSON.stringify(value))).toEqual(value)
  })

  it('preserves the existing depth limit, including primitive leaves', () => {
    expect(parse('['.repeat(32) + '0' + ']'.repeat(32))).toBeDefined()
    expect(() => parse('['.repeat(33) + '0' + ']'.repeat(33))).toThrow('JSON depth exceeds limit')
  })

  it('rejects malformed syntax and invalid UTF-8', () => {
    expect(() => parse('{"a":}')).toThrow()
    expect(() => parseArchiveJson(new Uint8Array([0xff]))).toThrow()
  })
})
