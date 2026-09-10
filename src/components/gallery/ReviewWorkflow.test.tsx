// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GalleryAdmin } from './GalleryAdmin'
import { reviewFixture } from '../../../tests/fixtures/gallery-review'
import type { GalleryReviewRecord } from '../../lib/gallery/types'

const first = () => reviewFixture()
const second = () => reviewFixture('22222222-2222-4222-8222-222222222222', 'Blend B')
const ok = (body: unknown) => ({ ok: true, json: async () => structuredClone(body) })
beforeEach(() => { URL.createObjectURL = vi.fn(() => 'blob:fixture'); URL.revokeObjectURL = vi.fn(); vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { fn(); return 0 }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
function server(records = [first(), second()], failure?: (url: string, init: RequestInit) => unknown) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.endsWith('/thumbnail') || url.endsWith('/artwork')) return { ok: true, blob: async () => new Blob(['image']) }
    if (url.endsWith('/recommendations')) return ok({ recommendations: [] })
    if (url.endsWith('/history')) return ok({ events: [], nextCursor: null })
    const record = records.find(item => url.includes(item.id))
    if (init?.method) {
      const custom = failure?.(url, init); if (custom) return custom
      const body = JSON.parse(init.body as string)
      if (url.endsWith('/approve')) record!.state = 'published'
      else if (url.endsWith('/reject')) record!.state = 'rejected'
      else { record!.metadata = body.metadata; record!.digest = 'updated-digest' }
      record!.version++
      return ok(record)
    }
    if (url.includes('?')) {
      const query = new URL(url, 'http://test').searchParams
      return ok({ submissions: records.filter(item => item.state === query.get('state')), nextCursor: null, counts: { pending: records.filter(item => item.state === 'pending').length, reservedBytes: 0, oldestPendingAt: null } })
    }
    return ok(record)
  }))
  return calls
}
async function openFirst() {
  fireEvent.click(await screen.findByRole('button', { name: /Maker Blend A.*pending/ }))
  await screen.findByText('Open full-resolution artwork')
  fireEvent.load(screen.getByAltText('Blend A artwork'))
}
async function batch() {
  await screen.findByRole('button', { name: /Maker Blend A.*pending/ })
  fireEvent.click(screen.getByLabelText('Select loaded labels, up to 24'))
  fireEvent.click(screen.getByRole('button', { name: 'Review selected (2)' }))
  await screen.findAllByText('Open full-resolution artwork')
  await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2))
  for (const image of screen.getAllByRole('img')) fireEvent.load(image)
}
it('publishes the exact reviewed batch and updates pending counts without repeating successful items', async () => {
  const calls = server(); render(<GalleryAdmin />); await batch()
  const approve = screen.getByRole('button', { name: 'Approve and publish 2 labels' })
  expect(approve).toBeDisabled()
  fireEvent.click(screen.getByLabelText(/I reviewed all 2 labels/)); fireEvent.click(approve)
  await screen.findByText('2 of 2 published.')
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Review selected labels' })).toHaveFocus())
  const posts = calls.filter(call => call.init?.method === 'POST')
  expect(posts).toHaveLength(2)
  expect(posts.map(call => JSON.parse(call.init!.body as string))).toEqual([{ expectedVersion: 2, digest: 'a'.repeat(64) }, { expectedVersion: 2, digest: 'a'.repeat(64) }])
  fireEvent.click(screen.getByRole('button', { name: 'Back to queue' }))
  await screen.findByText('0 awaiting review')
  expect(screen.queryByRole('button', { name: /Maker Blend A.*pending/ })).not.toBeInTheDocument()
})
it('keeps failed batch items for a fresh review and never retries a successful item', async () => {
  const calls = server(undefined, url => url.includes(second().id) ? { ok: false, status: 409, json: async () => ({ error: 'review_changed' }) } : undefined)
  render(<GalleryAdmin />); await batch()
  fireEvent.click(screen.getByLabelText(/I reviewed all 2 labels/)); fireEvent.click(screen.getByRole('button', { name: 'Approve and publish 2 labels' }))
  await screen.findByText('1 of 2 published. Review the remaining results before retrying.')
  expect(screen.getByRole('button', { name: 'Approve and publish 1 label' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Reload remaining label' }))
  await screen.findByText('Open full-resolution artwork')
  expect(screen.queryByRole('heading', { name: 'Maker Blend A' })).not.toBeInTheDocument()
  expect(calls.filter(call => call.init?.method === 'POST' && call.url.includes(first().id))).toHaveLength(1)
})
it('refreshes an uncertain write before offering another batch action', async () => {
  const records = [first(), second()]
  const calls = server(records, url => { if (url.includes(first().id)) { records[0].state = 'published'; records[0].version++; return Promise.reject(new Error('Connection lost')) } })
  render(<GalleryAdmin />); await batch()
  fireEvent.click(screen.getByLabelText(/I reviewed all 2 labels/)); fireEvent.click(screen.getByRole('button', { name: 'Approve and publish 2 labels' }))
  await screen.findByText('Published · status refreshed')
  await screen.findByText('2 of 2 published.')
  expect(calls.filter(call => call.init?.method === 'POST' && call.url.includes(first().id))).toHaveLength(1)
})
it('rejects the selected batch using the visible reason and exact versions', async () => {
  const calls = server(); render(<GalleryAdmin />); await batch()
  fireEvent.change(screen.getByLabelText('Batch rejection reason'), { target: { value: 'duplicate' } })
  fireEvent.click(screen.getByRole('button', { name: 'Reject 2 labels' }))
  await screen.findByText('2 of 2 rejected.')
  expect(calls.filter(call => call.init?.method).map(call => JSON.parse(call.init!.body as string))).toEqual([{ expectedVersion: 2, reason: 'duplicate' }, { expectedVersion: 2, reason: 'duplicate' }])
})
it('retains unsaved corrections across label navigation and excludes them from bulk selection', async () => {
  const calls = server(); render(<GalleryAdmin />); await openFirst()
  fireEvent.click(screen.getByText('Edit details'))
  fireEvent.change(screen.getByLabelText('Edition, optional'), { target: { value: 'Revised edition' } })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByRole('heading', { name: 'Maker Blend B' })
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
  await screen.findByRole('heading', { name: 'Maker Blend A' })
  expect(screen.getByLabelText('Edition, optional')).toHaveValue('Revised edition')
  expect(screen.getByLabelText('Select Maker Blend A')).toBeDisabled()
  expect(calls.filter(call => call.init?.method)).toHaveLength(0)
})
it('advances after approval, removes completed pending rows, and preserves exact review checks', async () => {
  server(); render(<GalleryAdmin />); await openFirst()
  fireEvent.click(screen.getByLabelText(/I reviewed this artwork/)); fireEvent.click(screen.getByRole('button', { name: 'Approve and next' }))
  await screen.findByRole('heading', { name: 'Maker Blend B' })
  expect(screen.queryByRole('button', { name: /Maker Blend A.*pending/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Approve and next' })).toBeDisabled()
  expect(screen.getByText('1 awaiting review')).toBeInTheDocument()
})
it('keeps pagination bound to applied filters, even while the filter form is being edited', async () => {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(url); if (url.endsWith('/thumbnail')) return { ok: false }; return ok({ submissions: [first()], nextCursor: 'old-cursor' }) }))
  render(<GalleryAdmin />)
  await screen.findByRole('button', { name: 'More submissions' })
  fireEvent.change(screen.getByLabelText('Maker or blend'), { target: { value: 'New filter' } })
  fireEvent.click(screen.getByRole('button', { name: 'More submissions' }))
  await waitFor(() => expect(urls.some(url => url.includes('cursor=old-cursor'))).toBe(true))
  expect(urls.find(url => url.includes('cursor=old-cursor'))).not.toContain('search=')
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters / refresh' }))
  await waitFor(() => expect(urls.some(url => url.includes('search=New+filter'))).toBe(true))
  expect(urls.find(url => url.includes('search=New+filter'))).not.toContain('cursor=')
})
it('never approves an artwork that failed to decode', async () => {
  server(); render(<GalleryAdmin />); await openFirst()
  fireEvent.error(screen.getByAltText('Blend A artwork'))
  expect(screen.getByLabelText(/I reviewed this artwork/)).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Approve and publish' })).toBeDisabled()
})
it('prevents selection changes while a decision is in flight', async () => {
  let finish!: (result: unknown) => void
  server(undefined, () => new Promise(resolve => { finish = resolve }))
  render(<GalleryAdmin />); await openFirst()
  fireEvent.click(screen.getByLabelText(/I reviewed this artwork/)); fireEvent.click(screen.getByRole('button', { name: 'Approve and publish' }))
  expect(screen.getByRole('button', { name: /Maker Blend B.*pending/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Operations' })).toBeDisabled()
  finish(ok({ ...first(), state: 'published', version: 3 } satisfies GalleryReviewRecord))
  await waitFor(() => expect(within(screen.getByRole('article', { name: 'Selected submission' })).getByRole('button', { name: 'Unpublish now' })).toBeEnabled())
})
it('allows correcting invalid metadata after a rejected save without losing the draft', async () => {
  server(undefined, () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_metadata' }) }))
  render(<GalleryAdmin />); await openFirst()
  fireEvent.click(screen.getByText('Edit details'))
  fireEvent.change(screen.getByLabelText('Edition, optional'), { target: { value: 'Correction' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }))
  await screen.findByText('The request was not accepted. Your corrections are still here.')
  expect(screen.getByLabelText('Edition, optional')).toBeEnabled()
  expect(screen.getByLabelText('Edition, optional')).toHaveValue('Correction')
  expect(screen.getByRole('button', { name: 'Save corrections' })).toBeEnabled()
})
it('recovers a lost save response when reload confirms those corrections were saved', async () => {
  const records = [first(), second()]
  server(records, (_url, init) => {
    if (init.method === 'PATCH') { records[0].metadata = JSON.parse(init.body as string).metadata; records[0].version++; return Promise.reject(new Error('Connection lost')) }
  })
  render(<GalleryAdmin />); await openFirst()
  fireEvent.click(screen.getByText('Edit details'))
  fireEvent.change(screen.getByLabelText('Edition, optional'), { target: { value: 'Saved despite lost response' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }))
  await screen.findByText('The result could not be confirmed. Reload the submission before another decision.')
  fireEvent.click(screen.getByRole('button', { name: 'Reload submission' }))
  await screen.findByText('Open full-resolution artwork')
  fireEvent.load(screen.getByAltText('Blend A artwork'))
  expect(screen.getByLabelText('Edition, optional')).toHaveValue('Saved despite lost response')
  expect(screen.getByLabelText(/I reviewed this artwork/)).toBeEnabled()
  expect(screen.getByLabelText('Select Maker Blend A')).toBeEnabled()
})
