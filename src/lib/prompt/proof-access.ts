export type ProofLease = { token: string; expiresAt: number; uses: number }
export function proofAccessText(lease: ProofLease | null): string {
  return lease && lease.expiresAt > Date.now()
    ? `\n\n# Hosted proof access\nFor POST https://tintocellar.com/api/labels/proof only, send Authorization: Bearer ${lease.token}. This private allowance permits up to ${lease.uses} checks until ${new Date(lease.expiresAt).toISOString()}, subject to shared limits. Never put it in a URL, ZIP, or request to another host. On 401, 429, or 503, use local guides; do not repeatedly retry. Research and generation happen in this chat as usual.`
    : '\n\n# Proof review mode\nUse local dimensioned guides for this request. Hosted proof access is unavailable for this request; do not call the hosted proof service.'
}
