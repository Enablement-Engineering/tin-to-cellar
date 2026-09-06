type FooterPage = 'help' | 'about' | 'inspiration' | 'privacy'

interface SiteFooterProps {
  currentView: string
  onNavigate: (page: FooterPage) => void
}

const pages: { page: FooterPage; label: string }[] = [
  { page: 'help', label: 'How it works' },
  { page: 'privacy', label: 'Privacy' },
  { page: 'about', label: 'About' },
  { page: 'inspiration', label: 'Inspiration' },
]

export function SiteFooter({ currentView, onNavigate }: SiteFooterProps) {
  return <footer className="site-footer screen-only">
    <p className="footer-copyright">© {new Date().getFullYear()} Enablement Engineering</p>
    <nav className="footer-nav" aria-label="About Tin to Cellar">
      {pages.map(({ page, label }) => <a
        key={page}
        href={page === 'help' ? '/labels/help' : `/${page}`}
        aria-current={currentView === page ? 'page' : undefined}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          onNavigate(page)
        }}
      >{label}</a>)}
    </nav>
    <p className="footer-credit">Made with ❤️ by <a href="https://www.enablement.engineering/">Enablement Engineering</a></p>
    <p className="footer-notice">For adults 21+. Personal cellaring only; no resale or commercial packaging. Independent of tobacco brands. No tobacco sold.</p>
  </footer>
}
