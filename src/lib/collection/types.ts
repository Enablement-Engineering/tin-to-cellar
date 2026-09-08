import type { ImportedCellarLabel, ValidationIssue } from '../cellarpack/types'
import type { Contribution } from '../contributions'
import type { ProtocolContext } from '../protocol'

export type CollectionOrigin = 'local' | 'gallery' | 'example'
export type CollectionPrintSettings = { page: number; firstSlot: number; offset: { x: number; y: number } }
export type RequestInput = { catalogId: string | null; maker: string; blend: string; edition?: string; notes?: string }
/** designId is active artwork; previousDesignId exists only during a replacement request. */
export type CollectionRow = Required<RequestInput> & { id: string; revision: number; quantity: number; designId: string | null; createRequested: boolean; previousDesignId?: string }
export type CollectionDesign = { id: string; fingerprint: string; item: ImportedCellarLabel; origin: CollectionOrigin; publicationId?: string; receiptId: string }
export type ReceiptDelivery = 'none' | 'pending' | 'sent' | 'failed'
export type ImportReceipt = { id: string; title: string; createdAt: string; protocolContext: ProtocolContext; repairPrompt: string; issues: ValidationIssue[]; quarantined: { id: string; reason: string }[]; contribution: Contribution | null; delivery: ReceiptDelivery; knownGalleryHashes?: string[]; origin?: CollectionOrigin }
export type HandoffTarget = { rowId: string; revision: number; catalogId: string | null; maker: string; blend: string; edition: string; notes: string }
export type CollectionHandoff = { id: string; createdAt: string; targets: HandoffTarget[]; prompt: string; request: string; protocolRevision: string | number; copied: boolean }
export type Collection = { version: 1; id: string; revision: number; rows: CollectionRow[]; designs: Record<string, CollectionDesign>; receipts: ImportReceipt[]; handoff: CollectionHandoff | null; printSettings: CollectionPrintSettings }
export type PrepareImportOptions = { origin: CollectionOrigin; publicationId?: string; receiptId?: string; protocolContext?: ProtocolContext; repairPrompt?: string; contribution?: Contribution | null }
export type ImportCandidate = { receipt: ImportReceipt; designs: CollectionDesign[] }
export type ImportPlanEntry = { designId: string; sourceLabelId: string; matchRowIds: string[]; kind: 'duplicate' | 'fill' | 'choice' | 'add' }
export type ImportPlan = { baseRevision: number; collectionId: string; candidate: ImportCandidate; entries: ImportPlanEntry[] }
export type ImportDecision = { action: 'skip' | 'add' | 'replace'; rowId?: string }
export type ImportDecisions = Record<string, ImportDecision>

export const COLLECTION_LIMITS = { rows: 100, designs: 100, artworkBytes: 45 * 1024 * 1024, metadataBytes: 2 * 1024 * 1024, pixels: 250_000_000, perImagePixels: 64_000_000, perImageSide: 8192 } as const

export class CollectionError extends Error {
  readonly code: 'invalid' | 'capacity' | 'conflict' | 'unavailable'
  constructor(code: CollectionError['code'], message: string) { super(message); this.name = 'CollectionError'; this.code = code }
}
