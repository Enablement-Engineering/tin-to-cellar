import { useEffect, useRef, useState } from 'react'

export const viewPaths = { labels: '/labels', create: '/labels/create', print: '/labels/print', help: '/labels/help', about: '/about', inspiration: '/inspiration', privacy: '/privacy', gallery: '/gallery', 'gallery-admin': '/admin/gallery' } as const
export type View = keyof typeof viewPaths
function viewFromPath(): View | 'not-found' {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/'
  if (pathname === '/') { window.history.replaceState(window.history.state, '', `/labels${window.location.search}${window.location.hash}`); return 'labels' }
  return (Object.keys(viewPaths) as View[]).find(view => viewPaths[view] === pathname) ?? 'not-found'
}

export function usePublicNavigation() {
  const [view, setView] = useState<View | 'not-found'>(viewFromPath)
  const main = useRef<HTMLElement>(null)
  const previousView = useRef(view)
  useEffect(() => {
    try {
      if (sessionStorage.getItem('tin-to-cellar:instructions-reload-focus') === '1') {
        sessionStorage.removeItem('tin-to-cellar:instructions-reload-focus')
        main.current?.focus({ preventScroll: true })
      }
    } catch { /* Browser storage may be unavailable; loading can still recover. */ }
  }, [])
  const navigate = (next: View) => {
    setView(next)
    if (next === view) { main.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, left: 0 }) }
    if (window.location.pathname !== viewPaths[next] || window.location.hash) window.history.pushState({}, '', viewPaths[next])
  }
  useEffect(() => {
    if (previousView.current !== view) { main.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, left: 0 }); previousView.current = view }
  }, [view])
  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const onPopState = () => setView(viewFromPath())
    window.addEventListener('popstate', onPopState)
    return () => { window.removeEventListener('popstate', onPopState); window.history.scrollRestoration = previousRestoration }
  }, [])

  return { view, navigate, main }
}
