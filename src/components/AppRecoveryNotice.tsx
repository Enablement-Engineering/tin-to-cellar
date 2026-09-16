import { useAppRecovery } from '../hooks/useAppRecovery'
import { appRecovery } from '../lib/app-recovery'

export function AppRecoveryNotice() {
  const { phase, blocked, attempted } = useAppRecovery()
  if (phase === 'idle') return null
  const message = phase === 'checking' ? 'Checking whether an app update is available…'
    : phase === 'reloading' ? 'Updating the app. Your saved labels will reopen.'
    : phase === 'offline' ? 'This part of the app could not load while offline. Reconnect, then check again.'
    : phase === 'update' ? attempted ? 'The app still could not load after recovery. You can try a reload when ready.' : 'An app update is available. Your saved labels and saved AI instructions will remain.'
    : phase === 'current' ? 'The app is current, but part of it could not load. Check your connection, then try a reload.'
    : 'The app could not check for updates. Check your connection and try again.'
  const waiting = phase === 'checking' || phase === 'reloading'
  return <section className="panel screen-only" aria-label="App recovery">
    <p role="status">{message}</p>
    {blocked && <p>{blocked}</p>}
    {!waiting && <div className="handoff-actions">
      <button type="button" className="button secondary" onClick={() => void appRecovery.check()}>Check again</button>
      {phase !== 'offline' && <button type="button" className="button secondary" disabled={Boolean(blocked)} onClick={() => appRecovery.refresh()}>Reload app</button>}
      <button type="button" className="button quiet" onClick={appRecovery.dismiss}>Keep using this page</button>
    </div>}
  </section>
}
