export const key = (text) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const makers = {
  '4noggins com': '4noggins', '4noggins': '4noggins', 'g l pease': 'G. L. Pease', 'gl pease': 'G. L. Pease',
  'gawith hoggarth': 'Gawith Hoggarth & Co.', 'gawith hoggarth and co': 'Gawith Hoggarth & Co.',
  'a and c petersen': 'A&C Petersen', 'a c petersen': 'A&C Petersen', 'escudo': 'A&C Petersen',
  'esoterica': 'Esoterica Tobacciana', 'esoterica tobacciana': 'Esoterica Tobacciana',
  'j f germain': 'J. F. Germain', 'j f germain and son': 'J. F. Germain',
  'cornell and diehl': 'Cornell & Diehl', 'cornell diehl': 'Cornell & Diehl',
  'dracquer and sons': 'Drucquer & Sons', 'drucquer and sons': 'Drucquer & Sons',
  'gawith and hoggarth': 'Gawith Hoggarth & Co.', 'kohlhasse': 'Kohlhase & Kopp',
  'erik stokkebye 4th generation': '4th Generation', 'half and half': 'Half & Half',
  'a and c peterson': 'A&C Petersen', 'rattrays': "Rattray's", 'ogdens': "Ogden's",
  'smokers pride': "Smoker's Pride", 'smokers haven': "Smoker's Haven", 'f and k cigar': 'F&K',
  'nording': 'Nørding',
}
export function normalizeRecord(row) {
  let maker = (row.maker ?? '').trim().replace(/\s+/g, ' ')
  let blend = (row.blend ?? '').trim().replace(/\s+/g, ' ')
  if (!maker || !blend) return { excluded: 'Missing maker or blend' }
  if (/4noggins\.com\/products\/rincon-de-la-pipa-no-1/.test(row.sourceUrl)) return { excluded: 'Retailer vendor does not establish the maker; retain source for review' }
  if (/\/snuff\//i.test(row.sourceUrl) || /\bsnuff\b/i.test(maker)) return { excluded: 'Snuff, not pipe tobacco' }
  if (/\b(?:sampler|starter kit|gift set|pipe bits|humidor)\b/i.test(`${maker} ${blend}`)) return { excluded: 'Assortment or accessory, not one blend' }
  maker = makers[key(maker)] ?? maker
  if (row.rawName && /4noggins\.com/.test(row.sourceUrl)) {
    if (blend.includes(':')) {
      const statedMaker = blend.slice(0, blend.indexOf(':')).replace(/\s+Bulk\s*$/i, '').trim()
      if (statedMaker !== 'Blending Tobacco') maker = makers[key(statedMaker)] ?? statedMaker
      else return { excluded: 'Generic blending component without identified maker' }
      blend = blend.slice(blend.indexOf(':') + 1).trim()
    }
    else {
      const prefix = row.maker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      blend = blend.replace(new RegExp(`^${prefix}\\s*[-–—]?\\s*`, 'i'), '').trim() || maker
    }
    blend = blend.replace(/\s*-\s*C\s*$/i, '')
    // Remove packaging and lot dates only after an explicit weight. Named editions before it remain.
    blend = blend.replace(/\s+\d+(?:\.\d+|\s+\d+[-/]\d+)?\s*(?:oz|ounce[s]?|g|gr|gram[s]?|kg|lb[s]?)(?:\b|(?=\d))[\s\S]*$/i, '')
    blend = blend.replace(/\s*[-–—]?\s*\b(?:pouch|tin|tinned|bulk)\s*$/i, '').trim()
    if (blend === blend.toUpperCase()) blend = blend.toLowerCase().replace(/(^|[\s/-])([a-z])/g, (_, before, char) => before + char.toUpperCase())
  }
  // Other collectors already separate maker and product; remove repeated display prefixes and packaging suffixes.
  const escaped = maker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  blend = blend.replace(new RegExp(`^${escaped}\\s*:\\s*`, 'i'), '')
  blend = blend.replace(/\s+(?:Pipe Tobacco|Tobacco|Pouches?|BULK|Tinned|Tin)(?:\s*\(\d+ Pack\))?$/i, '')
    .replace(/\s*\((?:Bulk|Tin|Pouch)\)\s*$/i, '').replace(/\s+-\s*$/, '').trim()
  if (/^(?:Bulk|Tin|Pouch|Pipe Tobacco)$/i.test(blend)) blend = maker
  blend = blend.replace(/\s+/g, ' ').trim()
  if (!blend) return { excluded: 'Empty name after packaging removal' }
  return { record: { ...row, maker, blend } }
}
