import { writeFile } from 'node:fs/promises'

const entries = new Map()
for (const collection of ['bulk-tobacco', 'tinned-tobacco', 'consignment-tins']) {
  for (let page = 1; page <= 20; page++) {
    const response = await fetch(`https://4noggins.com/collections/${collection}/products.json?limit=250&page=${page}`)
    if (!response.ok) throw new Error(`4noggins ${collection} page ${page}: ${response.status}`)
    const { products } = await response.json()
    if (!Array.isArray(products)) throw new Error('Unexpected storefront response')
    if (!products.length) break
    for (const item of products) entries.set(item.id, {
      maker: item.vendor, blend: item.title, rawName: item.title,
      sourceUrl: `https://4noggins.com/products/${item.handle}`,
      reviewedAt: new Date().toISOString().slice(0, 10),
      sourceCategory: collection, productType: item.product_type,
    })
    if (products.length < 250) break
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
}
await writeFile('data/catalog/sources/4noggins.json', JSON.stringify([...entries.values()], null, 2) + '\n')
console.log(JSON.stringify({ rows: entries.size, vendors: [...new Set([...entries.values()].map((entry) => entry.maker))] }, null, 2))
