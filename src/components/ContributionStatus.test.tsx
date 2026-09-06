// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ContributionStatus } from './ContributionStatus'
import type { Contribution } from '../lib/contributions'
const contribution: Contribution = { version: 1, submissionId: 'a'.repeat(64), feedback: { format: 'tin-to-cellar/feedback', schemaVersion: '2.0.0', protocolRevision: 3, request: { labelCount: 1, shape: 'circle' }, outcome: 'complete', steps: [], issues: [] }, sources: [] }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('sends only the projected contribution and reports confirmed receipt', async () => {
  const mock = vi.fn().mockResolvedValue(Response.json({ status: 'collected' }))
  vi.stubGlobal('fetch', mock)
  render(<ContributionStatus contribution={contribution} />)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('received'))
  expect(mock).toHaveBeenCalledWith('/api/contributions', expect.objectContaining({ method: 'POST', body: JSON.stringify(contribution) }))
})
it('leaves printing available on collection failure and supports a deliberate retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({ status: 'duplicate' })))
  render(<ContributionStatus contribution={contribution} />)
  expect(await screen.findByRole('button', { name: 'Retry contribution' })).toBeEnabled()
  expect(screen.getByRole('status')).toHaveTextContent('You can still print')
  fireEvent.click(screen.getByRole('button', { name: 'Retry contribution' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('received'))
})
it('does not claim success for an unrelated successful response or submit absent data', async () => {
  const mock = vi.fn().mockResolvedValue(Response.json({ ok: true }))
  vi.stubGlobal('fetch', mock)
  const { rerender } = render(<ContributionStatus contribution={null} />)
  expect(mock).not.toHaveBeenCalled()
  rerender(<ContributionStatus contribution={contribution} />)
  expect(await screen.findByRole('button', { name: 'Retry contribution' })).toBeEnabled()
})
