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
  expect(screen.queryByText('Download feedback')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})
it('loads standalone failed-run reports locally and rejects unknown fields', async () => {
  render(<DiagnosticFeedback candidate={null} />)
  fireEvent.change(screen.getByLabelText('Open saved feedback reports'), { target: { files: [
    { size: 500, text: async () => JSON.stringify(report) },
    { size: 500, text: async () => JSON.stringify({ ...report, log: 'secret@example.com' }) },
  ] } })
  await waitFor(() => expect(screen.getByText(/1 reports loaded. 1 rejected/)).toBeTruthy())
  expect(screen.getByText('failed: 1')).toBeTruthy()
  expect(screen.queryByText(/secret@example/)).toBeNull()
  expect(screen.getByText('Download feedback summary')).toBeTruthy()
})
it('offers only validated report data for explicit download', () => {
  const create = vi.fn((_blob: Blob) => 'blob:test')
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<DiagnosticFeedback candidate={report} />)
  expect(create).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Download feedback'))
  expect(create).toHaveBeenCalledOnce()
  expect(create.mock.calls[0][0]).toBeInstanceOf(Blob)
  click.mockRestore()
})
