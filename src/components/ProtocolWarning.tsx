import { collectionFeedback } from '../lib/contributions'
import type { ProtocolContext } from '../lib/protocol'
export function ProtocolWarning({ context, feedback }: { context: ProtocolContext; feedback: unknown }) {
  const report = collectionFeedback(feedback)
  const messages = {
    conflict: 'The pack and its feedback refer to different instructions. Use the original AI chat when requesting repairs.',
    invalid: 'We could not identify the instructions used for this pack. Use the original AI chat when requesting repairs.',
    unknown: 'This pack uses an unrecognized instruction version. Keep the original AI chat for any repairs.',
  }
  const actionable = report?.issues.some(issue => !issue.resolved && ['artwork-fidelity', 'text-legibility', 'write-area', 'geometry'].includes(issue.code))
  if (!['conflict', 'invalid', 'unknown'].includes(context.status) && !actionable) return null
  return <aside className="field-hint screen-only" aria-label="Label review notes">
    {context.status in messages && <p>{messages[context.status as keyof typeof messages]}</p>}
    {actionable && <p>The AI reported an unresolved artwork or layout concern. Inspect the sheet preview and request repairs in the original chat if needed.</p>}
  </aside>
}
