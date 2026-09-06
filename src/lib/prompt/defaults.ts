import type { InspirationRole } from './types'

export const DEFAULT_SPEC_PATH = '/spec/cellarpack-v1.schema.json'
export const DEFAULT_HUMAN_SPEC_PATH = '/spec/cellarpack-v1.md'
export const CHATGPT_PROMPT_URL = 'https://chatgpt.com/'
export const CHATGPT_URL_SAFE_LIMIT = 7000

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
