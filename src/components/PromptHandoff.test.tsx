// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PromptHandoff } from './PromptHandoff'
import { proofAccessText } from '../lib/prompt/proof-access'
afterEach(cleanup)
describe('PromptHandoff', () => {
  it('copies the complete prompt by default and exposes request only as a secondary action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { rerender } = render(<PromptHandoff prompt="Full contract and schema" request="Just the request" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Full contract and schema' + proofAccessText(null)))
    expect(screen.queryByRole('link', { name: /open chatgpt/i })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('press Send'))
    fireEvent.click(screen.getByText('More options'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy request only' }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('Just the request' + proofAccessText(null)))
    expect(screen.getByRole('status')).toHaveTextContent('already has the Tin to Cellar instructions')
    rerender(<PromptHandoff prompt="Changed contract" request="Changed request" />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
  it('provides selectable full text when copying the full prompt fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<PromptHandoff prompt="Complete fallback text" request="Request text" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copy was unavailable'))
    expect(screen.getByLabelText('Full prompt')).toHaveValue('Complete fallback text' + proofAccessText(null))
    expect(screen.getByText('Read full prompt').closest('details')).toHaveAttribute('open')
  })
  it('shows the request payload rather than the full prompt when request-only copying fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<PromptHandoff prompt="Full instructions payload" request="Specific label request payload" />)
    fireEvent.click(screen.getByText('More options'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy request only' }))
    await waitFor(() => expect(screen.getByLabelText('Request to copy')).toHaveValue('Specific label request payload' + proofAccessText(null)))
    expect(screen.queryByLabelText('Full prompt')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Request to copy').closest('details')).toHaveAttribute('open')
  })
})

it('renders Markdown without fetching embedded images or executing HTML, and preserves exact source', () => {
  const prompt = '# Task\n\n- Research **the label**\n\n```json\n{"labels": []}\n```\n\n![Reference](https://example.com/tracker.png)\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))'
  render(<PromptHandoff prompt={prompt} request="Request" />)
  expect(screen.getByRole('heading', { name: 'Task' })).toBeInTheDocument()
  expect(screen.getByText('the label').tagName).toBe('STRONG')
  expect(screen.getByRole('region', { name: 'Rendered prompt' }).querySelector('img,script')).toBeNull()
  expect(screen.getByText('Unsafe')).not.toHaveAttribute('href', 'javascript:alert(1)')
  fireEvent.click(screen.getByRole('button', { name: 'Markdown source' }))
  expect(screen.getByLabelText('Full prompt')).toHaveValue(prompt + proofAccessText(null))
})
