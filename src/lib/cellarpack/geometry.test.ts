import { describe, expect, it } from 'vitest'
import { isWriteAreaInsideSurface } from './geometry'
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

  it('accounts for rotation', () => {
    const area: NormalizedWriteAreaGeometry = {
      shape: 'rectangle',
      x: 0.2,
      y: 0.44,
      width: 0.6,
      height: 0.12,
      rotationDegrees: 45,
    }
    expect(isWriteAreaInsideSurface(area, circle)).toBe(true)
  })
})
