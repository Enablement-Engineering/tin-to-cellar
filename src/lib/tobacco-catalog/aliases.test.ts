import { expect, it, vi } from 'vitest'
vi.mock('./catalog.json', () => ({ default: [
  { id: 'a', maker: 'Maker One', blend: 'Alpha', aliases: ['Legacy Alpha', 'Shared Name'] },
  { id: 'b', maker: 'Maker One', blend: 'Beta', aliases: ['Shared Name'] },
  { id: 'c', maker: 'Maker Two', blend: 'Gamma', aliases: ['Legacy Alpha'] },
] }))
vi.mock('./identities.json', () => ({ default: { idAliases: [], entries: [
  { id: 'a', maker: 'Maker One', blend: 'Alpha', previousNames: [] },
  { id: 'b', maker: 'Maker One', blend: 'Beta', previousNames: [] },
  { id: 'c', maker: 'Maker Two', blend: 'Gamma', previousNames: [] },
] } }))
import { findExactTobacco } from './index'
it('matches an explicitly declared, normalized alias only within its maker', () => {
  expect(findExactTobacco('maker one', ' Legacy Alpha ')?.id).toBe('a')
  expect(findExactTobacco('Maker Two', 'Legacy Alpha')?.id).toBe('c')
  expect(findExactTobacco('Other Maker', 'Legacy Alpha')).toBeUndefined()
})
it('leaves same-maker ambiguous aliases unresolved without affecting canonical names', () => {
  expect(findExactTobacco('Maker One', 'Shared Name')).toBeUndefined()
  expect(findExactTobacco('Maker One', 'Alpha')?.id).toBe('a')
})
it('does not use fuzzy search to assign artwork identity', () => {
  expect(findExactTobacco('Maker One', 'Legacy Alhpa')).toBeUndefined()
})
