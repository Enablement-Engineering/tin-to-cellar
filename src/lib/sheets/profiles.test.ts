import { describe, expect, it } from 'vitest'
import { checkLabelSheetCompatibility, checkAvery94502Compatibility } from './compatibility'
import { AVERY_94502_PROFILE, A4_63_5_CIRCLE_PROFILE, FULL_SHEET_A4_PROFILE, getPrintSheetProfile } from './profiles'

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


it('gates the supported Avery print path by both physical size and shape', () => {
  expect(checkAvery94502Compatibility({ shape: 'circle', finishedSize: { width: 63.5, height: 63.5, unit: 'mm' } }).compatible).toBe(true)
  expect(checkAvery94502Compatibility({ shape: 'circle', finishedSize: { width: 2, height: 2, unit: 'in' } }).compatible).toBe(false)
  expect(checkAvery94502Compatibility({ shape: 'square', finishedSize: { width: 2.5, height: 2.5, unit: 'in' } }).compatible).toBe(false)
})

it('matches the EU30023 and LP12/64R template without resizing existing artwork', () => {
  const profile = A4_63_5_CIRCLE_PROFILE
  expect(profile.slots).toHaveLength(12)
  expect(profile.slots[0]).toMatchObject({ x: 5.25, y: 14.75, width: 63.5, height: 63.5 })
  expect(profile.slots[11]).toMatchObject({ x: 141.25, y: 218.75 })
  expect(checkLabelSheetCompatibility({ shape: 'circle', finishedSize: { width: 2.5, height: 2.5, unit: 'in' } }, profile)).toMatchObject({ compatible: true, fittingSlotCount: 12 })
  expect(checkLabelSheetCompatibility({ shape: 'circle', finishedSize: { width: 60, height: 60, unit: 'mm' } }, profile).compatible).toBe(false)
  expect(getPrintSheetProfile()).toBe(AVERY_94502_PROFILE)
  expect(getPrintSheetProfile(FULL_SHEET_A4_PROFILE.id)).toBeUndefined()
  expect(getPrintSheetProfile('custom:untrusted@1')).toBeUndefined()
})
