import { useCallback, useEffect, useRef, type RefObject } from 'react'

/** Keep the native modal and its focus trap alive until its exit finishes. */
export function useDialogClose(dialog: RefObject<HTMLDialogElement | null>, onClose: () => void) {
  const pending = useRef<(() => void) | null>(null)
  useEffect(() => () => pending.current?.(), [])

  return useCallback(() => {
    if (pending.current) return
    const modal = dialog.current
    if (!modal?.open) { onClose(); return }
    modal.setAttribute('data-closing', 'true')
    if (!getComputedStyle(modal).animationName.split(',').some(name => name.trim() === 'tc-dialog-exit')) {
      modal.removeAttribute('data-closing')
      onClose()
      return
    }

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    // Ignore repeat activation while retaining keyboard focus inside the modal.
    const blockActivation = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation() }
    const cleanup = () => {
      window.clearTimeout(timer)
      modal.removeEventListener('animationend', ended)
      modal.removeEventListener('animationcancel', ended)
      modal.removeEventListener('click', blockActivation, true)
      modal.removeEventListener('submit', blockActivation, true)
      preference.removeEventListener('change', changed)
      modal.removeAttribute('data-closing')
      pending.current = null
    }
    const finish = () => { cleanup(); onClose() }
    const ended = (event: AnimationEvent) => {
      if (event.target === modal && !event.pseudoElement && event.animationName === 'tc-dialog-exit') finish()
    }
    const changed = () => { if (preference.matches) finish() }
    // Still dismiss if the browser suppresses animation events, e.g. in a hidden tab.
    const timer = window.setTimeout(finish, 300)
    pending.current = cleanup
    modal.addEventListener('animationend', ended)
    modal.addEventListener('animationcancel', ended)
    modal.addEventListener('click', blockActivation, true)
    modal.addEventListener('submit', blockActivation, true)
    preference.addEventListener('change', changed)
  }, [dialog, onClose])
}
