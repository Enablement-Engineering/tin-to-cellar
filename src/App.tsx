import PublicApp from './PublicApp'
import { GalleryAdmin } from './components/gallery/deferred'
import { DeferredPanel } from './components/DeferredPanel'
import { Wordmark } from './components/Wordmark'
import { ThemeControl } from './components/ThemeControl'
import './styles/app.css'
import { lazy, useEffect, useState } from 'react'
const AdminUsage = lazy(() => import('./components/admin/AdminUsage').then(module => ({ default: module.AdminUsage })))

function isGalleryAdminHost(hostname: string): boolean {
  return ['admin.tintocellar.com', 'admin-staging.tintocellar.com'].includes(hostname)
}
export function GalleryAdminShell({ hostname }: { hostname: string }) {
  const usage = window.location.pathname === '/usage'
  const [review, setReview] = useState({ busy: false, dirty: false })
  useEffect(() => {
    if (!review.busy && !review.dirty) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [review])
  const publicSite = hostname === 'admin-staging.tintocellar.com' ? 'https://gallery-staging.tintocellar.com/' : 'https://tintocellar.com/'
  return <div className="app-shell tc-grain">
    <title>{usage ? 'Usage | Tin to Cellar' : 'Review submissions | Tin to Cellar'}</title>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header screen-only"><div className="site-header-inner"><a className="wordmark" href="/" aria-label="Tin to Cellar review home" onClick={e => { if (review.busy) e.preventDefault() }}><Wordmark /></a><nav aria-label="Administration navigation"><a href="/" aria-current={!usage ? 'page' : undefined} onClick={e => { if (review.busy) e.preventDefault() }}>Review</a><a href="/usage" aria-current={usage ? 'page' : undefined} aria-disabled={review.busy || undefined} onClick={e => { if (review.busy) e.preventDefault() }}>Usage</a><a href={publicSite} rel="noreferrer" onClick={e => { if (review.busy) e.preventDefault() }}>Open public site</a></nav><ThemeControl /></div></header>
    <main id="main-content" className="site-main view-gallery-admin" tabIndex={-1}><DeferredPanel>{usage ? <AdminUsage /> : <GalleryAdmin onNavigationState={setReview} />}</DeferredPanel></main>
  </div>
}
function App() { return isGalleryAdminHost(window.location.hostname) ? <GalleryAdminShell hostname={window.location.hostname} /> : <PublicApp /> }
export default App
