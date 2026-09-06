export type LabelShape =
  | 'circle'
  | 'oval'
  | 'square'
  | 'rectangle'
  | 'rounded-rectangle'
  | 'custom-rectangle'

export type DimensionUnit = 'in' | 'mm' | 'cm'

export type InspirationRole = 'supplement' | 'style-override' | 'composition-reference'

export interface PromptTobacco {
  maker?: string
  blend: string
  notes?: string
}

export interface PromptLabelGeometry {
  shape?: LabelShape
  width?: number
  height?: number
  diameter?: number
  unit?: DimensionUnit
}

export interface PromptInspiration {
  kind: 'url' | 'attachment'
  value: string
  role?: InspirationRole
  tobacco?: string
}

export interface PromptProjectInput {
  websiteUrl?: string
  tobaccos?: string | readonly (string | PromptTobacco)[]
  makerNotes?: string
  geometry?: string | PromptLabelGeometry
  printPreference?: string
  inspiration?: readonly (string | PromptInspiration)[]
  inspirationRole?: InspirationRole
  artDirection?: string
  specUrl?: string
  humanSpecUrl?: string
}

export type MissingPromptField = 'tobaccos' | 'geometry'

export interface PromptInputAssessment {
  status: 'needs-input' | 'ready-for-research'
  missing: MissingPromptField[]
  nextQuestion: string | null
  tobaccoCount: number
  hasCompleteGeometry: boolean
  hasInspirationReferences: boolean
  expectedAttachmentNames: string[]
}
