// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ContributionStatus } from './ContributionStatus'
import type { Contribution } from '../lib/contributions'
import { TOBACCO_CATALOG } from '../lib/tobacco-catalog'
const contribution: Contribution = { version: 1, submissionId: 'a'.repeat(64), feedback: { format: 'tin-to-cellar/feedback', schemaVersion: '0.2.0', protocolRevision: '0.0.14', request: { labelCount: 1, shape: 'circle' }, outcome: 'complete', steps: [], issues: [] }, sources: [] }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })
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

it.each([429, 503])('shows a paused receipt without resending on render (%s)', async status => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ code: 'collection_paused', resetAt: '2099-01-01T00:00:00Z' }, { status }))
  vi.stubGlobal('fetch', fetcher)
  const delivered = vi.fn()
  const { rerender } = render(<ContributionStatus autoSend contribution={contribution} onDelivery={delivered} />)
  expect(await screen.findByRole('button', { name: 'View prepared diagnostics' })).toBeEnabled()
  expect(screen.getByRole('status')).toHaveTextContent('Your labels remain available locally, including printing.')
  expect(screen.getByRole('button', { name: 'Retry contribution' })).toBeDisabled()
  expect(delivered).toHaveBeenCalledExactlyOnceWith('failed')
  rerender(<ContributionStatus autoSend contribution={{ ...contribution }} onDelivery={delivered} />)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('only enables a deliberate retry after the reset time, retaining keyboard focus', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-07T23:59:00Z'))
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ code: 'collection_paused', resetAt: '2026-09-08T00:00:00Z' }, { status: 429 })).mockResolvedValueOnce(Response.json({ status: 'collected' }))
  vi.stubGlobal('fetch', fetcher)
  render(<ContributionStatus autoSend contribution={contribution} />)
  await act(async () => {})
  const retry = screen.getByRole('button', { name: 'Retry contribution' })
  expect(retry).toBeDisabled()
  await act(async () => { vi.advanceTimersByTime(60001) })
  expect(retry).toBeEnabled()
  expect(fetcher).toHaveBeenCalledTimes(1)
  retry.focus()
  fireEvent.click(retry)
  await act(async () => {})
  expect(screen.getByRole('button', { name: 'View shared diagnostics' })).toHaveFocus()
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it.each([undefined, 'invalid'])('allows only a deliberate retry when a pause has no usable reset time (%s)', async resetAt => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ code: 'collection_paused', resetAt }, { status: 503 })))
  vi.stubGlobal('fetch', fetcher)
  render(<ContributionStatus autoSend contribution={contribution} />)
  expect(await screen.findByRole('button', { name: 'Retry contribution' })).toBeEnabled()
  expect(screen.getByRole('status')).toHaveTextContent('Try again after collection resumes.')
  expect(fetcher).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Retry contribution' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole('button', { name: 'Retry contribution' })).toBeEnabled()
})

it('keeps paused process notes local and moves focus to the dialog close control before sharing', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ code: 'collection_paused' }, { status: 429 }))
  vi.stubGlobal('fetch', fetcher)
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  const notes = { format: 'tin-to-cellar/retrospective' as const, schemaVersion: '0.1.0' as const, protocolRevision: '0.0.14', capabilities: {}, tools: [], observations: [] }
  render(<ContributionStatus contribution={contribution} delivery="sent" retrospective={notes} />)
  fireEvent.click(screen.getByRole('button', { name: 'View shared diagnostics' }))
  const share = screen.getByRole('button', { name: 'Share process notes' })
  share.focus()
  fireEvent.click(share)
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  expect(await screen.findByRole('button', { name: 'Retry sharing process notes' })).toBeEnabled()
  expect(screen.getByRole('status')).toHaveTextContent('Process note receipt has not been confirmed.')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('does not steal focus when a background contribution completes', async () => {
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve })))
  render(<><button>Keep focus here</button><ContributionStatus autoSend contribution={contribution} /></>)
  const control = screen.getByRole('button', { name: 'Keep focus here' })
  control.focus()
  await act(async () => { finish(Response.json({ status: 'collected' })) })
  expect(control).toHaveFocus()
})

it('filters unfamiliar URLs from a saved retry without altering its saved payload or submission ID', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'collected' }))
  vi.stubGlobal('fetch', fetcher)
  const saved: Contribution = { ...contribution, sources: [{ catalogId: TOBACCO_CATALOG[0].id, url: 'https://public.site/private-person-name', status: 'unverified', package: 'unknown', variant: 'unknown' }] }
  render(<ContributionStatus contribution={saved} />)
  fireEvent.click(screen.getByRole('button', { name: 'Retry contribution' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ submissionId: saved.submissionId, sources: [] })
  expect(saved.sources).toHaveLength(1)
})

it('does not send an empty source-only saved retry after filtering unfamiliar URLs', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const saved: Contribution = { ...contribution, feedback: null, sources: [{ catalogId: TOBACCO_CATALOG[0].id, url: 'https://public.site/private-person-name', status: 'unverified', package: 'unknown', variant: 'unknown' }] }
  render(<ContributionStatus contribution={saved} />)
  fireEvent.click(screen.getByRole('button', { name: 'Retry contribution' }))
  expect(screen.getByRole('status')).toHaveTextContent('No catalog sources are eligible for sharing.')
  expect(screen.queryByRole('button', { name: 'Retry contribution' })).not.toBeInTheDocument()
  expect(fetcher).not.toHaveBeenCalled()
})
