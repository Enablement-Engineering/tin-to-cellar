import { JSDOM } from 'jsdom'
import { writeFile } from 'node:fs/promises'
const rows = []
let url = 'https://www.gqtobaccos.com/pipe-tobacco/'
for (let page = 0; url && page < 30; page++) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const document = new JSDOM(await response.text()).window.document
  const cards = [...document.querySelectorAll('.card[data-name]')]
  if (!cards.length) throw new Error(`No product cards: ${url}`)
  for (const card of cards) {
    const rawName = card.getAttribute('data-name').trim()
    const split = rawName.split(/\s+-\s*/)
    if (split.length < 2) continue
    const maker = split.shift().trim()
    const blend = split.join(' - ').replace(/\s*-?\s*(?:\d+(?:\.\d+)?\s*(?:g|oz|kg)\s*)?(?:Loose )?Pipe Tobacco.*$/i, '').replace(/\s*-?\s*\d+(?:\.\d+)?\s*(?:g|oz|kg)(?:\s*(?:Tin|Pouch))?$/i, '').trim()
    if (!blend) continue
    rows.push({ maker, blend, rawName, sourceUrl: card.querySelector('.card-title a').href, reviewedAt: new Date().toISOString().slice(0, 10) })
  }
  url = document.querySelector('.pagination-item--next a')?.href
  await new Promise((resolve) => setTimeout(resolve, 300))
}
await writeFile('data/catalog/sources/gq.json', JSON.stringify(rows, null, 2) + '\n')
console.log(`${rows.length} GQ name rows`)
