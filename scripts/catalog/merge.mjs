import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { key, normalizeRecord } from './normalize.mjs'

const files = (await readdir('data/catalog/sources')).filter((name) => name.endsWith('.json') && !name.endsWith('-provenance.json')).sort((a, b) => Number(b === 'seed-verified.json') - Number(a === 'seed-verified.json') || a.localeCompare(b))
const overrides = JSON.parse(await readFile('data/catalog/overrides.json', 'utf8'))
const overrideMap = new Map(overrides.map((item) => [`${key(item.maker)}|${key(item.blend)}`, item]))
const corrections = []
const records = new Map(), excluded = [], merges = []
let rawCount = 0
for (const file of files) {
  const source = JSON.parse(await readFile(`data/catalog/sources/${file}`, 'utf8'))
  if (!Array.isArray(source)) continue
  for (const row of source) {
    rawCount++
    const normalized = normalizeRecord(row)
    if (normalized.excluded) { excluded.push({ file, maker: row.maker, blend: row.blend, reason: normalized.excluded }); continue }
    const entry = normalized.record
    const correction = overrideMap.get(`${key(entry.maker)}|${key(entry.blend)}`)
    if (correction) {
      entry.aliases = [...(entry.aliases ?? []), entry.blend, `${entry.maker} ${entry.blend}`]
      corrections.push({ file, from: `${entry.maker} — ${entry.blend}`, to: `${correction.toMaker} — ${correction.toBlend}`, reason: correction.reason })
      entry.maker = correction.toMaker
      entry.blend = correction.toBlend
    }
    const identity = `${key(entry.maker)}|${key(entry.blend)}`
    const provenance = { url: entry.sourceUrl, reviewedAt: entry.reviewedAt, name: row.rawName ?? row.blend, file }
    if (!records.has(identity)) records.set(identity, { maker: entry.maker, blend: entry.blend, sourceUrl: entry.sourceUrl, reviewedAt: entry.reviewedAt, aliases: [...(entry.aliases ?? [])], sources: [provenance] })
    else {
      const saved = records.get(identity)
      merges.push({ identity, from: row.rawName ?? row.blend, file })
      saved.sources.push(provenance)
      saved.aliases.push(...(entry.aliases ?? []))
      if (saved.blend !== entry.blend) saved.aliases.push(entry.blend)
    }
  }
}
const catalog = [...records.values()].map((entry) => ({ ...entry, aliases: [...new Set(entry.aliases)].filter((alias) => key(alias) !== key(entry.blend)) })).sort((a, b) => a.maker.localeCompare(b.maker) || a.blend.localeCompare(b.blend))
const report = { generatedAt: new Date().toISOString(), sourceFiles: files, rawCount, uniqueCount: catalog.length, makerCount: new Set(catalog.map((entry) => entry.maker)).size, mergeCount: merges.length, excludedCount: excluded.length, correctionCount: corrections.length, excluded, merges, corrections }
await mkdir('data/catalog/reports', { recursive: true })
await writeFile('data/catalog/catalog.json', JSON.stringify(catalog, null, 2) + '\n')
await writeFile('data/catalog/reports/merge.json', JSON.stringify(report, null, 2) + '\n')
await writeFile('src/lib/tobacco-catalog/catalog.json', JSON.stringify(catalog.map(({ sources: _sources, ...entry }) => entry), null, 2) + '\n')
console.log(JSON.stringify({ ...report, merges: undefined, excluded: undefined, corrections: undefined }, null, 2))
