import { describe, expect, it } from 'vitest'
import { fixedSlotPosition, paginateFixedSheet } from './fixed-layout'
import { AVERY_94502_PROFILE } from './profiles'
import type { FixedSlotSheetProfile } from './types'

describe('fixed sheet layout', () => {
  const profile: FixedSlotSheetProfile = {
    ...AVERY_94502_PROFILE,
    page: { width: 200, height: 300, unit: 'mm' },
    slots: [
      { x: 20, y: 30, width: 40, height: 60, shape: 'circle' },
      { x: 100, y: 150, width: 40, height: 60, shape: 'circle' },
    ],
  }

  it('uses the profile capacity for partial first sheets and overflow', () => {
    expect(paginateFixedSheet(['a', 'b', 'c', 'd'], 2, profile)).toEqual([
      [null, 'a'], ['b', 'c'], ['d', null],
    ])
    expect(paginateFixedSheet([], 1, profile)).toEqual([[null, null]])
  })

  it('uses page dimensions and units for preview and actual-size coordinates', () => {
    expect(fixedSlotPosition(profile, profile.slots[0], { x: 2, y: 3 })).toEqual({
      left: '11%', top: '11%', width: '20%', height: '20%',
    })
    expect(fixedSlotPosition(profile, profile.slots[0])).toEqual({
      left: '20mm', top: '30mm', width: '40mm', height: '60mm',
    })
  })
})
