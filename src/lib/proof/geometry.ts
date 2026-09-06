export const MAX_PROOF_BYTES = 8 * 1024 * 1024
export const MAX_PROOF_SIZE = 2048
export type ProofGeometry = { diameter: number; bleed: number; safe: number }
export const DEFAULT_PROOF_GEOMETRY: ProofGeometry = { diameter: 2.5, bleed: 0.125, safe: 0.125 }

export function proofGeometry(params: URLSearchParams): ProofGeometry {
  for (const key of params.keys()) if (!['diameter', 'bleed', 'safe'].includes(key)) throw new Error(`Unsupported parameter: ${key}`)
  const geometry = { ...DEFAULT_PROOF_GEOMETRY }
  for (const key of ['diameter', 'bleed', 'safe'] as const) {
    if (params.has(key)) geometry[key] = Number(params.get(key))
  }
  const { diameter, bleed, safe } = geometry
  if (![diameter, bleed, safe].every(Number.isFinite) || diameter < 0.5 || diameter > 12 || bleed < 0 || bleed > 0.5 || safe <= 0 || safe >= diameter / 2) {
    throw new Error('Invalid geometry: inches required; diameter 0.5–12, bleed 0–0.5, safe greater than zero and less than radius.')
  }
  return geometry
}
