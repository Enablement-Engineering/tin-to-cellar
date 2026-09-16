// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DemandPreference } from './DemandPreference'
import { PREFERENCE_KEY } from '../lib/analytics/preferences'

beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ enabled: false }))) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('defaults off, offers a labeled opt-in, and reflects another tab changing the preference', () => {
  render(<DemandPreference />)
  const checkbox = screen.getByRole('checkbox', { name: 'Allow app-action, request-progress, and label-demand counts' })
  expect(checkbox).not.toBeChecked()
  fireEvent.click(checkbox)
  expect(checkbox).toBeChecked()
  expect(localStorage.getItem(PREFERENCE_KEY)).toMatch(/^on:/)
  localStorage.setItem(PREFERENCE_KEY, 'off:00000000-0000-0000-0000-000000000000')
  fireEvent(window, new StorageEvent('storage'))
  expect(checkbox).not.toBeChecked()
})
it('shows collection is off when a preference cannot be saved', () => {
  render(<DemandPreference />)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  fireEvent.click(screen.getByRole('checkbox'))
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Optional usage collection is off for this session')
})
