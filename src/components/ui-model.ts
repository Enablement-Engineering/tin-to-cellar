export type LabelShape =
  | 'circle'
  | 'oval'
  | 'square'
  | 'rectangle'
  | 'rounded-rectangle'

export type WriteInMode = 'JARRED' | 'CELLARED' | 'LINE' | 'BLANK'

export type ConfiguratorState = {
  tobaccos: string
  shape: LabelShape
  width: number
  height: number
  bleed: number
  stock: string
  inspirationUrls: string
  plannedFiles: string
  writeInMode: WriteInMode
  artDirection: string
}

export type ResearchSource = {
  id: string
  title: string
  url?: string
  role?: string
  publisher?: string
}

export type WorkbenchLabel = {
  id: string
  maker: string
  blend: string
  imageUrl: string
  imageFrame: { left: number; top: number; width: number; height: number }
  shape: LabelShape
  width: number
  height: number
  writeIn: {
    x: number
    y: number
    width: number
    height: number
    textColor: string
  }
  researchStatus: string
  variant: string
  adaptationSummary: string
  sources: ResearchSource[]
  warnings: string[]
}

export type LabelInstance = {
  instanceId: string
  labelId: string | null
  zoom: number
  x: number
  y: number
}

export type ImportSummary = {
  status: 'rejected' | 'partial' | 'ready'
  title: string
  labels: WorkbenchLabel[]
  issues: string[]
  quarantined: Array<{ id: string; reason: string }>
}

export type Calibration = {
  x: number
  y: number
  scale: number
}
