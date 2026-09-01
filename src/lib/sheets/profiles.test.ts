import { describe, expect, it } from 'vitest'
import { checkLabelSheetCompatibility } from './compatibility'
import { AVERY_94502_PROFILE, FULL_SHEET_A4_PROFILE } from './profiles'

describe('sheet profiles', () => {
  it('models Avery 94502 as nine exact 2.5-inch circle slots', () => {
    expect(AVERY_94502_PROFILE.slots).toHaveLength(9)
    expect(AVERY_94502_PROFILE.slots[0]).toMatchObject({
      x: 0.375,
      y: 1,
      width: 2.5,
      height: 2.5,
      shape: 'circle',
    })
    expect(AVERY_94502_PROFILE.slots[8]).toMatchObject({ x: 5.625, y: 7.5 })
  })

  it('accepts a matching circle and rejects an oval on Avery 94502', () => {
    expect(
      checkLabelSheetCompatibility(
        { shape: 'circle', finishedSize: { width: 2.5, height: 2.5, unit: 'in' } },
        AVERY_94502_PROFILE,
      ),
    ).toMatchObject({ compatible: true, fittingSlotCount: 9 })
    expect(
      checkLabelSheetCompatibility(
        { shape: 'oval', finishedSize: { width: 2.5, height: 2, unit: 'in' } },
        AVERY_94502_PROFILE,
      ).compatible,
    ).toBe(false)
  })

  it('computes whether custom dimensions fit full-sheet A4', () => {
    expect(
      checkLabelSheetCompatibility(
        { shape: 'rounded-rectangle', finishedSize: { width: 80, height: 40, unit: 'mm' } },
        FULL_SHEET_A4_PROFILE,
      ).compatible,
    ).toBe(true)
  })
})
