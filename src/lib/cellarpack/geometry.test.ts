import { describe, expect, it } from 'vitest'
import { isWriteAreaInsideSurface, isWriteAreaInsideSafeArea } from './geometry'
import type { LabelSurface, NormalizedWriteAreaGeometry } from './types'

const circle: LabelSurface = {
  shape: 'circle',
  finishedSize: { width: 2.5, height: 2.5, unit: 'in' },
  bleed: { top: 0.125, right: 0.125, bottom: 0.125, left: 0.125, unit: 'in' },
  safeInset: { top: 0.15, right: 0.15, bottom: 0.15, left: 0.15, unit: 'in' },
}

describe('normalized writing-area containment', () => {
  it('accepts a rounded writing field safely inside a circle', () => {
    const area: NormalizedWriteAreaGeometry = {
      shape: 'rounded-rectangle',
      x: 0.3,
      y: 0.74,
      width: 0.4,
      height: 0.1,
      cornerRadius: 0.035,
    }
    expect(isWriteAreaInsideSurface(area, circle)).toBe(true)
  })

  it('rejects a rectangle whose corner crosses the circle', () => {
    const area: NormalizedWriteAreaGeometry = {
      shape: 'rectangle',
      x: 0,
      y: 0,
      width: 0.4,
      height: 0.2,
    }
    expect(isWriteAreaInsideSurface(area, circle)).toBe(false)
  })

  it('rejects rotated writing regions', () => {
    const area: NormalizedWriteAreaGeometry = {
      shape: 'rectangle',
      x: 0.2,
      y: 0.44,
      width: 0.6,
      height: 0.12,
      // Untrusted data can contain values outside the typed contract.
      rotationDegrees: 45 as 0,
    }
    expect(isWriteAreaInsideSurface(area, circle)).toBe(false)
  })

  it('rejects a region inside trim but outside the circular safe area', () => {
    const area = { shape: 'rectangle' as const, x: 0.4, y: 0.03, width: 0.2, height: 0.08 }
    expect(isWriteAreaInsideSurface(area, circle)).toBe(true)
    expect(isWriteAreaInsideSafeArea(area, circle)).toBe(false)
  })

  it('uses trim coordinates independent of bleed and converts inset units', () => {
    const area = { shape: 'rectangle' as const, x: 0.3, y: 0.7, width: 0.4, height: 0.1 }
    expect(isWriteAreaInsideSafeArea(area, circle)).toBe(true)
    expect(isWriteAreaInsideSafeArea(area, {
      ...circle,
      bleed: { top: 1, right: 1, bottom: 1, left: 1, unit: 'in' },
      safeInset: { top: 3.81, right: 3.81, bottom: 3.81, left: 3.81, unit: 'mm' },
    })).toBe(true)
  })
})
