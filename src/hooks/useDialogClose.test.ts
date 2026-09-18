// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useDialogClose } from './useDialogClose'

afterEach(() => { cleanup(); document.body.replaceChildren(); vi.useRealTimers(); vi.unstubAllGlobals() })

function setup(animated = true) {
  vi.useFakeTimers()
  const dialog = document.createElement('dialog')
  dialog.open = true
  const button = document.createElement('button')
  dialog.append(button)
  document.body.append(dialog)
  const preference = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => preference)
  vi.stubGlobal('getComputedStyle', () => ({ animationName: animated ? 'tc-dialog-exit' : 'none' }))
  const close = vi.fn(() => { dialog.open = false })
  const hook = renderHook(() => useDialogClose({ current: dialog }, close))
  const ended = (target: Element = dialog, pseudoElement = '') => {
    target.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName: 'tc-dialog-exit', pseudoElement }))
  }
  return { dialog, button, preference, close, hook, ended }
}

it('closes immediately when motion is disabled or the animation stylesheet is unavailable', () => {
  const { hook, dialog, close } = setup(false)
  act(() => hook.result.current())
  expect(close).toHaveBeenCalledOnce()
  expect(dialog.open).toBe(false)
  expect(dialog.dataset.closing).toBeUndefined()
})

it('retains the modal until its own exit ends and ignores repeat activation', () => {
  const { hook, dialog, button, close, ended } = setup()
  const clicked = vi.fn()
  button.addEventListener('click', clicked)
  act(() => { hook.result.current(); hook.result.current(); button.click() })
  expect(dialog.open).toBe(true)
  expect(close).not.toHaveBeenCalled()
  expect(clicked).not.toHaveBeenCalled()
  act(() => { ended(button); ended(dialog, '::backdrop') })
  expect(close).not.toHaveBeenCalled()
  act(() => ended())
  act(() => vi.runAllTimers())
  expect(close).toHaveBeenCalledOnce()
  expect(dialog.dataset.closing).toBeUndefined()
  button.click()
  expect(clicked).toHaveBeenCalledOnce()
})

it('finishes promptly when reduced motion is enabled during the exit', () => {
  const { hook, preference, close } = setup()
  act(() => hook.result.current())
  act(() => { preference.matches = true; preference.dispatchEvent(new Event('change')) })
  expect(close).toHaveBeenCalledOnce()
  act(() => vi.runAllTimers())
  expect(close).toHaveBeenCalledOnce()
})

it('still closes if the browser never dispatches an animation event', () => {
  const { hook, close } = setup()
  act(() => hook.result.current())
  act(() => vi.advanceTimersByTime(300))
  expect(close).toHaveBeenCalledOnce()
})

it('cancels pending callbacks when navigation unmounts the dialog', () => {
  const { hook, close, dialog, ended } = setup()
  act(() => hook.result.current())
  hook.unmount()
  act(() => { ended(); vi.runAllTimers() })
  expect(close).not.toHaveBeenCalled()
  expect(dialog.dataset.closing).toBeUndefined()
})
