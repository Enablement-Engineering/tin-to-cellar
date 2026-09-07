import type { FixedSlotSheetProfile, SheetSlot } from './types'

/** Shared pagination for screen previews and physical sheets. */
export function paginateFixedSheet<T>(copies: T[], firstSlot: number, profile: FixedSlotSheetProfile): Array<Array<T | null>> {
  const capacity = profile.slots.length
  if (!capacity) throw new RangeError('A fixed sheet must have at least one slot.')
  const skipped = Math.max(0, Math.min(capacity - 1, Math.floor(firstSlot) - 1))
  const instances: Array<T | null> = [...Array.from({ length: skipped }, () => null), ...copies]
  return Array.from({ length: Math.max(1, Math.ceil(instances.length / capacity)) }, (_, page) =>
    profile.slots.map((_, slot) => instances[page * capacity + slot] ?? null),
  )
}

/** Calibration is included in the preview; the physical coordinate layer applies it once. */
export function fixedSlotPosition(
  profile: FixedSlotSheetProfile,
  slot: SheetSlot,
  previewOffset?: { x: number; y: number },
) {
  return previewOffset ? {
    left: `${(slot.x + previewOffset.x) / profile.page.width * 100}%`,
    top: `${(slot.y + previewOffset.y) / profile.page.height * 100}%`,
    width: `${slot.width / profile.page.width * 100}%`,
    height: `${slot.height / profile.page.height * 100}%`,
  } : {
    left: `${slot.x}${profile.page.unit}`,
    top: `${slot.y}${profile.page.unit}`,
    width: `${slot.width}${profile.page.unit}`,
    height: `${slot.height}${profile.page.unit}`,
  }
}
