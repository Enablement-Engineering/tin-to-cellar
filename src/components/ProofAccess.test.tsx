// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PromptHandoff } from './PromptHandoff'
import { proofAccessText } from '../lib/prompt/proof-access'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); delete window.turnstile })
it('automatically verifies and includes access in every copy route', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const token = 'a'.repeat(64)
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ siteKey: 'public-site-key' })).mockResolvedValueOnce(Response.json({ token, uses: 60, expiresAt: Date.now() + 86400000 }))
  vi.stubGlobal('fetch', fetchMock)
  let callback: (token: string) => Promise<void>
  window.turnstile = { render: vi.fn((_element, options) => { callback = options.callback as typeof callback; return 'widget' }), remove: vi.fn() }
  render(<PromptHandoff prompt="Instructions" completePrompt="Complete" request="Request" />)
  expect(screen.queryByRole('button', { name: 'Enable hosted image checks' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeDisabled()
  await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalled())
  expect(window.turnstile.render).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ appearance: 'interaction-only' }))
  await act(() => callback!('single-use-challenge'))
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', body: 'single-use-challenge' })
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('Authorization: Bearer ' + token)))
  fireEvent.click(screen.getByText('Read prompt'))
  for (const [name, prefix] of [['Copy request only', 'Request'], ['Copy prompt', 'Complete']]) {
    fireEvent.click(screen.getByRole('button', { name }))
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining(prefix + '\n\n# Hosted proof access')))
  }
  expect(window.turnstile!.remove).toHaveBeenCalledWith('widget')
})
it('omits expired credentials and leaves copying available when verification cannot load', async () => {
  expect(proofAccessText({ token: 'private', uses: 60, expiresAt: 0 })).not.toContain('private')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ siteKey: null })))
  render(<PromptHandoff prompt="Instructions" request="Request" />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeEnabled())
  expect(screen.getByText('Print guides are unavailable. You can still copy your prompt; your AI will make its own guides.')).toBeInTheDocument()
})
it('lets users continue while verification is pending and ignores a late result', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ siteKey: 'key' })))
  let callback: (token: string) => Promise<void>
  window.turnstile = { render: vi.fn((_element, options) => { callback = options.callback as typeof callback; return 'widget' }), remove: vi.fn() }
  render(<PromptHandoff prompt="Instructions" request="Request" />)
  await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: 'Continue without waiting' }))
  await act(() => callback!('late-token'))
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('Instructions' + proofAccessText(null)))
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('falls back after a stalled challenge instead of blocking copying indefinitely', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ siteKey: 'key' })))
  window.turnstile = { render: vi.fn(() => 'widget'), remove: vi.fn() }
  render(<PromptHandoff prompt="Instructions" request="Request" />)
  await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
  expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeEnabled()
  expect(window.turnstile.remove).toHaveBeenCalledWith('widget')
})
it('reuses valid access when returning to the prompt builder without issuing another allowance', () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
  render(<PromptHandoff prompt="Instructions" request="Request" proofLease={{ token: 'c'.repeat(64), uses: 60, expiresAt: Date.now() + 60000 }} onProofLeaseChange={vi.fn()} />)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeEnabled()
})
it.each([
  ['HTML fallback', () => new Response('<!doctype html><html>App page</html>', { headers: { 'Content-Type': 'text/html' } })],
  ['malformed JSON', () => new Response('<!doctype html>', { headers: { 'Content-Type': 'application/json' } })],
  ['null JSON', () => Response.json(null)],
  ['network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
])('keeps copying available without exposing %s errors', async (_name, response) => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  vi.stubGlobal('fetch', vi.fn().mockImplementation(response))
  render(<PromptHandoff prompt="Instructions" request="Request" />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeEnabled())
  expect(screen.getByText('Print guides are unavailable. You can still copy your prompt; your AI will make its own guides.')).toBeInTheDocument()
  expect(screen.queryByText(/Unexpected token|Failed to fetch|doctype/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('Instructions' + proofAccessText(null)))
})
it('handles an HTML response after verification without leaking a parser error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ siteKey: 'key' })).mockResolvedValueOnce(new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } })))
  let callback: (token: string) => Promise<void>
  window.turnstile = { render: vi.fn((_element, options) => { callback = options.callback as typeof callback; return 'widget' }), remove: vi.fn() }
  render(<PromptHandoff prompt="Instructions" request="Request" />)
  await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalled())
  await act(() => callback!('challenge'))
  expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeEnabled()
  expect(screen.getByText('Print guides are unavailable. You can still copy your prompt; your AI will make its own guides.')).toBeInTheDocument()
  expect(window.turnstile!.remove).toHaveBeenCalledWith('widget')
})
