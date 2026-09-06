// @vitest-environment jsdom
import { useEffect } from 'react'
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PromptHandoff } from './PromptHandoff'
import { proofAccessText } from '../lib/prompt/proof-access'
import { protocolInstructions } from '../lib/protocol'
afterEach(cleanup)
describe('PromptHandoff', () => {
  it('copies the starting prompt by default and exposes request only as a secondary action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { rerender } = render(<PromptHandoff prompt="Full contract and schema" request="Just the request" />)
    expect(screen.getByText('Read prompt').closest('details')).not.toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Full contract and schema' + proofAccessText(null)))
    expect(screen.queryByRole('link', { name: /open chatgpt/i })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Attach the downloaded instructions'))
    fireEvent.click(screen.getByText('More options'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy request only' }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('Just the request' + proofAccessText(null)))
    expect(screen.getByRole('status')).toHaveTextContent('already added the Tin to Cellar instructions')
    rerender(<PromptHandoff prompt="Changed contract" request="Changed request" />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
  it('provides selectable full text when copying the full prompt fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<PromptHandoff prompt="Complete fallback text" request="Request text" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Automatic copying did not work'))
    expect(screen.getByLabelText('Prompt to copy')).toHaveValue('Complete fallback text' + proofAccessText(null))
    expect(screen.getByText('Read prompt').closest('details')).toHaveAttribute('open')
  })
  it('shows the request payload rather than the full prompt when request-only copying fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<PromptHandoff prompt="Full instructions payload" request="Specific label request payload" />)
    fireEvent.click(screen.getByText('More options'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy request only' }))
    await waitFor(() => expect(screen.getByLabelText('Request to copy')).toHaveValue('Specific label request payload' + proofAccessText(null)))
    expect(screen.queryByLabelText('Prompt to copy')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Request to copy').closest('details')).toHaveAttribute('open')
  })
})

it('renders Markdown without fetching embedded images or executing HTML, and preserves exact source', () => {
  const prompt = '# Task\n\n- Research **the label**\n\n```json\n{"labels": []}\n```\n\n![Reference](https://example.com/tracker.png)\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))'
  render(<PromptHandoff prompt={prompt} request="Request" />)
  fireEvent.click(screen.getByText('Read prompt'))
  expect(screen.getByRole('heading', { name: 'Task' })).toBeInTheDocument()
  expect(screen.getByText('the label').tagName).toBe('STRONG')
  expect(screen.getByRole('region', { name: 'Rendered prompt' }).querySelector('img,script')).toBeNull()
  expect(screen.getByText('Unsafe')).not.toHaveAttribute('href', 'javascript:alert(1)')
  fireEvent.click(screen.getByRole('button', { name: 'Markdown source' }))
  expect(screen.getByLabelText('Prompt to copy')).toHaveValue(prompt + proofAccessText(null))
})

it('copies and reveals the exact complete payload when its clipboard action fails', async () => {
  const writeText = vi.fn().mockRejectedValue(new Error('denied'))
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  render(<PromptHandoff prompt="Compact request" completePrompt="Frozen complete contract" request="Request only" />)
  fireEvent.click(screen.getByRole('button', { name: 'Copy complete prompt' }))
  await waitFor(() => expect(screen.getByLabelText('Prompt to copy')).toHaveValue('Frozen complete contract' + proofAccessText(null)))
  expect(writeText).toHaveBeenCalledWith('Frozen complete contract' + proofAccessText(null))
  expect(screen.getByRole('link', { name: 'read the current instructions' })).toHaveAttribute('href', 'https://tintocellar.com/api/protocol/v1')
})

it('offers reusable bundled instructions without the project request or proof access', () => {
  render(<PromptHandoff prompt="Private project request" completePrompt="Private complete request" request="Private request" />)
  const link = screen.getByRole('link', { name: 'Download instructions' })
  const body = decodeURIComponent(link.getAttribute('href')!.split(',').slice(1).join(','))
  expect(body).toBe(protocolInstructions())
  expect(link.closest('details')).toBeNull()
  expect(screen.getByRole('button', { name: 'Copy complete prompt' }).closest('details')).toBeNull()
  expect(body).not.toContain('Private project request')
  expect(body).not.toContain('Private complete request')
  expect(body).not.toContain('Private request')
  expect(body).not.toContain(proofAccessText(null))
  expect(link).toHaveAttribute('download', 'tin-to-cellar-instructions.md')
})

vi.mock('./ProofAccess', () => ({ ProofAccess: ({ onPendingChange }: { onPendingChange(pending: boolean): void }) => { useEffect(() => onPendingChange(false), [onPendingChange]); return null } }))
