import { describe, expect, it } from 'vitest'
import { matchOrder } from './index'
import ocrOrder from './fixtures/ocr-order.txt?raw'

describe('order matching', () => {
  it('cleans the complete reported OCR order down to four product rows', () => {
    const matches = matchOrder(ocrOrder)
    expect(matches.map((item) => item.source)).toEqual(['G. L. Pease Quiet Nights', 'Peterson Early Morning Pipe', 'Orlik Golden Sliced', 'Cornell & Diehl Autumn Evening'])
    expect(matches.map((item) => item.suggestions[0])).toEqual(['G. L. Pease — Quiet Nights', 'Peterson — Early Morning Pipe', 'Orlik — Golden Sliced', 'Cornell & Diehl — Autumn Evening'])
  })
  it('rejects isolated fuzzy fragments but retains complete one-word blends', () => {
    expect(matchOrder('Orde\nrice')).toEqual([])
    expect(matchOrder('Westminster')[0].suggestions).toContain('G. L. Pease — Westminster')
  })
  it('recovers names from real screenshot OCR without price or accessory matches', () => {
    const matches = matchOrder('Golden Sliced 100g a\nrice:\nSku: 003-046-0001 po\nCornell & Diehl o ,\nuantity:\nAutumn Evening 202 ROA\nSku: 003-016-0096\nB.J. Long Pipe Cleaners - Bristle Quantity: 1\nSubtotal: $63.75')
    expect(matches.map((item) => item.suggestions[0])).toEqual(['Orlik — Golden Sliced', 'Cornell & Diehl — Autumn Evening'])
  })
  it('matches split maker/name rows and ignores quantities, weights and accessories', () => {
    const matches = matchOrder(`G. L. Pease\nQuiet Nights 2oz Quantity: 1\nSku: 003-029-0069\nPeterson\nEarly Morning Pipe 50g\nOrlik\nGolden Sliced 100g\nCornell & Diehl\nAutumn Evening 2oz\nCleaners & Cleaning Supplies\nB. J. Long Pipe Cleaners - Bristle\nTotal: $77.23`)
    expect(matches.map((item) => item.suggestions[0])).toEqual(['G. L. Pease — Quiet Nights', 'Peterson — Early Morning Pipe', 'Orlik — Golden Sliced', 'Cornell & Diehl — Autumn Evening'])
  })
  it('tolerates a misspelling while preserving its source for review', () => {
    expect(matchOrder('Cornell & Diehl\nPirate Kkae')[0]).toMatchObject({ source: 'Cornell & Diehl Pirate Kkae', suggestions: ['Cornell & Diehl — Pirate Kake'] })
  })
  it('does not force an unknown product into the catalog and bounds input', () => {
    expect(matchOrder('Acme Unlisted Widget 50g')).toEqual([])
    expect(() => matchOrder('a'.repeat(100001))).toThrow('too long')
  })
})
