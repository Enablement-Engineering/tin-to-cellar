export type ConfiguratorState = { tobaccos: string; artDirection: string }
export type PrintSettings = { page: number; firstSlot: number; offset: { x: number; y: number } }
export type PrintLabel = {
  id: string
  maker: string
  blend: string
  imageUrl: string
  imageFrame: { left: number; top: number; width: number; height: number }
  writeIn: { x: number; y: number; width: number; height: number; textColor: string; rotationDegrees?: number }
}
export type ImportSummary = {
  status: 'rejected' | 'partial' | 'ready'
  title: string
  labels: PrintLabel[]
  issues: string[]
  quarantined: Array<{ id: string; reason: string }>
}
