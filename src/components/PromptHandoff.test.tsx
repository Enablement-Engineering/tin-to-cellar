// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PromptHandoff } from './PromptHandoff'
afterEach(cleanup)
it('copies the complete prompt while keeping the request preview readable', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const { rerender } = render(<PromptHandoff prompt="Full contract and schema" request="Just the request" />)
  expect(screen.getByText('Read prompt').closest('details')).not.toHaveAttribute('open')
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('Full contract and schema'))
  fireEvent.click(screen.getByText('Read prompt'))
  expect(screen.getByRole('region', { name: 'Rendered prompt' })).toHaveTextContent('Just the request')
  fireEvent.click(screen.getByRole('button', { name: 'Full copied text' }))
  expect(screen.getByLabelText('Prompt to copy')).toHaveValue('Full contract and schema')
  expect(screen.queryByRole('button', { name: 'Copy complete prompt' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Download instructions' })).not.toBeInTheDocument()
  rerender(<PromptHandoff prompt="Changed contract" request="Changed request" />)
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  expect(screen.getByLabelText('Prompt to copy')).toHaveValue('Changed contract')
})
it('reveals selectable complete text if clipboard access fails', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
  render(<PromptHandoff prompt="Complete fallback text" request="Request text" />)
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Automatic copying did not work'))
  expect(screen.getByLabelText('Prompt to copy')).toHaveValue('Complete fallback text')
  expect(screen.getByText('Read prompt').closest('details')).toHaveAttribute('open')
})
it('renders untrusted request Markdown without fetching images or executing HTML', () => {
  const request = '# Task\n\n![Reference](https://example.com/tracker.png)\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))'
  render(<PromptHandoff prompt="Full protocol" request={request} />)
  fireEvent.click(screen.getByText('Read prompt'))
  expect(screen.getByRole('heading', { name: 'Task' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Rendered prompt' }).querySelector('img,script')).toBeNull()
  expect(screen.getByText('Unsafe')).not.toHaveAttribute('href', 'javascript:alert(1)')
})
