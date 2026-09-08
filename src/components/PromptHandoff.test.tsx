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
  fireEvent.click(screen.getByRole('button', { name: 'Copy instructions' }))
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
  fireEvent.click(screen.getByRole('button', { name: 'Copy instructions' }))
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

it('does not copy or offer an unsaved fallback when saving the handoff fails', async () => {
  const writeText = vi.fn(), onCopied = vi.fn()
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<PromptHandoff prompt="Unsaved draft" request="Request" onCopy={vi.fn().mockRejectedValue(new Error('Browser storage is full. Try again.'))} onCopied={onCopied} copyLabel="Copy prompt for 2 labels" />)
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt for 2 labels' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Browser storage is full')
  expect(writeText).not.toHaveBeenCalled(); expect(onCopied).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Prompt to copy')).not.toBeInTheDocument()
})

it('copies the saved payload and uses it for manual fallback if clipboard access fails', async () => {
  const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'))
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const onCopied = vi.fn()
  render(<PromptHandoff prompt="Draft before save" request="Request" onCopy={vi.fn().mockResolvedValue('Exact saved prompt')} onCopied={onCopied} />)
  fireEvent.click(screen.getByRole('button', { name: 'Copy instructions' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('Exact saved prompt'))
  expect(screen.getByLabelText('Prompt to copy')).toHaveValue('Exact saved prompt')
  expect(onCopied).not.toHaveBeenCalled()
})
