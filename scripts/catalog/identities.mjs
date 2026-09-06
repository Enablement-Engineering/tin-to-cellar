import { key } from './normalize.mjs'
export const identityKey = (maker, blend) => `${key(maker)}|${key(blend)}`
export function identityIndex(registry) {
  const ids = new Map(), names = new Map(), aliases = new Map()
  for (const entry of registry.entries) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(entry.id) || ids.has(entry.id)) throw Error(`Catalog ID collision: ${entry.id}`)
    ids.set(entry.id, entry)
    for (const name of [entry, ...entry.previousNames]) {
      const k = identityKey(name.maker, name.blend)
      if (names.has(k) && names.get(k) !== entry.id) throw Error(`Catalog name collision: ${k}`)
      names.set(k, entry.id)
    }
  }
  for (const alias of registry.idAliases) {
    if (ids.has(alias.aliasId) || aliases.has(alias.aliasId) || !ids.has(alias.catalogId)) throw Error(`Invalid catalog alias: ${alias.aliasId}`)
    aliases.set(alias.aliasId, alias.catalogId)
  }
  return { ids, names, aliases }
}
export function assignPermanentIds(catalog, registry) {
  const { names, ids } = identityIndex(registry), used = new Set()
  const output = catalog.map(entry => {
    const id = names.get(identityKey(entry.maker, entry.blend))
    if (!id) throw Error(`Register new identity explicitly in data/catalog/identities.json: ${entry.maker} — ${entry.blend}`)
    if (used.has(id)) throw Error(`Multiple active records resolve to ${id}; resolve the merge explicitly`)
    used.add(id)
    const registered = ids.get(id)
    return { ...entry, id, maker: registered.maker, blend: registered.blend,
      aliases: [...new Set([...(entry.aliases ?? []), ...registered.previousNames.map(n => `${n.maker} ${n.blend}`)])] }
  })
  for (const id of ids.keys()) if (!used.has(id)) throw Error(`Registered identity missing from sources: ${id}; do not silently remove catalog entries`)
  return output
}
