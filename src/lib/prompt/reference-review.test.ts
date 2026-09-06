import { expect, it } from 'vitest'
import { buildCompleteTinToCellarPrompt } from './prompt'

it('requires visible reference approval before automatic generation and preserves selected images', () => {
  const prompt = buildCompleteTinToCellarPrompt({ tobaccos: 'Pirate Kake' })
  for (const rule of [
    'Before any generation, display one actual inspected package image',
    'one batch review and wait for explicit approval',
    'The initial label request is not reference approval',
    'A correction is not approval of the batch',
    'retain approvals for unchanged references',
    'Initial generation must use that exact approved reference, one blend per call',
    'never claim unseen images were shown',
    'Do not repair layout against the rejected reference',
    'After approval, generate, check and deliver automatically',
  ]) expect(prompt).toContain(rule)
  expect(prompt).not.toContain('Then do the work without waiting for a reply.')
})
