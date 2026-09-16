// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { UsageInvitation } from './UsageInvitation'
import { PREFERENCE_KEY, PROGRESS_KEY } from '../lib/analytics/preferences'

beforeEach(() => {
  vi.stubGlobal('localStorage', (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window.localStorage)
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ version: 2, demandEnabled: false, workflowEnabled: false, progressEnabled: false })))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('starts collapsed and never treats opening or closing the explanation as permission', () => {
  const { container } = render(<UsageInvitation />)
  const details = container.querySelector('details')!
  expect(details.open).toBe(false)
  details.open = true
  fireEvent(details, new Event('toggle'))
  details.open = false
  fireEvent(details, new Event('toggle'))
  expect(localStorage.getItem(PREFERENCE_KEY)).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

it('saves an explicit yes and moves focus to the change link', () => {
  render(<UsageInvitation />)
  fireEvent.click(screen.getByRole('button', { name: 'Allow usage counts', hidden: true }))
  expect(localStorage.getItem(PREFERENCE_KEY)).toMatch(/^on:/)
  expect(screen.getByRole('status')).toHaveTextContent('allowed when collection is available')
  expect(screen.getByRole('link', { name: 'Change data choices' })).toHaveFocus()
  cleanup()
  const { container } = render(<UsageInvitation />)
  expect(container).toBeEmptyDOMElement()
})

it('saves a refusal, clears progress, and does not invite again', () => {
  localStorage.setItem(PROGRESS_KEY, '[]')
  render(<UsageInvitation />)
  fireEvent.click(screen.getByRole('button', { name: 'No thanks', hidden: true }))
  expect(localStorage.getItem(PREFERENCE_KEY)).toMatch(/^off:/)
  expect(localStorage.getItem(PROGRESS_KEY)).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
  cleanup()
  const { container } = render(<UsageInvitation />)
  expect(container).toBeEmptyDOMElement()
})

it.each(['off', 'off:00000000-0000-0000-0000-000000000000', 'invalid'])('does not repeat an invitation over a saved value %s', value => {
  localStorage.setItem(PREFERENCE_KEY, value)
  expect(render(<UsageInvitation />).container).toBeEmptyDOMElement()
})

it('respects a legacy refusal and changes saved in another tab', () => {
  localStorage.setItem('tin-to-cellar:aggregate-demand', 'off')
  expect(render(<UsageInvitation />).container).toBeEmptyDOMElement()
  cleanup()
  localStorage.clear()
  render(<UsageInvitation />)
  localStorage.setItem(PREFERENCE_KEY, 'off:00000000-0000-0000-0000-000000000000')
  fireEvent(window, new StorageEvent('storage'))
  expect(screen.queryByRole('button', { name: 'Allow usage counts', hidden: true })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Optional usage counts are off')
})

it.each([true, false])('preserves focus appropriately on an external choice when inside=%s', inside => {
  const { container } = render(<><UsageInvitation /><button>Keep working</button></>)
  const working = screen.getByRole('button', { name: 'Keep working' })
  if (inside) container.querySelector('summary')!.focus()
  else working.focus()
  localStorage.setItem(PREFERENCE_KEY, 'off:00000000-0000-0000-0000-000000000000')
  fireEvent(window, new StorageEvent('storage'))
  expect(inside ? screen.getByRole('link', { name: 'Change data choices' }) : working).toHaveFocus()
})

it('keeps an unanswered invitation and its focus during unrelated storage changes', () => {
  const { container } = render(<UsageInvitation />)
  const summary = container.querySelector('summary')!
  summary.focus()
  localStorage.setItem('theme', 'dark')
  fireEvent(window, new StorageEvent('storage', { key: 'theme', newValue: 'dark' }))
  expect(summary).toHaveFocus()
  expect(container.querySelector('details')).toBeInTheDocument()
  expect(localStorage.getItem(PREFERENCE_KEY)).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

it('fails closed with an explanation when saving fails', () => {
  render(<UsageInvitation />)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  fireEvent.click(screen.getByRole('button', { name: 'Allow usage counts', hidden: true }))
  expect(screen.getByRole('status')).toHaveTextContent('Your choice could not be saved')
  expect(screen.getByRole('status')).toHaveTextContent('collection is off')
  expect(fetch).not.toHaveBeenCalled()
})
