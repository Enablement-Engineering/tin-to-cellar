// A tab-scoped receipt survives reloads and reimports without entering the pack or
// diagnostic payload. Keep at most 100 receipts, for the report retention period.
const key = 'tin-to-cellar:diagnostic-receipts-v1'
const receipts = new Map<string, { token: string; createdAt: number }>()
export function diagnosticCapability(submissionId: string): string {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]')
    if (Array.isArray(saved)) for (const item of saved.slice(-100)) {
      if (item && /^[a-f0-9]{64}$/.test(item.id) && /^[a-f0-9]{64}$/.test(item.token) && typeof item.createdAt === 'number' && item.createdAt > Date.now() - 366 * 86400000) receipts.set(item.id, { token: item.token, createdAt: item.createdAt })
    }
  } catch { /* A blocked storage API still permits same-page retries. */ }
  for (const [id, receipt] of receipts) if (receipt.createdAt <= Date.now() - 366 * 86400000) receipts.delete(id)
  let receipt = receipts.get(submissionId)
  if (!receipt) {
    receipt = { token: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join(''), createdAt: Date.now() }
    receipts.set(submissionId, receipt)
  }
  while (receipts.size > 100) receipts.delete(receipts.keys().next().value!)
  try { sessionStorage.setItem(key, JSON.stringify([...receipts].map(([id, value]) => ({ id, ...value })))) } catch { /* Keep the in-memory receipt. */ }
  return receipt.token
}
