import { useEffect, useRef, useState } from 'react'
import type { ProofLease } from '../lib/prompt/proof-access'
type Turnstile = { render(container: HTMLElement, options: Record<string, unknown>): string; remove(id: string): void }
declare global { interface Window { turnstile?: Turnstile } }
let loading: Promise<void> | undefined
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve()
  if (!loading) loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => { clearTimeout(timer); script.remove(); loading = undefined; reject(new Error('Verification could not load. Try again or continue without hosted checks.')) }
    const timer = setTimeout(fail, 15000)
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => { clearTimeout(timer); resolve() }
    script.onerror = fail
    document.head.append(script)
  })
  return loading
}

export function ProofAccess({ lease, onChange, onPendingChange }: { lease: ProofLease | null; onChange(lease: ProofLease | null): void; onPendingChange(pending: boolean): void }) {
  const [attempt, setAttempt] = useState(() => lease && lease.expiresAt > Date.now() ? 0 : 1)
  const [message, setMessage] = useState('')
  useEffect(() => { onPendingChange(attempt > 0 && !lease) }, [attempt, lease, onPendingChange])
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!lease) return
    const timer = setTimeout(() => { onChange(null); setMessage('Refreshing print guide access…'); setAttempt(value => value + 1) }, Math.max(0, lease.expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [lease, onChange])
  useEffect(() => {
    if (!attempt) return
    let disposed = false, widget: string | undefined, verifying = false
    const controller = new AbortController()
    const verificationTimer = setTimeout(() => { if (!disposed) { setMessage('Print guides are unavailable. Your AI will make its own guides.'); setAttempt(0) } }, 30000)
    const timer = setTimeout(() => controller.abort(), 15000)
    void (async () => {
      const response = await fetch('/api/proof-access', { signal: controller.signal })
      if (!response.ok) throw new Error('Hosted checks are unavailable. You can still copy your prompt.')
      const config = await response.json() as { siteKey?: string }
      if (!config.siteKey) throw new Error('Hosted checks are unavailable. You can still copy your prompt.')
      await loadTurnstile()
      if (disposed || !container.current) return
      widget = window.turnstile!.render(container.current, {
        appearance: 'interaction-only', sitekey: config.siteKey, action: 'proof-access', theme: 'light', size: 'flexible',
        callback: async (token: string) => {
          if (disposed || verifying) return
          verifying = true; setMessage('Enabling hosted checks…')
          try {
            const result = await fetch('/api/proof-access', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: token, signal: AbortSignal.timeout(15000) })
            const data = await result.json() as ProofLease & { error?: string }
            if (!result.ok || !/^[a-f0-9]{64}$/.test(data.token ?? '') || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now() || data.expiresAt > Date.now() + 86410000 || data.uses !== 60) throw new Error(data.error || 'Could not enable hosted checks.')
            if (!disposed) { onChange(data); setMessage(''); setAttempt(0) }
          } catch (error) { if (!disposed) { setMessage(error instanceof Error ? error.message : 'Verification failed.'); setAttempt(0) } }
        },
        'error-callback': () => { if (!disposed) { setMessage('Verification failed. Your AI will make its own guides.'); setAttempt(0) } },
        'expired-callback': () => { if (!disposed) { setMessage('Verification expired. Your AI will make its own guides.'); setAttempt(0) } },
      })
    })().catch(error => { if (!disposed) { setMessage(error instanceof Error ? error.message : 'Verification unavailable.'); setAttempt(0) } }).finally(() => clearTimeout(timer))
    return () => { disposed = true; clearTimeout(timer); clearTimeout(verificationTimer); controller.abort(); if (widget) window.turnstile?.remove(widget) }
  }, [attempt, onChange])
  return <div className="proof-access">
    <p className="field-hint">{lease ? 'Print guide access is included in your prompt.' : attempt > 0 ? 'Preparing print guides. Complete the Cloudflare check if it appears.' : 'Your AI will make its own print guides.'} <a href="#privacy">Privacy</a></p>
    <div ref={container} />
    {attempt > 0 && <button className="button quiet" type="button" onClick={() => { setAttempt(0); setMessage('Your AI will make its own guides for this request.') }}>Continue without waiting</button>}
    {message && <p className="field-hint">{message}</p>}
  </div>
}
