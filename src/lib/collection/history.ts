import type { Collection, ImportReceipt } from './types'

/** Use app-recorded provenance, never filenames or manifest claims. */
export function isUploadedReceipt(receipt: ImportReceipt, designs: Collection['designs']): boolean {
  if (receipt.origin) return receipt.origin === 'local'
  const linked = Object.values(designs).filter(design => design.receiptId === receipt.id)
  if (linked.some(design => design.origin === 'local')) return true
  if (linked.length || receipt.knownGalleryHashes?.length) return false
  // Older local imports carry diagnostics; examples and in-app gallery imports do not.
  return receipt.contribution !== null
}
