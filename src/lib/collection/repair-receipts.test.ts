import { describe, expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import JSZip from 'jszip'
import { importCellarPack } from '../cellarpack/importer'
import { contributionFromManifest } from '../contributions'
import { websiteValidation } from '../contributions/validation'
import { buildCellarPackRepairPrompt } from '../prompt'
import { PROTOCOL_REVISION } from '../protocol'
import { createCollection, setReceiptDelivery } from './commands'
import { applyImport, planImport, prepareImport } from './import'
import { assertCollection, verifyCollectionArtwork } from './validation'
import { collectionFixture } from './test-fixtures'

describe('original and repaired import receipts', () => {
  it('distinguishes missing files from repaired files with the same manifest and deduplicates repeat results', async () => {
    const good = await collectionFixture()
    const bad = await importCellarPack(await new JSZip().file('manifest.json', JSON.stringify(good.manifest)).generateAsync({ type: 'arraybuffer' }))
    const originalContribution = await contributionFromManifest(bad.manifest!, websiteValidation('rejected', bad.issues))
    const repairContribution = await contributionFromManifest(good.manifest!, websiteValidation('ready', good.issues))
    expect(originalContribution!.submissionId).toBe(repairContribution!.submissionId)
    expect(originalContribution!.validation).not.toEqual(repairContribution!.validation)
    const candidate = await prepareImport({ ...bad, status: 'rejected' }, { origin: 'local', repairPrompt: 'Restore the missing artwork.', contribution: originalContribution })
    const empty = createCollection()
    const original = applyImport(empty, planImport(empty, candidate))
    original.receipts[0].delivery = 'sent'
    const repaired = await prepareImport(good, { origin: 'local', contribution: repairContribution })
    expect(repaired.receipt.id).not.toBe(candidate.receipt.id)
    expect((await prepareImport(good, { origin: 'local', contribution: repairContribution })).receipt.id).toBe(repaired.receipt.id)
    const merged = applyImport(original, planImport(original, repaired))
    expect(merged.rows).toHaveLength(1)
    expect(merged.receipts).toHaveLength(2)
    expect(merged.receipts[0].repairPrompt).toBe('Restore the missing artwork.')
    expect(merged.receipts[0].issues.some(issue => issue.code === 'MISSING_ARTWORK')).toBe(true)
    expect(merged.receipts[1].repairPrompt).toBe('')
    expect(merged.receipts[1].issues.some(issue => issue.code === 'MISSING_ARTWORK')).toBe(false)
    expect(merged.receipts[1].contribution).toEqual(originalContribution)
    expect(merged.receipts[1].delivery).toBe('sent')
    expect(merged.designs[merged.rows[0].designId!].receiptId).toBe(repaired.receipt.id)
    const repeated = applyImport(merged, planImport(merged, repaired))
    expect(repeated.receipts).toHaveLength(2)
    expect(repeated.rows).toEqual(merged.rows)
    const pending = { ...merged, receipts: merged.receipts.map(receipt => ({ ...receipt, delivery: 'pending' as const })) }
    const delivered = setReceiptDelivery(pending, original.receipts[0].id, 'sent')
    expect(delivered.receipts.map(receipt => receipt.delivery)).toEqual(['sent', 'sent'])
  })

  it('stores the full real pinned repair bundle with thirty maximum-length issues', async () => {
    const issues = Array.from({ length: 30 }, () => ({ code: 'INVALID_MANIFEST_SCHEMA' as const, severity: 'error' as const, labelId: 'l'.repeat(120), message: 'm'.repeat(1000), recovery: 'r'.repeat(1000) }))
    const context = { status: 'known' as const, revision: PROTOCOL_REVISION }
    const repairPrompt = buildCellarPackRepairPrompt(issues, context)
    expect(repairPrompt.length).toBeGreaterThan(100_000)
    expect(repairPrompt.length).toBeLessThan(200_000)
    const result = await collectionFixture()
    const candidate = await prepareImport({ ...result, status: 'partial', issues }, { origin: 'local', protocolContext: context, repairPrompt })
    const empty = createCollection()
    const saved = applyImport(empty, planImport(empty, candidate))
    expect(saved.receipts[0].repairPrompt).toBe(repairPrompt)
    expect(() => assertCollection({ ...saved, receipts: [{ ...saved.receipts[0], repairPrompt: 'x'.repeat(200_001) }] })).toThrow()
  })

  it('accepts genuine cross-realm encoded buffers but rejects tagged lookalikes', async () => {
    const candidate = await prepareImport(await collectionFixture(), { origin: 'local' })
    const empty = createCollection()
    const saved = applyImport(empty, planImport(empty, candidate))
    const design = saved.designs[saved.rows[0].designId!]
    const foreign = runInNewContext('new ArrayBuffer(size)', { size: design.item.artwork.data.byteLength }) as ArrayBuffer
    new Uint8Array(foreign).set(new Uint8Array(design.item.artwork.data))
    expect(foreign instanceof ArrayBuffer).toBe(false)
    design.item.artwork.data = foreign
    expect(() => assertCollection(saved)).not.toThrow()
    await expect(verifyCollectionArtwork(saved)).resolves.toBeUndefined()
    design.item.artwork.data = { byteLength: foreign.byteLength, [Symbol.toStringTag]: 'ArrayBuffer' } as ArrayBuffer
    expect(() => assertCollection(saved)).toThrow()
  })
})
