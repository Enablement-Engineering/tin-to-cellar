export const MAX_PACK_LABELS = 20
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
export type PackChoice = { id: string; maker: string; blend: string }
export function validChoice(value: unknown): value is PackChoice {
  const v = value as PackChoice | null
  return Boolean(v && ID.test(v.id) && typeof v.maker === 'string' && v.maker.length <= 200 && typeof v.blend === 'string' && v.blend.length <= 200)
}
