import identities from "./identities.json"
import catalog from './catalog.json'

export type TobaccoEntry = { id: string; maker: string; blend: string; sourceUrl: string; aliases?: string[] }

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

const makerAliases: Record<string, string[]> = {
  'Cornell & Diehl': ['C&D', 'CD', 'Cornell Diehl'],
  'G. L. Pease': ['GL Pease', 'GLP', 'G L Pease'],
}

export function formatTobacco(entry: Pick<TobaccoEntry, 'maker' | 'blend'>): string {
  return `${entry.maker} — ${entry.blend}`
}

export const TOBACCO_CATALOG: readonly TobaccoEntry[] = catalog

const indexed = TOBACCO_CATALOG.map((entry) => {
  const aliases = [...(entry.aliases ?? []), ...(makerAliases[entry.maker] ?? [])]
  const fields = [entry.blend, formatTobacco(entry), ...aliases, ...aliases.map((alias) => `${alias} ${entry.blend}`)].map(normalize)
  return { entry, fields, words: [...new Set(fields.flatMap((field) => field.split(' ')))] }
})

// Short adjacent transpositions and misspellings can suggest a name, never select it.
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) rows[i][0] = i
  for (let j = 0; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]))
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1)
  }
  return rows[a.length][b.length]
}

export function searchTobaccos(query: string, limit = 8): TobaccoEntry[] {
  const needle = normalize(query)
  if (!needle || !Number.isFinite(limit) || limit <= 0) return []
  const tokens = needle.split(' ')
  return indexed.flatMap(({ entry, fields, words }) => {
    if (fields[0] === needle) return [{ entry, score: 0 }]
    if (fields.some((field) => field.startsWith(needle))) return [{ entry, score: 10 }]
    if (fields.some((field) => field.includes(needle))) return [{ entry, score: 20 }]
    let score = 30
    for (const token of tokens) {
      if (words.some((word) => word.startsWith(token))) continue
      const tolerance = token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0
      if (!tolerance) return []
      const best = Math.min(...words.filter((word) => Math.abs(word.length - token.length) <= tolerance).map((word) => distance(token, word)))
      if (best > tolerance) return []
      score += best * 10
    }
    return [{ entry, score }]
  }).sort((a, b) => a.score - b.score || a.entry.blend.localeCompare(b.entry.blend) || a.entry.maker.localeCompare(b.entry.maker))
    .slice(0, Math.min(50, Math.floor(limit))).map(({ entry }) => entry)
}

const catalogById = new Map(TOBACCO_CATALOG.map(entry => [entry.id, entry]))
const historicalIds = new Map((identities.idAliases as {aliasId: string; catalogId: string}[]).map(alias => [alias.aliasId, alias.catalogId]))
export function resolveTobaccoId(id: string): TobaccoEntry | undefined { return catalogById.get(historicalIds.get(id) ?? id) }
const exactNames = new Map(identities.entries.flatMap(entry => [entry, ...(entry.previousNames as {maker: string; blend: string}[])].map(name => [normalize(name.maker) + "|" + normalize(name.blend), entry.id] as const)))
export function findExactTobacco(maker: string, blend: string): TobaccoEntry | undefined {
  const id = exactNames.get(normalize(maker) + "|" + normalize(blend))
  return id ? catalogById.get(id) : undefined
}
