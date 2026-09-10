// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ImportedCellarLabel } from '../../lib/cellarpack/types'
import { importCellarPack } from '../../lib/cellarpack/importer'
import { buildDraft } from './draft'
import { CuratedIntake } from './CuratedIntake'

vi.mock('../../lib/cellarpack/importer', () => ({ importCellarPack: vi.fn() }))
vi.mock('./draft', async (original) => ({
  ...await original<typeof import('./draft')>(),
  buildDraft: vi.fn(),
}))

const label = (id: string): ImportedCellarLabel => ({
  id,
  label: { maker: 'Maker', blend: id, research: { sources: [], observedPackage: { format: 'tin', variant: 'current', variantDateOrEdition: '' } } },
  artwork: { data: new ArrayBuffer(3), asset: { sha256: id }, mediaType: 'image/png' },
}) as unknown as ImportedCellarLabel
const response = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(buildDraft).mockImplementation(async (item, _choice, submissionId) => ({ submissionId, tobacco: { catalogId: item.id } }) as Awaited<ReturnType<typeof buildDraft>>)
})
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals() })

async function load(labels = [label('first')]) {
  vi.mocked(importCellarPack).mockResolvedValue({
    status: 'ready', manifest: null, labels, quarantinedLabels: [], customSheetProfiles: [], issues: [],
    conformance: { archive: 'conformant', generator: 'conformant', printReady: 'not-evaluated' },
  })
  render(<CuratedIntake />)
  fireEvent.click(screen.getByText('Curated CellarPack intake'))
  const file = new File(['pack'], 'reviewed.zip', { type: 'application/zip' })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(4) })
  fireEvent.change(screen.getByLabelText('Validated CellarPacks'), { target: { files: [file] } })
  await screen.findByText(`${labels.length} unique labels ready from 1 pack.`)
}
function prepare() {
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: /Prepare \d+ community resources/ }))
}

it('keeps pack import local until both review attestation and prepare action', async () => {
  await load()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(buildDraft).not.toHaveBeenCalled()
  const button = screen.getByRole('button', { name: 'Prepare 1 community resources' })
  expect(button).toBeDisabled()
  fireEvent.click(button)
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox'))
  expect(button).toBeEnabled()
  expect(fetchMock).not.toHaveBeenCalled()
  fetchMock.mockResolvedValue(response(200, { id: 'published', state: 'published' }))
  fireEvent.click(button)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 of 1'))
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each([null, { error: 'not_found' }])('does not create a duplicate when reconciliation returns an unknown 404: %j', async (body) => {
  fetchMock.mockResolvedValue(response(404, body))
  await load()
  prepare()
  await screen.findByText(/Published-resource reconciliation failed/)
  expect(screen.getByRole('status')).toHaveTextContent('0 of 1')
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toBe('/api/gallery/v1/admin/reconcile')
})

it('falls back to private intake only for explicit publication_not_found and uploads the validated bytes', async () => {
  fetchMock.mockResolvedValueOnce(response(404, { error: 'publication_not_found' }))
    .mockResolvedValueOnce(response(200, { id: 'reserved', state: 'reserved' }))
    .mockResolvedValueOnce(response(200, { id: 'reserved', state: 'pending' }))
  const item = label('first')
  await load([item])
  prepare()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 of 1'))
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    '/api/gallery/v1/admin/reconcile', '/api/gallery/v1/admin/intake', '/api/gallery/v1/admin/intake/reserved/artwork',
  ])
  expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'PUT', body: item.artwork.data })
})

it('explains that an existing publication remains unchanged until staged review exists', async () => {
  fetchMock.mockResolvedValue(response(503, { error: 'replacement_review_required' }))
  await load()
  prepare()
  await screen.findByText('Maker first: A matching public label already exists. It was left unchanged because staged replacement review is not available yet.')
  expect(screen.getByRole('status')).toHaveTextContent('0 of 1')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('retries unfinished labels without resubmitting a previously published success', async () => {
  fetchMock.mockResolvedValueOnce(response(200, { id: 'existing-first', state: 'published' }))
    .mockResolvedValueOnce(response(503, { error: 'temporarily_unavailable' }))
    .mockResolvedValueOnce(response(200, { id: 'existing-second', state: 'published' }))
  await load([label('first'), label('second')])
  prepare()
  await screen.findByText(/Published-resource reconciliation failed/)
  const retry = screen.getByRole('button', { name: 'Retry 1 unfinished labels' })
  await waitFor(() => expect(retry).toBeEnabled())
  fireEvent.click(retry)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 of 2'))
  expect(fetchMock).toHaveBeenCalledTimes(3)
  const catalogIds = fetchMock.mock.calls.map(([, init]) => JSON.parse((init.body as FormData).get('metadata') as string).tobacco.catalogId)
  expect(catalogIds).toEqual(['first', 'second', 'second'])
  expect(buildDraft).toHaveBeenCalledTimes(2)
  expect(screen.queryByText(/Published-resource reconciliation failed/)).not.toBeInTheDocument()
})

it.each([['historical', 'historical'], ['special', 'special'], ['unrecognized variant', 'unknown']])('preserves edition evidence and maps %s to %s', async (variant, expected) => {
  const item = label('first')
  item.label.research!.observedPackage.variant = variant
  item.label.edition = '1996 edition'
  fetchMock.mockResolvedValue(response(200, { id: 'published', state: 'published' }))
  await load([item])
  prepare()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 of 1'))
  expect(buildDraft).toHaveBeenCalledWith(item, expect.objectContaining({ variant: expected, edition: '1996 edition' }), expect.any(String))
})
