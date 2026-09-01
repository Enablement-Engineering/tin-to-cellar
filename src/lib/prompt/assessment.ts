import type {
  PromptInputAssessment,
  PromptLabelGeometry,
  PromptProjectInput,
  PromptTobacco,
} from './types'

const isNonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export function normalizeTobaccos(
  tobaccos: PromptProjectInput['tobaccos'],
): PromptTobacco[] {
  if (typeof tobaccos === 'string') {
    return tobaccos
      .split(/\r?\n/)
      .map((blend) => blend.trim())
      .filter(Boolean)
      .map((blend) => ({ blend }))
  }

  return (tobaccos ?? []).flatMap((tobacco) => {
    if (typeof tobacco === 'string') {
      const blend = tobacco.trim()
      return blend ? [{ blend }] : []
    }

    const blend = tobacco.blend.trim()
    if (!blend) return []
    return [
      {
        blend,
        ...(isNonEmpty(tobacco.maker) ? { maker: tobacco.maker.trim() } : {}),
        ...(isNonEmpty(tobacco.notes) ? { notes: tobacco.notes.trim() } : {}),
      },
    ]
  })
}

function hasPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function hasCompleteGeometry(
  geometry: PromptProjectInput['geometry'],
): boolean {
  if (isNonEmpty(geometry)) return true
  if (!geometry || typeof geometry === 'string' || !geometry.shape) return false

  const { shape, width, height, diameter } = geometry as PromptLabelGeometry
  if (shape === 'circle') return hasPositiveNumber(diameter) || hasPositiveNumber(width)
  if (shape === 'square') return hasPositiveNumber(width) || hasPositiveNumber(diameter)
  return hasPositiveNumber(width) && hasPositiveNumber(height)
}

export function assessPromptInput(input: PromptProjectInput): PromptInputAssessment {
  const tobaccos = normalizeTobaccos(input.tobaccos)
  const geometryComplete = hasCompleteGeometry(input.geometry)
  const missing: PromptInputAssessment['missing'] = []

  if (tobaccos.length === 0) missing.push('tobaccos')
  if (!geometryComplete) missing.push('geometry')

  const inspiration = (input.inspiration ?? []).filter((item) =>
    typeof item === 'string' ? isNonEmpty(item) : isNonEmpty(item.value),
  )
  const expectedAttachmentNames = inspiration.flatMap((item) => {
    if (typeof item === 'string' || item.kind !== 'attachment') return []
    return [item.value.trim()]
  })

  const nextQuestion =
    missing[0] === 'tobaccos'
      ? 'What tobaccos would you like labels for? Paste one per line; include the maker when you know it.'
      : missing[0] === 'geometry'
        ? 'What finished label shape and size should I design for—for example, a 2.5-inch circle?'
        : null

  return {
    status: missing.length > 0 ? 'needs-input' : 'ready-for-research',
    missing,
    nextQuestion,
    tobaccoCount: tobaccos.length,
    hasCompleteGeometry: geometryComplete,
    hasInspirationReferences: inspiration.length > 0,
    expectedAttachmentNames,
  }
}
