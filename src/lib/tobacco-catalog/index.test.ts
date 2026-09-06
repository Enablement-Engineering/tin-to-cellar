import { describe, expect, it } from 'vitest'
import { formatTobacco, searchTobaccos, TOBACCO_CATALOG } from './index'

describe('local tobacco suggestions', () => {
  it('ranks exact blend names before partial matches', () => {
    expect(searchTobaccos('Bayou Morning')[0].blend).toBe('Bayou Morning')
    expect(searchTobaccos('Bayou Morning').some((entry) => entry.blend === 'Bayou Morning Flake')).toBe(true)
  })
  it('matches maker shorthand, reordered words, and punctuation', () => {
    for (const query of ['C&D Pirate', 'CD Pirate', 'pirate cornell diehl']) {
      expect(searchTobaccos(query)[0].blend).toBe('Pirate Kake')
    }
  })
  it('tolerates a misspelling and adjacent transposition without returning arbitrary matches', () => {
    expect(searchTobaccos('pirtae kake')[0].blend).toBe('Pirate Kake')
    expect(searchTobaccos('autum evening')[0].blend).toBe('Autumn Evening')
    expect(searchTobaccos('my completely unlisted blend')).toEqual([])
    expect(searchTobaccos('')).toEqual([])
  })
  it('bounds results and preserves a readable identity', () => {
    expect(searchTobaccos('cornell', 3)).toHaveLength(3)
    expect(searchTobaccos('cornell', 0)).toEqual([])
    expect(formatTobacco(searchTobaccos('Pirate Kake')[0])).toBe('Cornell & Diehl — Pirate Kake')
  })
  it('finds maker abbreviations and named aliases across the starter catalog', () => {
    expect(searchTobaccos('gl pease quiet')[0].blend).toBe('Quiet Nights')
    expect(searchTobaccos('capstan blue')[0].maker).toBe('Capstan')
    expect(searchTobaccos('orlik golden')[0].blend).toBe('Golden Sliced')
    expect(searchTobaccos('Peterson early morning pipe')[0].maker).toBe('Peterson')
    expect(searchTobaccos('early morning pipe').some((entry) => entry.maker === 'Peterson')).toBe(true)
  })
  it('has unique identities and source-backed names only', () => {
    expect(new Set(TOBACCO_CATALOG.map((entry) => entry.id)).size).toBe(TOBACCO_CATALOG.length)
    for (const entry of TOBACCO_CATALOG) {
      expect(entry.maker.trim()).not.toBe('')
      expect(entry.blend.trim()).not.toBe('')
      expect(new URL(entry.sourceUrl).protocol).toBe('https:')
      expect(entry).not.toHaveProperty('image')
    }
  })
})
