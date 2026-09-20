export type { CollectionPrintSettings as PrintSettings } from '../lib/collection/types'
export type PrintLabel = {
  id: string
  maker: string
  blend: string
  imageUrl: string
  imageFrame: { left: number; top: number; width: number; height: number }
}
export type ImportSummary = {
  status: 'rejected' | 'partial' | 'ready'
  title: string
  labels: PrintLabel[]
  issues: string[]
  quarantined: Array<{ id: string; reason: string }>
}
