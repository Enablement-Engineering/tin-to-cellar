import { describe, it, expect } from 'vitest'
import { TOBACCO_CATALOG, resolveTobaccoId, findExactTobacco } from './index'
import registry from './identities.json'
// @ts-expect-error Pure maintenance module is also exercised by runtime tests.
import { assignPermanentIds, identityIndex } from '../../../scripts/catalog/identities.mjs'
describe('permanent catalog identity', () => {
  it('freezes every previous runtime ID without renaming or dropping entries', () => {
    expect(TOBACCO_CATALOG).toHaveLength(1482)
    for (const entry of TOBACCO_CATALOG) {
      const previous = `${entry.maker} ${entry.blend}`.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replaceAll(' ', '-')
      expect(entry.id).toBe(previous); expect(resolveTobaccoId(entry.id)).toBe(entry); expect(findExactTobacco(entry.maker, entry.blend)).toBe(entry)
    }
    expect(new Set(registry.entries.map(e => e.id)).size).toBe(1482)
  })
  it('retains IDs through rename; rejects implicit merges, missing/new identities, ambiguous aliases', () => {
    const r = { entries: [{ id: 'old-id', maker: 'Maker', blend: 'New', previousNames: [{ maker: 'Maker', blend: 'Old' }] }], idAliases: [{ aliasId: 'historical', catalogId: 'old-id' }] }
    expect(assignPermanentIds([{ maker: 'Maker', blend: 'Old' }], r)[0]).toMatchObject({ id: 'old-id', blend: 'New' })
    expect(() => assignPermanentIds([{ maker: 'Maker', blend: 'Unknown' }], r)).toThrow('Register')
    expect(() => assignPermanentIds([], r)).toThrow('missing')
    expect(() => assignPermanentIds([{ maker: 'Maker', blend: 'Old' }, { maker: 'Maker', blend: 'New' }], r)).toThrow('Multiple')
    expect(() => identityIndex({ ...r, idAliases: [{ aliasId: 'old-id', catalogId: 'old-id' }] })).toThrow('alias')
  })
})
