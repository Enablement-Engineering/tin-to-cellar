import { useEffect, useState } from 'react'
import { demandPreference, setDemandPreference, subscribeDemandPreference } from '../lib/analytics/client'

export function DemandPreference() {
  const [preference, setPreference] = useState(demandPreference)
  useEffect(() => subscribeDemandPreference(() => setPreference(demandPreference())), [])
  return <div>
    <label><input type="checkbox" checked={preference.allowed} disabled={preference.storageFailed} onChange={event => setPreference(setDemandPreference(event.target.checked))} aria-describedby="aggregate-demand-choice" /> Allow counts of blend selections and print requests</label>
    <p id="aggregate-demand-choice">When collection is enabled, this browser can send the limited counts described above. Uncheck to stop sending them. This choice applies only in this browser.</p>
    {preference.storageFailed && <p role="status">Your browser preference could not be saved or read. Demand collection is off for this session.</p>}
  </div>
}
