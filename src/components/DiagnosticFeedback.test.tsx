// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DiagnosticFeedback } from './DiagnosticFeedback'
const report = {
  format: 'tin-to-cellar/feedback', schemaVersion: '1.0.0', promptVersion: '2026-09-06.1',
  request: { labelCount: 1, shape: 'circle' }, outcome: 'failed', steps: [], issues: [],
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('excludes malformed feedback without rendering private fields or making network requests', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(<DiagnosticFeedback candidate={{ ...report, email: 'secret@example.com' }} />)
  expect(screen.getByText(/was excluded/)).toBeTruthy()
  expect(screen.queryByText(/secret@example/)).toBeNull()
  expect(screen.queryByText('Download report')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})
it('loads standalone failed-run reports locally and rejects unknown fields', async () => {
  render(<DiagnosticFeedback candidate={null} />)
  fireEvent.change(screen.getByLabelText('Open saved feedback reports'), { target: { files: [
    { size: 500, text: async () => JSON.stringify(report) },
    { size: 500, text: async () => JSON.stringify({ ...report, log: 'secret@example.com' }) },
  ] } })
  await waitFor(() => expect(screen.getByText(/1 report loaded. 1 rejected/)).toBeTruthy())
  expect(screen.getByText('Failed: 1')).toBeTruthy()
  expect(screen.queryByText(/secret@example/)).toBeNull()
  expect(screen.getByText('Download comparison')).toBeTruthy()
})
it('offers only validated report data for explicit download', () => {
  const create = vi.fn((_blob: Blob) => 'blob:test')
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<DiagnosticFeedback candidate={report} />)
  expect(create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Download report'))
  expect(create).toHaveBeenCalledOnce()
  expect(create.mock.calls[0][0]).toBeInstanceOf(Blob)
  click.mockRestore()
})

it('keeps revisions in separate comparison groups and identifies conflicting pack attribution', async () => {
  const current = { ...report, schemaVersion: '2.0.0', protocolRevision: 1, promptVersion: undefined }
  const { rerender } = render(<DiagnosticFeedback candidate={JSON.parse(JSON.stringify(current))} protocolContext={{ status: 'known', revision: 1 }} />)
  fireEvent.change(screen.getByLabelText('Open saved feedback reports'), { target: { files: [
    { size: 500, text: async () => JSON.stringify(report) },
  ] } })
  await waitFor(() => expect(screen.getByText(/1 report loaded. 0 rejected/)).toBeTruthy())
  expect(screen.getAllByText('Failed: 1')).toHaveLength(2)
  rerender(<DiagnosticFeedback candidate={JSON.parse(JSON.stringify(current))} protocolContext={{ status: 'conflict' }} />)
  expect(screen.getByText(/pack and its feedback refer to different instructions/)).toBeTruthy()
  expect(screen.getAllByText('Failed: 1')).toHaveLength(1)
})

it('separates the readable run from optional comparisons and raw data', () => {
  render(<DiagnosticFeedback candidate={{ ...report, outcome: 'complete', issues: [
    { code: 'write-area', stage: 'visual-review', resolved: true },
    { code: 'image-handoff-unavailable', stage: 'generation', resolved: false },
  ] }} />)
  expect(screen.getByText('AI run details').closest('details')?.open).toBe(false)
  expect(screen.getByText('Open and compare saved reports').closest('details')?.open).toBe(false)
  expect(screen.getByText('View report JSON').closest('details')?.open).toBe(false)
  expect(screen.getAllByText('Blank date area needed attention')).toHaveLength(2)
  expect(screen.getByText('Resolved')).toBeTruthy()
  expect(screen.getByText('Unresolved')).toBeTruthy()
  expect(screen.queryByText('Failed: 0')).toBeNull()
})

it('keeps reports on picker cancellation and allows clearing saved comparisons', async () => {
  render(<DiagnosticFeedback candidate={null} />)
  const picker = screen.getByLabelText('Open saved feedback reports')
  fireEvent.change(picker, { target: { files: [{ size: 500, text: async () => JSON.stringify(report) }] } })
  await waitFor(() => expect(screen.getByText('Failed: 1')).toBeTruthy())
  fireEvent.change(picker, { target: { files: [] } })
  expect(screen.getByText('Failed: 1')).toBeTruthy()
  fireEvent.click(screen.getByText('Clear saved reports'))
  expect(screen.queryByText('Failed: 1')).toBeNull()
})
