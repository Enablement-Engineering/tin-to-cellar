import type { InspirationRole } from './types'

export const DEFAULT_SPEC_PATH = '/spec/cellarpack-v1.schema.json'
export const DEFAULT_HUMAN_SPEC_PATH = '/spec/cellarpack-v1.md'
export const CHATGPT_PROMPT_URL = 'https://chatgpt.com/'

export const PROMPT_DEFAULTS = Object.freeze({
  fidelity: 'faithful cellar-label adaptation of the best-supported current package',
  dateField: 'blank light writing surface in the lower portion; website overlay label “JARRED”',
  background: 'opaque',
  colorMode: 'sRGB',
  rasterFormat: 'PNG',
  resolution: '600 PPI target and 300 PPI minimum',
  bleed: '1/8 inch',
  printPreference: 'custom/unspecified',
  inspirationRole: 'supplement' as InspirationRole,
})
