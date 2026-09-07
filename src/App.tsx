import PublicApp from './PublicApp'
import { GalleryAdmin } from './components/gallery'
import { Wordmark } from './components/Wordmark'
import './styles/app.css'

function isGalleryAdminHost(hostname: string): boolean {
  return ['admin.tintocellar.com', 'admin-staging.tintocellar.com'].includes(hostname)
}
export function GalleryAdminShell({ hostname }: { hostname: string }) {
  const publicSite = hostname === 'admin-staging.tintocellar.com' ? 'https://gallery-staging.tintocellar.com/' : 'https://tintocellar.com/'
  return <div className="app-shell tc-grain">
    <title>Review submissions | Tin to Cellar</title>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header screen-only"><div className="site-header-inner"><a className="wordmark" href="/" aria-label="Tin to Cellar review home"><Wordmark /></a><nav aria-label="Review navigation"><a href={publicSite} rel="noreferrer">Open public site</a></nav></div></header>
    <main id="main-content" className="site-main view-gallery-admin" tabIndex={-1}><GalleryAdmin /></main>
  </div>
}
function App() { return isGalleryAdminHost(window.location.hostname) ? <GalleryAdminShell hostname={window.location.hostname} /> : <PublicApp /> }
export default App
