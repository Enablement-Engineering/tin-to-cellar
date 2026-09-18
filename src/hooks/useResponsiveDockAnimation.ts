import { useEffect, useRef } from 'react'

/** Animate across the sticky-to-fixed breakpoint without changing CSS positioning. */
export function useResponsiveDockAnimation(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!enabled || !element?.animate) return
    const mobile = window.matchMedia('(max-width: 680px)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const isMobile = () => getComputedStyle(element).position === 'fixed'
    let wasMobile = isMobile()
    let previous = element.getBoundingClientRect()
    let animation: Animation | undefined
    const cancel = () => { animation?.cancel(); animation = undefined }
    const onScroll = () => {
      if (!animation && wasMobile === isMobile()) previous = element.getBoundingClientRect()
    }
    const onResize = () => {
      // WebKit may dispatch resize before updating MediaQueryList.matches.
      const nextMobile = isMobile()
      const crossedBreakpoint = wasMobile !== nextMobile
      wasMobile = nextMobile
      // Preserve the visible position if resizing reverses an unfinished move.
      const transform = getComputedStyle(element).transform
      const offsetY = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42
      const fromY = previous.y + offsetY
      const moving = !!animation
      cancel()
      previous = element.getBoundingClientRect()
      if (reducedMotion.matches || (!crossedBreakpoint && !moving)) return
      animation = element.animate([
        { transform: `translateY(${fromY - previous.y}px)` },
        { transform: 'translateY(0)' },
      ], { duration: 280, easing: 'cubic-bezier(.2, .8, .2, 1)' })
      animation.onfinish = () => { animation = undefined; previous = element.getBoundingClientRect() }
    }
    const onMotionChange = () => { cancel(); previous = element.getBoundingClientRect() }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    mobile.addEventListener('change', onResize)
    reducedMotion.addEventListener('change', onMotionChange)
    return () => {
      cancel()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll)
      mobile.removeEventListener('change', onResize)
      reducedMotion.removeEventListener('change', onMotionChange)
    }
  }, [enabled])
  return ref
}
