import { expect, it } from 'vitest'
import { buildCompleteTinToCellarPrompt } from './prompt'

it('requires visible reference approval before automatic generation and preserves selected images', () => {
  const prompt = buildCompleteTinToCellarPrompt({ tobaccos: 'Pirate Kake' })
  for (const rule of [
    'Before generating the current label, display one actual inspected package image for that tobacco only',
    'Do not present a batch gallery or seek batch reference approval',
    'The initial label request is not reference approval',
    'A correction is not approval',
    'preserve completed labels',
    'Initial generation must use that exact approved reference, one blend per call',
    'never claim unseen images were shown',
    'Do not repair layout against the rejected reference',
    'Complete generation, review, validation and ZIP delivery automatically whenever tools permit',
    'right-click the photo, choose Copy Image, then paste it into this chat and send',
    'Ask for the image itself, not Copy Image Address or a pasted URL',
    'Pasting that matching photo in response to this request confirms the reference; do not ask for a second approval',
    'approval alone does not complete the attachment step',
    'Wait for the current photo, inspect it, and match it to the active blend before generation',
    'A reply such as Continue or looks right without the current photo keeps the attachment request pending',
    'reuse them without asking for duplicate uploads',
    'Do not ask for a collage or all packaging photos in one message',
    'receiving several attachments does not demonstrate selective image-tool access',
    'Stop image calls for the whole batch',
    'Do not describe isolating a panel from a composite or turning the wrong blend into the intended blend as a focused repair',
  ]) expect(prompt).toContain(rule)
  expect(prompt).not.toContain('Then do the work without waiting for a reply.')
})

it('completes each label through proof before researching or surfacing the next tobacco', () => {
  const prompt = buildCompleteTinToCellarPrompt({ tobaccos: 'Adagio\nAutumn Evening\nThree Nuns' })
  for (const rule of [
    'one label from research through proof before starting the next',
    'Do not research, display or request photos for later labels while the current label is unfinished',
    'Once its proof passes, preserve the finished artwork and start research for the next tobacco without asking permission to continue',
    'finish its visual review and dimensioned proof before researching the next blend',
    'No batch research or batch photo handoff',
    "Open and inspect only the current tobacco's sources; defer later tobaccos until their turn",
    'Keep completed labels for one final ZIP after the requested list is processed',
  ]) expect(prompt).toContain(rule)
  for (const staleRule of ['Research may cover the batch', 'Present them together for one batch review', 'Batch research is not batch generation']) expect(prompt).not.toContain(staleRule)
})
