import { useEffect, useState } from 'react'
import type { Contribution } from '../lib/contributions'
export function ContributionStatus({ contribution }: { contribution: Contribution | null }) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'sending' | 'collected' | 'failed'>('sending')
  useEffect(() => {
    if (!contribution) return
    const controller = new AbortController()
    void fetch('/api/contributions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(contribution),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    }).then(async response => {
      if (!response.ok) throw new Error('Unavailable')
      const result = await response.json() as { status?: string }
      if (!['collected', 'duplicate'].includes(result.status ?? '')) throw new Error('Unexpected response')
      if (!controller.signal.aborted) setStatus('collected')
    }).catch(() => { if (!controller.signal.aborted) setStatus('failed') })
    return () => controller.abort()
  }, [contribution, attempt])
  if (!contribution || status === 'collected') return null
  return <div className="field-hint" role="status">
    {status === 'sending' ? 'Sending AI feedback and package source observations…' : 'Feedback and source collection could not be confirmed. You can still print your labels.'}
    {status === 'failed' && <button className="button quiet" type="button" onClick={() => { setStatus('sending'); setAttempt(value => value + 1) }}>Retry contribution</button>}
  </div>
}
