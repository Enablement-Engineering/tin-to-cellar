// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { webcrypto } from 'node:crypto'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ImportedCellarLabel } from '../../lib/cellarpack/types'
import { GallerySubmission } from './GallerySubmission'
import { buildDraft, ACKNOWLEDGEMENT } from './draft'
import { GalleryBrowse } from './GalleryBrowse'
vi.mock('./Turnstile', () => ({ Turnstile: ({ onToken }: { onToken: (token: string) => void }) => <button onClick={() => onToken('challenge')}>Verify test submission</button> }))
const sha = '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81'
function fixture(id = 'one'): ImportedCellarLabel {
  return { id, issues: [], artwork: { data: new Uint8Array([1,2,3]).buffer, mediaType: 'image/png', pixelWidth: 825, pixelHeight: 825, asset: { path: 'private-filename.png', mediaType: 'image/png', pixelWidth: 825, pixelHeight: 825, sha256: sha, colorSpace: 'sRGB', alpha: false } }, label: { id, maker: 'Private maker', blend: `Blend ${id}`, artworkAssetId: 'private-file', extensions: { secret: 'DO NOT SHARE' }, surface: { shape: 'circle', finishedSize: { width: 2.5, height: 2.5, unit: 'in' }, bleed: { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' }, safeInset: { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' } }, writeInAreas: [{ id: 'date', purpose: 'jarred-date', geometry: { shape: 'rectangle', x: .35, y: .6, width: .3, height: .1 }, background: { integratedInArtwork: true, appearance: 'PRIVATE' }, overlay: { mode: 'blank' } }], research: { status: 'limited', observedPackage: { format: 'tin', variant: 'PRIVATE', variantDateOrEdition: 'PRIVATE' }, visualAnalysis: { palette: [], motifs: [], border: '', typography: '', hierarchy: '', style: '' }, adaptationSummary: 'DO NOT SHARE', sources: [{ type: 'web', id: 'web', role: 'package-appearance', url: 'https://example.com/product', title: 'PRIVATE', notes: 'DO NOT SHARE', retrievedAt: '2026-01-01' }, { type: 'user-provided', id: 'private', role: 'package-appearance', description: 'DO NOT SHARE', receivedAt: '2026-01-01' }] } } }
}
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); URL.createObjectURL = vi.fn(() => 'blob:local'); URL.revokeObjectURL = vi.fn() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); history.replaceState({}, '', '/') })
const config = { intake: true, serving: true, turnstileSiteKey: 'test', noticeVersion: '2026-09-06-v2' }
it('searches blends with keyboard suggestions and clears the catalog filter without an edition field', async () => {
  const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/config') ? config : { labels: [], nextCursor: null, serving: true } }))
  vi.stubGlobal('fetch', fetcher)
  render(<GalleryBrowse onAdd={vi.fn()} />)
  const input = await screen.findByRole('combobox', { name: 'Maker or blend' })
  expect(screen.getByText('Find your blends, compare the artwork, and add the designs you want to print. Community designs are ready to use without an AI chat.')).toBeInTheDocument()
  expect(screen.getByText('2.5-inch round labels for jar lids')).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Label shape' })).toBeNull()
  expect(screen.queryByLabelText('Edition')).toBeNull()
  fireEvent.change(input, { target: { value: 'Peterson Nightcap' } })
  expect(screen.queryByRole('button', { name: 'Search' })).toBeNull()
  expect(screen.getByRole('option', { name: /Nightcap.*Peterson/ })).toBeInTheDocument()
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(input).toHaveValue('Peterson — Nightcap')
  await waitFor(() => expect(fetcher.mock.calls.at(-1)?.[0]).toContain('/browse'))
  expect(fetcher.mock.calls.at(-1)?.[0]).not.toContain('edition=')
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(input).toHaveValue('')
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('previews locally, then uploads only explicitly selected artwork and allowlisted metadata', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url, init }); if (url.endsWith('/config')) return { ok: true, json: async () => config }; if (url.endsWith('/submissions')) { const d = JSON.parse(init?.body as string); return { ok: true, json: async () => ({ id: d.submissionId, state: 'reserved' }) } }; return { ok: true, json: async () => ({ id: 'receipt', state: 'pending' }) } })
  vi.stubGlobal('fetch', fetcher)
  render(<GallerySubmission labels={[fixture(), fixture('two')]} />)
  fireEvent.click(await screen.findByLabelText('Share Private maker Blend one'))
  fireEvent.click(screen.getByText('Edit details'))
  expect(screen.getByLabelText('https://example.com/product')).not.toBeChecked()
  expect(calls.filter(call => call.init?.method)).toHaveLength(0)
  fireEvent.click(screen.getByLabelText(ACKNOWLEDGEMENT)); fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Verify test submission' }))
  await screen.findByText(/Submitted for review/)
  const mutations = calls.filter(call => call.init?.method)
  expect(mutations.map(call => call.init?.method)).toEqual(['POST','PUT'])
  const draft = JSON.parse(mutations[0].init?.body as string)
  expect(draft.evidence).toBeUndefined(); expect(draft.image.sha256).toBe(sha)
  expect(JSON.stringify(draft)).not.toContain('DO NOT SHARE'); expect(JSON.stringify(draft)).not.toContain('PRIVATE'); expect(JSON.stringify(draft)).not.toContain('filename'); expect(JSON.stringify(draft)).not.toContain('Blend two')
  expect(mutations[1].init?.body).toEqual(new Uint8Array([1,2,3]).buffer)
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.queryByRole('button', { name: /Save private|Withdraw/i })).toBeNull()
  const authorization = new Headers(mutations[0].init?.headers).get('Authorization') ?? ''
  expect(authorization).toMatch(/^Bearer [a-f0-9]{64}$/)
  expect(document.body.textContent).not.toContain(authorization.replace('Bearer ', ''))
  expect(location.hash).toBe('')
})
it('shares a single label with one confirmation and includes only reference links explicitly selected in details', async () => {
  const drafts: Record<string, unknown>[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/config')) return Response.json(config)
    if (init?.method === 'POST') {
      const draft = JSON.parse(init.body as string)
      drafts.push(draft)
      return Response.json({ id: draft.submissionId, state: 'reserved' })
    }
    return Response.json({ id: 'receipt', state: 'pending' })
  }))
  render(<GallerySubmission labels={[fixture()]} />)
  const confirmation = await screen.findByLabelText(ACKNOWLEDGEMENT)
  const submit = screen.getByRole('button', { name: 'Submit for review' })
  expect(screen.queryByLabelText('Share Private maker Blend one')).toBeNull()
  expect(confirmation).not.toBeChecked()
  expect(submit).toBeDisabled()
  expect(screen.getByText('Edit details').closest('details')).not.toHaveAttribute('open')
  fireEvent.click(screen.getByText('Edit details'))
  const reference = screen.getByLabelText('https://example.com/product')
  expect(reference).not.toBeChecked()
  fireEvent.click(reference)
  fireEvent.change(screen.getByLabelText('Edition, if known'), { target: { value: '2026' } })
  fireEvent.click(screen.getByText('Edit details'))
  expect(drafts).toHaveLength(0)
  fireEvent.click(confirmation)
  expect(drafts).toHaveLength(0)
  fireEvent.click(submit)
  fireEvent.click(await screen.findByRole('button', { name: 'Verify test submission' }))
  await screen.findByText(/Submitted for review\./)
  expect(drafts).toHaveLength(1)
  expect(drafts[0]).toMatchObject({ edition: '2026', evidence: { references: [{ url: 'https://example.com/product' }] } })
  expect(JSON.stringify(drafts[0])).not.toContain('PRIVATE')
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.queryByLabelText(ACKNOWLEDGEMENT)).toBeNull()
  expect(screen.queryByText('Edit details')).toBeNull()
  expect(screen.queryByRole('button', { name: /Submit/ })).toBeNull()
  expect(screen.getByRole('region', { name: 'Submission results' })).toHaveFocus()
})

it('resets the confirmation and optional details when another single label is supplied', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => config }))
  const { rerender } = render(<GallerySubmission labels={[fixture()]} />)
  fireEvent.click(await screen.findByLabelText(ACKNOWLEDGEMENT))
  fireEvent.change(screen.getByLabelText('Edition, if known'), { target: { value: '2026' } })
  rerender(<GallerySubmission labels={[fixture('two')]} />)
  expect(screen.getByLabelText(ACKNOWLEDGEMENT)).not.toBeChecked()
  expect(screen.getByLabelText('Edition, if known')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Submit for review' })).toBeDisabled()
  fireEvent.click(screen.getByLabelText(ACKNOWLEDGEMENT))
  expect(screen.getByRole('button', { name: 'Submit for review' })).toBeEnabled()
})

it('does not confirm an expired reservation or upload artwork and allows a deliberate new submission', async () => {
  const posts: string[] = []
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/config')) return { ok: true, json: async () => config }
    posts.push(JSON.parse(init?.body as string).submissionId)
    return { ok: true, json: async () => ({ id: posts.at(-1), state: 'expired' }) }
  })
  vi.stubGlobal('fetch', fetcher)
  render(<GallerySubmission labels={[fixture()]} />)
  await screen.findByLabelText(ACKNOWLEDGEMENT)
  fireEvent.click(screen.getByLabelText(ACKNOWLEDGEMENT))
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Verify test submission' }))
  await screen.findByText(/This submission is no longer available/)
  expect(screen.queryByText(/Submitted for review\./)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Retry this label' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Submit for review' })).toBeEnabled()
  expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  expect(posts).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Verify test submission' }))
  expect(posts).toHaveLength(2)
  expect(posts[1]).not.toBe(posts[0])
})
it('refuses changed bytes against the imported manifest hash before any reservation', async () => {
  const item = fixture(); item.artwork.data = new Uint8Array([3,2,1]).buffer
  await expect(buildDraft(item, { edition: '', package: 'unknown', variant: 'unknown', description: 'Label', references: [] }, crypto.randomUUID())).rejects.toThrow('no longer matches')
})
it('caps each selection at five while preserving local rendering', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => config }))
  render(<GallerySubmission labels={Array.from({ length: 6 }, (_, i) => fixture(String(i)))} />)
  await screen.findByLabelText('Share Private maker Blend 0')
  for (let i=0;i<5;i++) fireEvent.click(screen.getByLabelText(`Share Private maker Blend ${i}`))
  expect(screen.getByLabelText('Share Private maker Blend 5')).toBeDisabled()
})
it('closed serving does not fetch listings or artwork', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...config, serving: false }) }); vi.stubGlobal('fetch', fetcher)
  render(<GalleryBrowse onAdd={vi.fn()} />)
  await screen.findByText(/Community designs are unavailable for now/)
  expect(fetcher).toHaveBeenCalledOnce(); expect(screen.queryByRole('img')).toBeNull()
})

it('retries an unconfirmed upload with the same reservation ID and capability', async () => {
  let uploads = 0
  const posts: RequestInit[] = []
  const puts: { url: string; init: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/config')) return { ok: true, json: async () => config }
    if (url.endsWith('/submissions')) { posts.push(init!); return { ok: true, json: async () => ({ id: JSON.parse(init?.body as string).submissionId, state: 'reserved' }) } }
    puts.push({ url, init: init! }); uploads++; return { ok: uploads > 1, json: async () => ({ id: 'receipt', state: 'pending' }) }
  }))
  render(<GallerySubmission labels={[fixture()]} />)
  await screen.findByLabelText(ACKNOWLEDGEMENT); fireEvent.click(screen.getByLabelText(ACKNOWLEDGEMENT)); fireEvent.click(screen.getByRole('button', { name: 'Submit for review' })); fireEvent.click(await screen.findByRole('button', { name: 'Verify test submission' }))
  await screen.findByText(/Artwork upload was not confirmed/)
  fireEvent.click(screen.getByRole('button', { name: 'Retry this label' }))
  await screen.findByText(/Submitted for review/)
  expect(posts).toHaveLength(1); expect(puts).toHaveLength(2)
  expect(puts[0]).toEqual(puts[1])
  expect(new Headers(puts[0].init.headers).get('Authorization')).toBe(new Headers(posts[0].headers).get('Authorization'))
  expect(screen.queryByRole('button', { name: 'Verify test submission' })).toBeNull()
})

it.each([false, true])('verifies all five selected labels once and continues after an upload failure: %s', async failFirst => {
  const calls: { url: string; init: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/config')) return Response.json(config)
    calls.push({ url, init: init! })
    if (url.endsWith('/submissions/batch')) {
      const { submissions } = JSON.parse(init!.body as string)
      return Response.json({ submissions: submissions.map((draft: { submissionId: string }) => ({ id: draft.submissionId, state: 'reserved' })) })
    }
    if (failFirst && calls.length === 2) return Response.json({ error: 'storage_unavailable' }, { status: 503 })
    return Response.json({ id: url.split('/').at(-2), state: 'pending' })
  }))
  render(<GallerySubmission labels={Array.from({ length: 6 }, (_, index) => fixture(String(index)))} />)
  await screen.findByLabelText('Share Private maker Blend 0')
  for (let index = 0; index < 5; index++) fireEvent.click(screen.getByLabelText(`Share Private maker Blend ${index}`))
  expect(calls).toHaveLength(0)
  fireEvent.click(screen.getByLabelText(ACKNOWLEDGEMENT))
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
  expect(await screen.findByText('Verify your submission once for all selected labels.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Verify test submission' }))
  await waitFor(() => expect(screen.getAllByText(/Submitted for review\./)).toHaveLength(failFirst ? 4 : 5))
  expect(screen.queryByLabelText('Share Private maker Blend 1')).toBeNull()
  expect(screen.getByLabelText('Share Private maker Blend 5')).not.toBeChecked()
  expect(screen.getByLabelText(ACKNOWLEDGEMENT)).not.toBeChecked()
  expect(calls.map(call => call.init.method)).toEqual(['POST', 'PUT', 'PUT', 'PUT', 'PUT', 'PUT'])
  expect(new Headers(calls[0].init.headers).get('X-Turnstile-Token')).toBe('challenge')
  expect(calls[0].init.body).not.toContain('Blend 5')
  expect(calls[0].init.body).not.toContain('DO NOT SHARE')
  const { submissions } = JSON.parse(calls[0].init.body as string)
  for (const [index, call] of calls.slice(1).entries()) {
    expect(call.url).toBe(`/api/gallery/v1/submissions/${submissions[index].submissionId}/artwork`)
    expect(new Headers(call.init.headers).get('Authorization')).toBe(new Headers(calls[0].init.headers).get('Authorization'))
    expect(new Headers(call.init.headers).get('X-Turnstile-Token')).toBeNull()
  }
  if (failFirst) {
    expect(screen.getByLabelText('Share Private maker Blend 0')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Retry this label' }))
    await waitFor(() => expect(screen.getAllByText(/Submitted for review\./)).toHaveLength(5))
    expect(calls).toHaveLength(7)
    expect(calls[6]).toEqual(calls[1])
    expect(screen.queryByLabelText('Share Private maker Blend 0')).toBeNull()
  }
  expect(screen.queryByRole('button', { name: 'Verify test submission' })).toBeNull()
})

it.each([false, true])('reconciles an uncertain reservation before another check, reservation exists: %s', async exists => {
  const posts: RequestInit[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/config')) return Response.json(config)
    if (init?.method === 'POST') {
      posts.push(init)
      if (posts.length === 1) throw new Error('Connection lost')
      if (!exists && posts.length === 2) return Response.json({ error: 'challenge_required' }, { status: 403 })
      return Response.json({ id: JSON.parse(init.body as string).submissionId, state: 'reserved' })
    }
    return Response.json({ id: url.split('/').at(-2), state: 'pending' })
  }))
  render(<GallerySubmission labels={[fixture()]} />)
  await screen.findByLabelText(ACKNOWLEDGEMENT)
  fireEvent.click(screen.getByLabelText(ACKNOWLEDGEMENT))
  fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Verify test submission' }))
  await screen.findByText('Connection lost')
  fireEvent.click(screen.getByRole('button', { name: 'Retry this label' }))
  if (!exists) fireEvent.click(await screen.findByRole('button', { name: 'Verify test submission' }))
  await screen.findByText(/Submitted for review\./)
  expect(posts).toHaveLength(exists ? 2 : 3)
  expect(posts[1].body).toBe(posts[0].body)
  expect(new Headers(posts[1].headers).get('X-Turnstile-Token')).toBeNull()
  expect(new Headers(posts[1].headers).get('Authorization')).toBe(new Headers(posts[0].headers).get('Authorization'))
})

it('requires another review after metadata corrections before approving a version', async () => {
  const { GalleryAdmin } = await import('./GalleryAdmin')
  const metadata = await buildDraft(fixture(), { edition: '', package: 'unknown', variant: 'unknown', description: 'Label', references: [] }, crypto.randomUUID())
  metadata.tobacco = { catalogId: 'cornell-and-diehl-briar-fox' }
  const receipt = { id: metadata.submissionId, state: 'pending', version: 2, digest: 'review-digest', metadata, expiresAt: '2026-10-01' }
  const actions: RequestInit[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/artwork')) return { ok: true, blob: async () => new Blob(['image']) }
    if (init?.method === 'PATCH') { actions.push(init); return { ok: true, json: async () => ({ ...receipt, version: 3, digest: 'new-digest', metadata: JSON.parse(init.body as string).metadata }) } }
    if (url.includes('?')) return { ok: true, json: async () => ({ submissions: [receipt], nextCursor: null }) }
    return { ok: true, json: async () => receipt }
  }))
  render(<GalleryAdmin />)
  fireEvent.click(await screen.findByRole('button', { name: /pending/ }))
  await screen.findByText('Open full-resolution artwork'); fireEvent.load(document.querySelector('.gallery-review-art')!)
  const approve = screen.getByRole('button', { name: 'Approve and publish' })
  expect(approve).toBeDisabled()
  fireEvent.click(screen.getByLabelText(/I reviewed this artwork/)); expect(approve).toBeEnabled()
  fireEvent.click(screen.getByText('Edit details')); fireEvent.change(screen.getByLabelText('Edition, optional'), { target: { value: 'New edition' } }); expect(approve).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Save corrections' }))
  await screen.findByText('Corrections saved. Review this version before approving.')
  expect(approve).toBeDisabled(); expect(actions[0].body).toContain('"expectedVersion":2')
})

it('explains permanent unsupported artwork without offering an unchanged upload retry', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/config')) return { ok: true, json: async () => config }
    if (url.endsWith('/submissions')) return { ok: true, json: async () => ({ id: JSON.parse(init?.body as string).submissionId, state: 'reserved' }) }
    return { ok: false, status: 400, json: async () => ({ error: 'unsupported_image', detail: 'private server detail must not display' }) }
  }))
  render(<GallerySubmission labels={[fixture()]} />)
  await screen.findByLabelText(ACKNOWLEDGEMENT); fireEvent.click(screen.getByLabelText(ACKNOWLEDGEMENT)); fireEvent.click(screen.getByRole('button', { name: 'Submit for review' })); fireEvent.click(await screen.findByRole('button', { name: 'Verify test submission' }))
  expect(await screen.findByText(/without an embedded ICC profile/)).toHaveTextContent('You can still print this label')
  expect(screen.queryByRole('button', { name: 'Retry this label' })).toBeNull()
  expect(screen.queryByText(/private server detail/)).toBeNull()
  expect(screen.queryByRole('link', { name: /Private status|withdraw/i })).toBeNull()
})

async function openUnpublishedReview() {
  const { GalleryAdmin } = await import('./GalleryAdmin')
  const metadata = await buildDraft(fixture(), { edition: 'Reviewed edition', package: 'tin', variant: 'current', description: 'Reviewed label', references: ['https://example.com/product'] }, crypto.randomUUID())
  metadata.tobacco = { catalogId: 'cornell-and-diehl-briar-fox' }
  const receipt = { id: metadata.submissionId, state: 'unpublished', version: 8, digest: 'stored-approval-digest', metadata, expiresAt: '2026-10-01' }
  const writes: { url: string; init: RequestInit }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/artwork')) return { ok: true, blob: async () => new Blob(['reviewed image']) }
    if (init?.method) {
      writes.push({ url, init })
      // Match the backend's exact expectedVersion-only republish contract.
      const body = JSON.parse(init.body as string)
      if (url.endsWith('/republish') && JSON.stringify(body) === JSON.stringify({ expectedVersion: receipt.version })) return { ok: true, json: async () => ({ ...receipt, state: 'published', version: 9 }) }
      return { ok: false, status: 400, json: async () => ({ error: 'invalid_metadata' }) }
    }
    if (url.includes('?')) return { ok: true, json: async () => ({ submissions: [receipt], nextCursor: null }) }
    return { ok: true, json: async () => receipt }
  }))
  render(<GalleryAdmin />)
  fireEvent.click(await screen.findByRole('button', { name: /unpublished/ }))
  await screen.findByText('Open full-resolution artwork'); fireEvent.load(document.querySelector('.gallery-review-art')!)
  return { writes, receipt }
}

it('republishes the reviewed version using only the expectedVersion backend payload', async () => {
  const { writes, receipt } = await openUnpublishedReview()
  const republish = screen.getByRole('button', { name: 'Republish reviewed version' })
  expect(republish).toBeDisabled()
  fireEvent.click(screen.getByLabelText(/I reviewed this artwork/))
  fireEvent.click(republish)
  await screen.findByRole('button', { name: 'Unpublish now' })
  expect(writes).toHaveLength(1)
  expect(writes[0].url).toBe(`/api/gallery/v1/admin/submissions/${receipt.id}/republish`)
  expect(writes[0].init.method).toBe('POST')
  expect(JSON.parse(writes[0].init.body as string)).toEqual({ expectedVersion: 8 })
})

it('keeps unpublished metadata and correction actions disabled while allowing review', async () => {
  const { writes } = await openUnpublishedReview()
  fireEvent.click(screen.getByText('Edit details')); fireEvent.click(screen.getByText('Source links (1)'))
  for (const label of ['Tobacco match', 'Edition, optional', 'Artwork description, optional', 'Reference 1']) expect(screen.getByLabelText(label)).toBeDisabled()
  for (const name of ['Save corrections', 'Add public reference', 'Remove reference 1']) expect(screen.getByRole('button', { name })).toBeDisabled()
  expect(screen.getByLabelText('Edition, optional')).toHaveValue('Reviewed edition')
  expect(screen.getByLabelText(/I reviewed this artwork/)).toBeEnabled()
  expect(writes).toHaveLength(0)
})
