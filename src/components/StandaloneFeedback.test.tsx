// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StandaloneFeedback } from './StandaloneFeedback'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('previews a failure locally and sends only after an explicit share action', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ status: 'collected' }))
  vi.stubGlobal('fetch', fetcher)
  render(<StandaloneFeedback />)
  const feedback = { format: 'tin-to-cellar/feedback', schemaVersion: '1.0.0', promptVersion: '2026-09-06.1', request: { labelCount: 1, shape: 'circle' }, outcome: 'failed', steps: [], issues: [] }
  const file = new File([], 'failure.json'); file.text = async () => JSON.stringify(feedback)
  fireEvent.change(screen.getByLabelText('Open failure report'), { target: { files: [file] } })
  fireEvent.click(screen.getByText('Report a failed AI run'))
  const button = await screen.findByRole('button', { name: 'Share failure report' })
  expect(fetcher).not.toHaveBeenCalled()
  button.focus()
  fireEvent.click(button)
  expect(await screen.findByRole('button', { name: 'View shared diagnostics' })).toHaveFocus()
  expect(fetcher).toHaveBeenCalledTimes(1)
  const body = JSON.parse(fetcher.mock.calls[0][1].body)
  expect(body.origin).toBe('standalone')
  expect(body.sources).toEqual([])
  expect(body).not.toHaveProperty('filename')
})
