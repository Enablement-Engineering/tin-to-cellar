import type { InspirationRole } from './types'


export const PROMPT_DEFAULTS = Object.freeze({
  fidelity: 'faithful cellar-label adaptation of the best-supported current package',
  dateField: 'blank light writing surface integrated into the artwork in the lower portion, with no words or writing line',
  background: 'opaque',
  colorMode: 'sRGB',
  rasterFormat: 'PNG',
  resolution: '600 PPI target and 300 PPI minimum',
  bleed: '1/8 inch',
  printPreference: 'custom/unspecified',
  inspirationRole: 'supplement' as InspirationRole,
})
