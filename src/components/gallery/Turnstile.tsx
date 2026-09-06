import { useEffect, useRef } from 'react'
type Widget = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void }
declare global { interface Window { turnstile?: Widget } }
let loader: Promise<void> | null = null
function load() {
  if (window.turnstile) return Promise.resolve()
  loader ??= new Promise<void>((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.onload = () => resolve(); script.onerror = () => { loader = null; reject(new Error('Verification could not load.')) }; document.head.append(script) })
  return loader
}
export function Turnstile({ siteKey, onToken, onError }: { siteKey: string; onToken: (value: string) => void; onError: (value: string) => void }) {
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => { let active = true; let id: string | undefined; void load().then(() => { if (!active || !element.current || !window.turnstile) return; id = window.turnstile.render(element.current, { sitekey: siteKey, action: 'gallery-submit', callback: onToken, 'expired-callback': () => onToken(''), 'error-callback': () => onError('Verification did not complete. Try again.') }) }).catch(() => onError('Verification could not load. Check your connection and try again.')); return () => { active = false; if (id) window.turnstile?.remove(id) } }, [siteKey, onToken, onError])
  return <div ref={element} aria-label="Sharing verification" />
}
