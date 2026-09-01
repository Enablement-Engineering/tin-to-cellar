import type { SheetProfile } from './types'

const PROFILE_ID = /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9.-]*@[1-9][0-9]*$/

export function isSheetProfile(value: unknown): value is SheetProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const profile = value as Record<string, unknown>
  if (
    profile.format !== 'tin-to-cellar/sheet-profile' ||
    profile.schemaVersion !== '1.0.0' ||
    typeof profile.id !== 'string' ||
    !PROFILE_ID.test(profile.id) ||
    typeof profile.name !== 'string' ||
    !isPage(profile.page) ||
    !isCalibration(profile.calibration)
  ) {
    return false
  }

  if (profile.kind === 'fixed-slots') {
    return (
      Array.isArray(profile.slots) &&
      profile.slots.length > 0 &&
      profile.slots.length <= 500 &&
      profile.slots.every((slot) => isSlot(slot, profile.page as Record<string, unknown>))
    )
  }
  if (profile.kind === 'full-sheet') {
    return isMargins(profile.defaultMargins) && isGutter(profile.defaultGutter)
  }
  return false
}

function isPage(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  return (
    isPositiveNumber(value.width) &&
    isPositiveNumber(value.height) &&
    (value.unit === 'in' || value.unit === 'mm')
  )
}

function isCalibration(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    typeof value.xOffset === 'number' &&
    Number.isFinite(value.xOffset) &&
    typeof value.yOffset === 'number' &&
    Number.isFinite(value.yOffset) &&
    isPositiveNumber(value.scale)
  )
}

function isSlot(value: unknown, page: Record<string, unknown>): boolean {
  if (!isRecord(value)) return false
  const shapes = ['circle', 'oval', 'square', 'rectangle', 'rounded-rectangle', 'custom']
  if (
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    value.x < 0 ||
    value.y < 0 ||
    !isPositiveNumber(value.width) ||
    !isPositiveNumber(value.height) ||
    !shapes.includes(String(value.shape))
  ) {
    return false
  }
  return value.x + value.width <= Number(page.width) && value.y + value.height <= Number(page.height)
}

function isMargins(value: unknown): boolean {
  if (!isRecord(value)) return false
  return ['top', 'right', 'bottom', 'left'].every(
    (key) => typeof value[key] === 'number' && Number(value[key]) >= 0,
  )
}

function isGutter(value: unknown): boolean {
  if (!isRecord(value)) return false
  return ['horizontal', 'vertical'].every(
    (key) => typeof value[key] === 'number' && Number(value[key]) >= 0,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}
