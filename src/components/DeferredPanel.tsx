import { Component, Suspense, type ReactNode } from 'react'

class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <section className="panel screen-only" role="alert"><p>This part of the app could not load. Your saved labels remain on this device.</p><button type="button" className="button secondary" onClick={() => window.location.reload()}>Reload app</button></section> : this.props.children
  }
}

export function DeferredPanel({ children }: { children: ReactNode }) {
  return <LoadBoundary><Suspense fallback={<p className="field-hint screen-only" role="status">Loading…</p>}>{children}</Suspense></LoadBoundary>
}
