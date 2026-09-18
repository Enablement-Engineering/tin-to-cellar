import { useEffect, useRef, useState } from 'react'
import { demandPreference, setDemandPreference, subscribeDemandPreference, shouldOfferUsageChoice } from '../lib/usage-preferences'
import '../styles/usage-invitation.css'

export function UsageInvitation() {
  const [visible] = useState(shouldOfferUsageChoice)
  const [preference, setPreference] = useState(demandPreference)
  const [offered, setOffered] = useState(shouldOfferUsageChoice)
  const [answered, setAnswered] = useState(false)
  const invitation = useRef<HTMLDetailsElement>(null)
  const changeLink = useRef<HTMLAnchorElement>(null)
  useEffect(() => subscribeDemandPreference(() => {
    const nextPreference = demandPreference(), nextOffered = shouldOfferUsageChoice()
    if ((!nextOffered || nextPreference.storageFailed) && invitation.current?.contains(document.activeElement)) setAnswered(true)
    setPreference(nextPreference)
    setOffered(nextOffered)
  }), [])
  useEffect(() => { if (answered) changeLink.current?.focus({ preventScroll: true }) }, [answered])
  if (!visible) return null
  const choose = (allowed: boolean) => {
    setPreference(setDemandPreference(allowed))
    setAnswered(true)
  }
  if (answered || !offered || preference.storageFailed) return <div className="usage-invitation usage-invitation-receipt screen-only">
    <p role="status">{preference.storageFailed ? 'Your choice could not be saved. Optional usage collection is off for this session.' : preference.allowed ? 'Usage counts allowed when collection is available.' : 'Optional usage counts are off.'}</p>
    <a ref={changeLink} href="/privacy">Change data choices</a>
  </div>
  return <details ref={invitation} className="usage-invitation screen-only">
    <summary>Help improve Tin to Cellar <span>Optional usage counts</span></summary>
    <div className="usage-invitation-content">
      <p>Share counts of app actions and problems, requested catalog blends and print quantities, and progress from copying instructions to printing. These counts exclude your files, prompts and AI chats.</p>
      <p>Progress matching stays on this device for up to 30 days; only the starting week, milestone and broad elapsed time are sent. Counts are combined on our Cloudflare-hosted service and reports cover the latest 365 days.</p>
      <p>Off until you choose. You can turn this off in Privacy and data choices. Collection may not yet be available.</p>
      <div className="usage-invitation-actions">
        <button type="button" className="button secondary" onClick={() => choose(true)}>Allow usage counts</button>
        <button type="button" className="button secondary" onClick={() => choose(false)}>No thanks</button>
        <a href="/privacy">Privacy details</a>
      </div>
    </div>
  </details>
}
