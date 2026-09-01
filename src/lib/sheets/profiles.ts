import type {
  FixedSlotSheetProfile,
  FullSheetProfile,
  SheetProfile,
  SheetSlot,
} from './types'

const neutralCalibration = {
  xOffset: 0,
  yOffset: 0,
  scale: 1,
} as const

function makeGridSlots(
  xs: readonly number[],
  ys: readonly number[],
  width: number,
  height: number,
  shape: SheetSlot['shape'],
): SheetSlot[] {
  return ys.flatMap((y) => xs.map((x) => ({ x, y, width, height, shape, rotationDegrees: 0 })))
}

export const AVERY_94502_PROFILE: FixedSlotSheetProfile = {
  format: 'tin-to-cellar/sheet-profile',
  schemaVersion: '1.0.0',
  id: 'tin-to-cellar:avery-94502@1',
  name: 'Avery 94502 · 2.5-inch circles · US Letter',
  kind: 'fixed-slots',
  page: { width: 8.5, height: 11, unit: 'in' },
  slots: makeGridSlots([0.375, 3, 5.625], [1, 4.25, 7.5], 2.5, 2.5, 'circle'),
  calibration: neutralCalibration,
}

export const FULL_SHEET_LETTER_PROFILE: FullSheetProfile = {
  format: 'tin-to-cellar/sheet-profile',
  schemaVersion: '1.0.0',
  id: 'tin-to-cellar:full-sheet-letter@1',
  name: 'Full-sheet adhesive paper · US Letter',
  kind: 'full-sheet',
  page: { width: 8.5, height: 11, unit: 'in' },
  defaultMargins: { top: 0.25, right: 0.25, bottom: 0.25, left: 0.25 },
  defaultGutter: { horizontal: 0.125, vertical: 0.125 },
  calibration: neutralCalibration,
}

export const FULL_SHEET_A4_PROFILE: FullSheetProfile = {
  format: 'tin-to-cellar/sheet-profile',
  schemaVersion: '1.0.0',
  id: 'tin-to-cellar:full-sheet-a4@1',
  name: 'Full-sheet adhesive paper · A4',
  kind: 'full-sheet',
  page: { width: 210, height: 297, unit: 'mm' },
  defaultMargins: { top: 6, right: 6, bottom: 6, left: 6 },
  defaultGutter: { horizontal: 3, vertical: 3 },
  calibration: neutralCalibration,
}

export const BUILT_IN_SHEET_PROFILES: readonly SheetProfile[] = [
  AVERY_94502_PROFILE,
  FULL_SHEET_LETTER_PROFILE,
  FULL_SHEET_A4_PROFILE,
]

export function getSheetProfile(id: string): SheetProfile | undefined {
  return BUILT_IN_SHEET_PROFILES.find((profile) => profile.id === id)
}
