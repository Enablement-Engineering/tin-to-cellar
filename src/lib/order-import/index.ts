import { formatTobacco, searchTobaccos, TOBACCO_CATALOG } from '../tobacco-catalog'

export type OrderMatch = { source: string; suggestions: string[] }
const normal = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
const makers = new Set(TOBACCO_CATALOG.map((entry) => normal(entry.maker)))
function clean(line: string): string {
  // Promotions can wrap around price columns, leaving fragments such as “Orde...)”.
  if (/^\s*\(?\s*(?:newbie\s*:|\d+\s*%\s*off\b)/i.test(line) || /(?:\.{2,}|…)\s*\)\s*$/.test(line)) return ''
  return line.replace(/\b(?:quantity|qty|price|sku|reg)\s*:.*$/i, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:[o0]z|ounces?|g|grams?|lbs?)\b.*$/i, '')
    .replace(/^[\s|*#-]+|[\s|]+$/g, '').trim()
}

export function matchOrder(text: string): OrderMatch[] {
  if (text.length > 100_000) throw new Error('This order is too long. Paste just the product list.')
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean)
  const result: OrderMatch[] = []
  const seen = new Set<string>()
  let maker = ''
  for (const line of lines) {
    if (makers.has(normal(line))) { maker = line; continue }
    // OCR sometimes leaves a stray character from an adjacent price column.
    const makerRow = TOBACCO_CATALOG.find((entry) => normal(line).startsWith(normal(entry.maker)) && normal(line).length <= normal(entry.maker).length + 2)
    if (makerRow) { maker = makerRow.maker; continue }
    if (line.length > 160 || /https?:|@|\b(?:tracking|address|subtotal|total|shipping|billing|cleaners|supplies|discount|ordered|order number)\b/i.test(line)) { maker = ''; continue }
    if (line.length < 4 || !/[a-z]/i.test(line) || /:\s*\$?[\d.,\s]*$/.test(line)) continue
    const qualified = maker ? `${maker} ${line}` : line
    const words = ` ${qualified.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
    // Recover complete multiword blend names even when OCR corrupts trailing weights.
    const exactNames = TOBACCO_CATALOG.filter((entry) => {
      const name = entry.blend.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      return name.includes(' ') && words.includes(` ${name} `) && (!maker || entry.maker === maker)
    }).sort((a, b) => b.blend.length - a.blend.length)
    const matches = exactNames.length ? exactNames.slice(0, 4) : searchTobaccos(qualified, 4)
    // Autocomplete is permissive for typing. Receipt fragments need stronger evidence:
    // an isolated word must name a complete blend, not merely resemble part of one.
    const standalone = !maker && !/\s/.test(line.trim())
    const suggestions = matches.filter((entry) => !standalone || normal(entry.blend) === normal(line)).map(formatTobacco)
    if (!suggestions.length) continue
    const identity = normal(qualified)
    if (seen.has(identity)) continue
    seen.add(identity)
    result.push({ source: qualified, suggestions })
    maker = ''
    if (result.length >= 100) break
  }
  return result
}

export async function readOrderPdf(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a PDF smaller than 10 MB.')
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const document = await task.promise
    if (document.numPages > 20) throw new Error('Choose an order with 20 pages or fewer.')
    let text = ''
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      // Preserve visual rows, including maker/name lines split across PDF text runs.
      const rows = new Map<number, { x: number; text: string }[]>()
      for (const item of content.items) {
        if (!('str' in item)) continue
        const y = Math.round(item.transform[5] / 3) * 3
        const row = rows.get(y) ?? []
        row.push({ x: item.transform[4], text: item.str })
        rows.set(y, row)
      }
      text += [...rows.entries()].sort(([a], [b]) => b - a).map(([, row]) => row.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ')).join('\n') + '\n'
      if (text.length > 100_000) throw new Error('This PDF has too much text. Paste just the product list.')
    }
    if (!text.trim()) throw new Error('This PDF appears to be scanned. Paste the product names or extract them in your AI chat for now.')
    return text
  } finally { await task.destroy() }
}
