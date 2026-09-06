import { JSDOM } from 'jsdom'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

// Public HTML only: no cookies, login, assets, browser execution, or challenge bypass.
const reviewedAt = new Date().toISOString().slice(0, 10)
const source = process.argv[2]
if (!['laudisi', 'wvsmokeshop'].includes(source)) throw new Error('Choose laudisi or wvsmokeshop')
const origin = source === 'laudisi' ? 'https://www.laudisi.com' : 'https://wvsmokeshop.com'
const indexUrl = `${origin}/${source === 'laudisi' ? 'tobaccos.cfm' : 'pipetobacco.aspx'}`
const expand = process.argv.includes('--expand')
const previous = expand ? JSON.parse(await readFile(`data/catalog/sources/${source}-provenance.json`, 'utf8')) : null
const notes = previous?.categories ?? []
const tidy = value => value.replace(/\s+/g, ' ').trim()
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
  const html = await response.text()
  if (/just a moment|verify you are human|cf-chl-/i.test(html)) throw new Error(`Challenge: ${url}`)
  return new JSDOM(html).window.document
}
const index = await get(indexUrl)
const anchors = source === 'laudisi'
  ? [...index.querySelectorAll('.itemBox h2')].map(h => h.closest('a'))
  : [...index.querySelectorAll('h5 a[id$="categoryLink"]')]
const categories = anchors.filter(Boolean).map(a => ({
  maker: tidy(a.textContent).replace(/\s+(?:Pipe\s+)?Tobaccos?(?:\s+in Bulk)?$/i, '').replace(/\s+Tin$/i, ''),
  url: new URL(a.getAttribute('href'), origin).href,
})).filter(c => !/snuff|^blending$/i.test(c.maker))
const makerMap = { 'G.L. Pease': 'G. L. Pease', 'Escudo Navy Deluxe': 'A&C Petersen', 'Germain\'s': 'J. F. Germain & Son', 'Sutliff Premium': 'Sutliff', 'Sutliff Private Stock': 'Sutliff', 'CULT': 'Cult' }
const rows = expand ? JSON.parse(await readFile(`data/catalog/sources/${source}.json`, 'utf8')) : []
const queue = expand ? categories.filter(c => previous.categories.some(n => n.categoryUrl === c.url && n.productRows === 0)) : categories
const visited = new Set()
let consecutiveFailures = 0
for (const category of queue) {
  if (visited.has(category.url)) continue
  if (visited.size >= 300) { notes.push({ stopped: 'Reached 300-page collection bound.' }); break }
  visited.add(category.url)
  await new Promise(resolve => setTimeout(resolve, 900))
  try {
    const doc = await get(category.url)
    consecutiveFailures = 0
    if (source === 'wvsmokeshop') {
      for (const child of doc.querySelectorAll('h5 a[id$="categoryLink"]')) {
        const url = new URL(child.getAttribute('href'), origin).href
        if (new URL(url).origin === origin && !visited.has(url)) queue.push({ maker: category.maker, url })
      }
    }
    const items = source === 'laudisi' ? [...doc.querySelectorAll('h3.prodName')].map(h => h.closest('a')) : [...doc.querySelectorAll('h5 a:not([id$="categoryLink"])')]
    let added = 0
    for (const anchor of items.filter(Boolean)) {
      const original = tidy(anchor.textContent)
      const productUrl = new URL(anchor.getAttribute('href'), category.url).href
      if (new URL(productUrl).origin !== origin || !original) continue
      let blend = original
      if (source === 'wvsmokeshop') {
        const prefix = category.maker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\./g, '\\.?').replace(/\s+/g, '\\s*')
        blend = blend.replace(new RegExp(`^${prefix}\\s*[-:]?\\s*`, 'i'), '')
        blend = blend.replace(/^(?:G\.?\s*L\.?\s*Pease|GL Pease)\s+/i, '')
      }
      blend = blend.replace(/\([^)]*(?:\d\s*(?:oz|g|lb)|tin|pouch|bag)[^)]*\)/gi, '')
        .replace(/\s*[-–]?\s*\d+(?:\.\d+)?\s*(?:oz|g|grams?|lbs?)(?:\s*(?:Tin|Bag|Pouch|Box|Bulk))?\s*$/i, '')
        .replace(/\s*\((?:by the ounce|bulk)\)\s*$/i, '')
      blend = tidy(blend).replace(/\s*[-–:]\s*$/, '')
      if (!blend) blend = category.maker
      rows.push({ maker: makerMap[category.maker] ?? category.maker, blend, sourceUrl: productUrl, reviewedAt })
      added++
    }
    notes.push({ categoryUrl: category.url, maker: category.maker, productRows: added })
    console.log(`${category.maker}: ${added}`)
  } catch (error) {
    notes.push({ categoryUrl: category.url, error: error.message })
    console.log(`Skipped ${category.maker}: ${error.message}`)
    if (++consecutiveFailures >= 3) { notes.push({ stopped: 'Three consecutive failures; no bypass or further requests.' }); break }
  }
}
// Preserve one row per distinct product URL; cross-size/source dedup belongs to merge.
const unique = [...new Map(rows.map(row => [row.sourceUrl, row])).values()]
await mkdir('data/catalog/sources', { recursive: true })
await writeFile(`data/catalog/sources/${source}.json`, `${JSON.stringify(unique, null, 2)}\n`)
await writeFile(`data/catalog/sources/${source}-provenance.json`, `${JSON.stringify({ indexUrl, reviewedAt, rows: unique.length, categories: notes }, null, 2)}\n`)
console.log(`Saved ${unique.length} product-name records.`)
