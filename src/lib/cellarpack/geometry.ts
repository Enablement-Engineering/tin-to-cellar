import type {
  LabelSurface,
  NormalizedWriteAreaGeometry,
  ValidationIssue,
  WriteInArea,
} from './types'

interface Point {
  x: number
  y: number
}

const EPSILON = 1e-9

export function validateSurfaceGeometry(
  surface: LabelSurface,
  labelId: string,
): ValidationIssue[] {
  const { width, height } = surface.finishedSize
  const issues: ValidationIssue[] = []
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    issues.push({
      severity: 'error',
      code: 'INVALID_SURFACE_GEOMETRY',
      labelId,
      path: `labels.${labelId}.surface.finishedSize`,
      message: 'Finished label dimensions must be positive finite numbers.',
    })
  }
  if (
    (surface.shape === 'circle' || surface.shape === 'square') &&
    Math.abs(width - height) > Math.max(width, height) * 0.001
  ) {
    issues.push({
      severity: 'error',
      code: 'INVALID_SURFACE_GEOMETRY',
      labelId,
      path: `labels.${labelId}.surface.finishedSize`,
      message: `${surface.shape} labels must have equal width and height.`,
    })
  }
  if (
    surface.shape === 'rounded-rectangle' &&
    (surface.cornerRadius === undefined ||
      surface.cornerRadius < 0 ||
      surface.cornerRadius > Math.min(width, height) / 2)
  ) {
    issues.push({
      severity: 'error',
      code: 'INVALID_SURFACE_GEOMETRY',
      labelId,
      path: `labels.${labelId}.surface.cornerRadius`,
      message: 'A rounded rectangle needs a corner radius no larger than half its shortest side.',
    })
  }
  return issues
}

export function validateWriteAreas(
  surface: LabelSurface,
  areas: WriteInArea[],
  labelId: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const jarredAreas = areas.filter((area) => area.purpose === 'jarred-date')
  if (jarredAreas.length !== 1) {
    issues.push({
      severity: 'error',
      code: 'MISSING_WRITE_AREA',
      labelId,
      path: `labels.${labelId}.writeInAreas`,
      message: 'A generator-conformant label must declare exactly one jarred-date writing area.',
      recovery: 'Add one integrated light writing surface and its normalized geometry.',
    })
  }

  for (const area of areas) {
    if (!isWriteAreaInsideSurface(area.geometry, surface)) {
      issues.push({
        severity: 'error',
        code: 'WRITE_AREA_OUTSIDE_TRIM',
        labelId,
        path: `labels.${labelId}.writeInAreas.${area.id}.geometry`,
        message: `Writing area ${area.id} crosses the trimmed label boundary.`,
        recovery: 'Move or resize the writing surface so all of it stays inside the trim shape.',
      })
    }
    if (!area.background.integratedInArtwork) {
      issues.push({
        severity: 'warning',
        code: 'WRITE_SURFACE_VISUAL_REVIEW_NEEDED',
        labelId,
        path: `labels.${labelId}.writeInAreas.${area.id}.background`,
        message: 'The writing area is not declared as integrated into the artwork.',
        recovery: 'Regenerate the art with a light, low-texture writing surface.',
      })
    }
  }
  return issues
}

export function isWriteAreaInsideSurface(
  geometry: NormalizedWriteAreaGeometry,
  surface: LabelSurface,
): boolean {
  const points = sampleGeometryPerimeter(geometry)
  return points.every((point) => pointInsideSurface(point, surface))
}

function pointInsideSurface(point: Point, surface: LabelSurface): boolean {
  if (point.x < -EPSILON || point.x > 1 + EPSILON || point.y < -EPSILON || point.y > 1 + EPSILON) {
    return false
  }
  if (surface.shape === 'circle' || surface.shape === 'oval') {
    const dx = (point.x - 0.5) / 0.5
    const dy = (point.y - 0.5) / 0.5
    return dx * dx + dy * dy <= 1 + EPSILON
  }
  if (surface.shape === 'rounded-rectangle') {
    const radiusX = Math.min(0.5, (surface.cornerRadius ?? 0) / surface.finishedSize.width)
    const radiusY = Math.min(0.5, (surface.cornerRadius ?? 0) / surface.finishedSize.height)
    if (radiusX <= 0 || radiusY <= 0) return true
    const nearestX = Math.min(Math.max(point.x, radiusX), 1 - radiusX)
    const nearestY = Math.min(Math.max(point.y, radiusY), 1 - radiusY)
    const dx = point.x - nearestX
    const dy = point.y - nearestY
    return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1 + EPSILON
  }
  return true
}

function sampleGeometryPerimeter(geometry: NormalizedWriteAreaGeometry): Point[] {
  const center = { x: geometry.x + geometry.width / 2, y: geometry.y + geometry.height / 2 }
  const rotation = ((geometry.rotationDegrees ?? 0) * Math.PI) / 180
  const points: Point[] = []

  if (geometry.shape === 'oval') {
    for (let index = 0; index < 32; index += 1) {
      const angle = (index / 32) * Math.PI * 2
      points.push({
        x: center.x + Math.cos(angle) * geometry.width * 0.5,
        y: center.y + Math.sin(angle) * geometry.height * 0.5,
      })
    }
  } else if (geometry.shape === 'rounded-rectangle') {
    const radius = Math.min(
      geometry.cornerRadius ?? 0,
      geometry.width / 2,
      geometry.height / 2,
    )
    if (radius > 0) {
      const cornerCenters = [
        { x: geometry.x + geometry.width - radius, y: geometry.y + radius, start: -Math.PI / 2 },
        { x: geometry.x + geometry.width - radius, y: geometry.y + geometry.height - radius, start: 0 },
        { x: geometry.x + radius, y: geometry.y + geometry.height - radius, start: Math.PI / 2 },
        { x: geometry.x + radius, y: geometry.y + radius, start: Math.PI },
      ]
      for (const corner of cornerCenters) {
        for (let index = 0; index <= 8; index += 1) {
          const angle = corner.start + (index / 8) * (Math.PI / 2)
          points.push({ x: corner.x + Math.cos(angle) * radius, y: corner.y + Math.sin(angle) * radius })
        }
      }
    }
  }

  if (points.length === 0) {
    points.push(
      { x: geometry.x, y: geometry.y },
      { x: geometry.x + geometry.width, y: geometry.y },
      { x: geometry.x + geometry.width, y: geometry.y + geometry.height },
      { x: geometry.x, y: geometry.y + geometry.height },
    )
  }

  if (Math.abs(rotation) < EPSILON) return points
  return points.map((point) => {
    const dx = point.x - center.x
    const dy = point.y - center.y
    return {
      x: center.x + dx * Math.cos(rotation) - dy * Math.sin(rotation),
      y: center.y + dx * Math.sin(rotation) + dy * Math.cos(rotation),
    }
  })
}
