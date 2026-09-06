// Produces local SQL only. Applying it to a remote database requires separate authorization.
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { identityIndex } from '../catalog/identities.mjs'
const source = await readFile('src/lib/tobacco-catalog/catalog.json', 'utf8')
const catalog = JSON.parse(source), registry = JSON.parse(await readFile('data/catalog/identities.json', 'utf8'))
identityIndex(registry)
const revision = createHash('sha256').update(source).digest('hex')
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const statements = ['PRAGMA foreign_keys = ON;']
for (const entry of catalog) statements.push(`INSERT INTO gallery_tobaccos (id,maker,blend,aliases_json,active,catalog_revision) VALUES (${[entry.id, entry.maker, entry.blend, JSON.stringify(entry.aliases ?? [])].map(quote).join(',')},1,${quote(revision)}) ON CONFLICT(id) DO UPDATE SET maker=excluded.maker,blend=excluded.blend,aliases_json=excluded.aliases_json,active=1,catalog_revision=excluded.catalog_revision;`)
for (const a of registry.idAliases) statements.push(`INSERT INTO gallery_catalog_aliases (alias_id,catalog_id) VALUES (${quote(a.aliasId)},${quote(a.catalogId)}) ON CONFLICT(alias_id) DO UPDATE SET catalog_id=excluded.catalog_id;`)
const output = process.argv[2]
if (!output || output.startsWith('--')) throw Error('Supply a local SQL output path; this command never applies migrations')
await writeFile(output, statements.join('\n') + '\n')
console.log(`Prepared ${catalog.length} catalog rows; revision ${revision}`)
