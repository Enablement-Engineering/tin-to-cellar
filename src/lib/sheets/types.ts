import type { LabelShape, LabelSurface, PhysicalUnit } from '../cellarpack/types'

export interface SheetPage {
  width: number
  height: number
  unit: PhysicalUnit
}

export interface SheetSlot {
  x: number
  y: number
  width: number
  height: number
  shape: LabelShape
  rotationDegrees?: number
}

export interface SheetCalibration {
  xOffset: number
  yOffset: number
  scale: number
}

export interface FixedSlotSheetProfile {
  format: 'tin-to-cellar/sheet-profile'
  schemaVersion: '1.0.0'
  id: string
  name: string
  kind: 'fixed-slots'
  page: SheetPage
  slots: SheetSlot[]
  calibration: SheetCalibration
}

export interface FullSheetProfile {
  format: 'tin-to-cellar/sheet-profile'
  schemaVersion: '1.0.0'
  id: string
  name: string
  kind: 'full-sheet'
  page: SheetPage
  defaultMargins: {
    top: number
    right: number
    bottom: number
    left: number
  }
  defaultGutter: {
    horizontal: number
    vertical: number
  }
  calibration: SheetCalibration
}

export type SheetProfile = FixedSlotSheetProfile | FullSheetProfile

export interface SheetCompatibilityResult {
  compatible: boolean
  fittingSlotCount: number
  issues: Array<{
    code: 'PROFILE_LABEL_MISMATCH'
    message: string
  }>
}

export type SheetCompatibleSurface = Pick<LabelSurface, 'shape' | 'finishedSize'>
