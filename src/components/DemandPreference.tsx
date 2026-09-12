import { useEffect, useState } from 'react'
import { demandPreference, setDemandPreference, subscribeDemandPreference } from '../lib/analytics/client'

export function DemandPreference() {
  const [preference, setPreference] = useState(demandPreference)
  useEffect(() => subscribeDemandPreference(() => setPreference(demandPreference())), [])
  return <div>
    <label><input type="checkbox" checked={preference.allowed} disabled={preference.storageFailed} onChange={event => setPreference(setDemandPreference(event.target.checked))} aria-describedby="aggregate-demand-choice" /> Allow aggregate label-demand counts</label>
    <p id="aggregate-demand-choice">This preference applies in this browser. When collection is enabled on the site, it allows the limited counts described above. Uncheck it to stop sending them.</p>
    {preference.storageFailed && <p role="status">Your browser preference could not be saved or read. Demand collection is off for this session.</p>}
  </div>
}
