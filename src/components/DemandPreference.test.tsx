// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DemandPreference } from './DemandPreference'

beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ enabled: false }))) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('offers a labeled opt-out and reflects another tab changing the preference', () => {
  render(<DemandPreference />)
  const checkbox = screen.getByRole('checkbox', { name: 'Allow aggregate label-demand counts' })
  expect(checkbox).toBeChecked()
  fireEvent.click(checkbox)
  expect(checkbox).not.toBeChecked()
  expect(localStorage.getItem('tin-to-cellar:aggregate-demand')).toBe('off')
  localStorage.setItem('tin-to-cellar:aggregate-demand', 'on')
  fireEvent(window, new StorageEvent('storage'))
  expect(checkbox).toBeChecked()
})
it('shows collection is off when a preference cannot be saved', () => {
  render(<DemandPreference />)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  fireEvent.click(screen.getByRole('checkbox'))
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Demand collection is off for this session')
})
