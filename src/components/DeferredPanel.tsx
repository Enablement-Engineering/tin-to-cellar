import { Component, Suspense, type ReactNode } from 'react'
import { appRecovery, isModuleLoadFailure } from '../lib/app-recovery'
import { useAppRecovery } from '../hooks/useAppRecovery'

function LoadFailure({ moduleFailure }: { moduleFailure: boolean }) {
  const { blocked } = useAppRecovery()
  const admin = ['admin.tintocellar.com', 'admin-staging.tintocellar.com'].includes(window.location.hostname)
  return <section className="panel screen-only" role="alert">
    <p>{moduleFailure ? 'This part of the app could not download. Your saved labels remain on this device.' : 'This part of the app encountered an error. Your saved labels remain on this device.'}</p>
    {admin ? <><p>Reloading will discard any unsaved review changes.</p><button type="button" className="button secondary" onClick={() => window.location.reload()}>Reload app</button></>
      : moduleFailure ? <p>Use the app recovery controls to check for an update.</p>
      : <><p>{blocked}</p><button type="button" className="button secondary" disabled={Boolean(blocked)} onClick={() => appRecovery.refresh()}>Reload app</button></>}
  </section>
}

class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean; moduleFailure: boolean }> {
  state = { failed: false, moduleFailure: false }
  static getDerivedStateFromError(error: unknown) { return { failed: true, moduleFailure: isModuleLoadFailure(error) } }
  componentDidCatch(error: unknown) { appRecovery.report(error) }
  render() {
    return this.state.failed ? <LoadFailure moduleFailure={this.state.moduleFailure} /> : this.props.children
  }
}

export function DeferredPanel({ children }: { children: ReactNode }) {
  return <LoadBoundary><Suspense fallback={<p className="field-hint screen-only" role="status">Loading…</p>}>{children}</Suspense></LoadBoundary>
}
