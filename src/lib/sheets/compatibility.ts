import type { LabelShape, PhysicalUnit } from '../cellarpack/types'
import type {
  SheetCompatibilityResult,
  SheetCompatibleSurface,
  SheetProfile,
  SheetSlot,
} from './types'

const INCHES_PER_MM = 1 / 25.4
const SIZE_TOLERANCE_INCHES = 0.01

function toInches(value: number, unit: PhysicalUnit): number {
  return unit === 'in' ? value : value * INCHES_PER_MM
}

function shapeFitsSlot(labelShape: LabelShape, slotShape: LabelShape): boolean {
  if (slotShape === 'rectangle' || slotShape === 'custom') return true
  if (slotShape === 'rounded-rectangle') {
    return ['rectangle', 'rounded-rectangle', 'square', 'custom'].includes(labelShape)
  }
  return labelShape === slotShape
}

function dimensionsFitSlot(
  surface: SheetCompatibleSurface,
  slot: SheetSlot,
  slotUnit: PhysicalUnit,
): boolean {
  const labelWidth = toInches(surface.finishedSize.width, surface.finishedSize.unit)
  const labelHeight = toInches(surface.finishedSize.height, surface.finishedSize.unit)
  const slotWidth = toInches(slot.width, slotUnit)
  const slotHeight = toInches(slot.height, slotUnit)
  return (
    Math.abs(labelWidth - slotWidth) <= SIZE_TOLERANCE_INCHES &&
    Math.abs(labelHeight - slotHeight) <= SIZE_TOLERANCE_INCHES
  )
}

export function checkLabelSheetCompatibility(
  surface: SheetCompatibleSurface,
  profile: SheetProfile,
): SheetCompatibilityResult {
  if (profile.kind === 'fixed-slots') {
    const fittingSlotCount = profile.slots.filter(
      (slot) =>
        shapeFitsSlot(surface.shape, slot.shape) &&
        dimensionsFitSlot(surface, slot, profile.page.unit),
    ).length
    return fittingSlotCount > 0
      ? { compatible: true, fittingSlotCount, issues: [] }
      : {
          compatible: false,
          fittingSlotCount: 0,
          issues: [
            {
              code: 'PROFILE_LABEL_MISMATCH',
              message: `The ${surface.finishedSize.width}×${surface.finishedSize.height} ${surface.finishedSize.unit} ${surface.shape} label does not match this sheet's cut slots.`,
            },
          ],
        }
  }

  const pageWidth = toInches(profile.page.width, profile.page.unit)
  const pageHeight = toInches(profile.page.height, profile.page.unit)
  const marginX = toInches(
    profile.defaultMargins.left + profile.defaultMargins.right,
    profile.page.unit,
  )
  const marginY = toInches(
    profile.defaultMargins.top + profile.defaultMargins.bottom,
    profile.page.unit,
  )
  const gutterX = toInches(profile.defaultGutter.horizontal, profile.page.unit)
  const gutterY = toInches(profile.defaultGutter.vertical, profile.page.unit)
  const labelWidth = toInches(surface.finishedSize.width, surface.finishedSize.unit)
  const labelHeight = toInches(surface.finishedSize.height, surface.finishedSize.unit)
  const columns = Math.floor((pageWidth - marginX + gutterX) / (labelWidth + gutterX))
  const rows = Math.floor((pageHeight - marginY + gutterY) / (labelHeight + gutterY))
  const fittingSlotCount = Math.max(0, columns) * Math.max(0, rows)

  return fittingSlotCount > 0
    ? { compatible: true, fittingSlotCount, issues: [] }
    : {
        compatible: false,
        fittingSlotCount: 0,
        issues: [
          {
            code: 'PROFILE_LABEL_MISMATCH',
            message: `The label is larger than the printable area of ${profile.name}.`,
          },
        ],
      }
}
