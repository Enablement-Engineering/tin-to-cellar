// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ContributionStatus } from './ContributionStatus'
import type { Contribution } from '../lib/contributions'
const contribution: Contribution = { version: 1, submissionId: 'a'.repeat(64), feedback: { format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '0.0.14', request: { labelCount: 1, shape: 'circle' }, outcome: 'complete', steps: [], issues: [] }, sources: [] }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('restores confirmed and uncertain receipts without resending them', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'duplicate' }))
  vi.stubGlobal('fetch', fetcher)
  const { rerender } = render(<ContributionStatus contribution={contribution} delivery="sent" />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  rerender(<ContributionStatus contribution={{ ...contribution }} delivery="sent" hidden />)
  expect(fetcher).not.toHaveBeenCalled()
  cleanup()
  render(<ContributionStatus contribution={contribution} delivery="pending" />)
  expect(fetcher).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry contribution' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  expect(JSON.parse(fetcher.mock.calls[0][1].body).submissionId).toBe(contribution.submissionId)
})
it('sends only the projected contribution and hides the notice after confirmed receipt', async () => {
  const mock = vi.fn().mockResolvedValue(Response.json({ status: 'collected' }))
  vi.stubGlobal('fetch', mock)
  render(<ContributionStatus autoSend contribution={contribution} />)
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  expect(mock).toHaveBeenCalledWith('/api/labels/contributions', expect.objectContaining({ method: 'POST', body: JSON.stringify(contribution) }))
})
it('leaves printing available on collection failure and supports a deliberate retry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(Response.json({ status: 'duplicate' })))
  render(<ContributionStatus autoSend contribution={contribution} />)
  expect(await screen.findByRole('button', { name: 'Retry contribution' })).toBeEnabled()
  expect(screen.getByRole('status')).toHaveTextContent('You can still print')
  fireEvent.click(screen.getByRole('button', { name: 'Retry contribution' }))
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
})
it('does not claim success for an unrelated successful response or submit absent data', async () => {
  const mock = vi.fn().mockResolvedValue(Response.json({ ok: true }))
  vi.stubGlobal('fetch', mock)
  const { rerender } = render(<ContributionStatus autoSend contribution={null} />)
  expect(mock).not.toHaveBeenCalled()
  rerender(<ContributionStatus autoSend contribution={contribution} />)
  expect(await screen.findByRole('button', { name: 'Retry contribution' })).toBeEnabled()
})
it('keeps process notes local until explicitly shared and does not resubmit when hidden', async () => {
  const mock = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ status: 'collected' })))
  vi.stubGlobal('fetch', mock)
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  const notes = { format: 'tin-to-cellar/retrospective' as const, schemaVersion: '0.1.0' as const, protocolRevision: '0.0.14', capabilities: {}, tools: [], observations: [{ stage: 'proof' as const, kind: 'helped' as const, explanation: '<script>untrusted text</script>' }] }
  const { rerender } = render(<ContributionStatus autoSend contribution={contribution} retrospective={notes} />)
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  expect(mock).toHaveBeenCalledTimes(1)
  expect(mock.mock.calls[0][1].body).not.toContain('untrusted')
  rerender(<ContributionStatus autoSend contribution={contribution} retrospective={notes} hidden />)
  rerender(<ContributionStatus autoSend contribution={contribution} retrospective={notes} />)
  expect(mock).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'View shared diagnostics' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('<script>untrusted text</script>')
  expect(document.querySelector('script')).toBeNull()
  expect(mock).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Share process notes' }))
  await screen.findByRole('button', { name: 'Process notes shared' })
  expect(mock.mock.calls[1][0]).toBe('/api/labels/process-notes')
  expect(JSON.parse(mock.mock.calls[1][1].body)).toEqual({ submissionId: contribution.submissionId, retrospective: notes })
})

it('explains an unconfigured collector without offering retry or claiming diagnostics were shared', async () => {
  const mock = vi.fn().mockResolvedValue(Response.json({ code: 'collection_unconfigured' }, { status: 503 }))
  vi.stubGlobal('fetch', mock)
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  const notes = { format: 'tin-to-cellar/retrospective' as const, schemaVersion: '0.1.0' as const, protocolRevision: '0.0.14', capabilities: {}, tools: [], observations: [] }
  render(<ContributionStatus autoSend contribution={contribution} retrospective={notes} />)
  fireEvent.click(await screen.findByRole('button', { name: 'View prepared diagnostics' }))
  expect(screen.getByRole('status')).toHaveTextContent('Automatic feedback collection is unavailable on this site. This does not affect printing or label submissions.')
  expect(screen.queryByRole('button', { name: 'Retry contribution' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'View shared diagnostics' })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog')).toHaveTextContent('these diagnostics have not been shared')
  expect(screen.getByRole('button', { name: 'Share process notes' })).toBeDisabled()
  expect(mock).toHaveBeenCalledTimes(1)
})
it.each([
  [503, { code: 'temporary_failure' }],
  [500, { code: 'collection_unconfigured' }],
])('keeps retry for other HTTP failure responses (%s)', async (status, body) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status })))
  render(<ContributionStatus autoSend contribution={contribution} />)
  expect(await screen.findByRole('button', { name: 'Retry contribution' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'View prepared diagnostics' })).not.toBeInTheDocument()
})
