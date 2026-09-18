import { useEffect, useState } from 'react'
import { demandPreference, setDemandPreference, subscribeDemandPreference } from '../lib/usage-preferences'
import { pruneProgress } from '../lib/usage-progress-storage'
export function DemandPreference() {
  const [preference, setPreference] = useState(demandPreference)
  useEffect(() => subscribeDemandPreference(() => { setPreference(demandPreference()); pruneProgress() }), [])
  return <div id="data-choices">
    <label><input type="checkbox" checked={preference.allowed} disabled={preference.storageFailed} onChange={event => setPreference(setDemandPreference(event.target.checked))} aria-describedby="aggregate-demand-choice" /> Allow app-action, request-progress, and label-demand counts</label>
    <p id="aggregate-demand-choice">Off until you choose. When collection is enabled, this browser can send the limited counts described above. Uncheck to stop future sends and remove local measurement records. This choice applies only to this site address in this browser. Earlier combined totals cannot be removed individually.</p>
    <p>Import diagnostics and eligible public packaging observations are still shared automatically, as described below. This choice does not turn off hosting or security processing.</p>
    <p>Cloudflare website traffic measurement is not enabled by this control. No website analytics beacon is included.</p>
    {preference.storageFailed && <p role="status">Your preference could not be saved or read. Optional usage collection is off for this session.</p>}
  </div>
}
