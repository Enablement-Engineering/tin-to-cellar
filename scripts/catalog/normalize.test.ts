import { expect, it } from 'vitest'
import { normalizeRecord, key } from './normalize.mjs'
const row = (blend: string) => ({ maker: 'G.L. Pease', blend, rawName: blend, sourceUrl: 'https://4noggins.com/products/example' })
it('deduplicates packaging sizes without removing meaningful blend numbers', () => {
  expect(normalizeRecord(row('G.L. Pease: QUIET NIGHTS 2oz')).record.blend).toBe('Quiet Nights')
  expect(normalizeRecord(row('G.L. Pease: QUIET NIGHTS 8oz 2018 - C')).record.blend).toBe('Quiet Nights')
  expect(normalizeRecord(row('G.L. Pease: No. 27 100g 2017 - C')).record.blend).toBe('No. 27')
})
it('preserves edition years before weight and rejects assortment packs', () => {
  expect(normalizeRecord(row('G.L. Pease: Christmas Cheer 2015 100g')).record.blend).toBe('Christmas Cheer 2015')
  expect(normalizeRecord(row('G.L. Pease: SAMPLER ENGLISH')).excluded).toBeTruthy()
})
it('normalizes punctuation, accents, and equivalent maker spelling', () => {
  expect(key('G.L. Pease')).toBe(key('G. L. Pease'))
  expect(normalizeRecord(row('G.L. Pease: Quiet Nights')).record.maker).toBe('G. L. Pease')
  expect(key('Café & Crème')).toBe(key('Cafe and Creme'))
})
