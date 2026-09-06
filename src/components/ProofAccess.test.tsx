// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PromptHandoff } from './PromptHandoff'
import { proofAccessText } from '../lib/prompt/proof-access'
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.turnstile })
it('keeps local copying network-free and adds access to both copy routes only after verification', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const token = 'a'.repeat(64)
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ siteKey: 'public-site-key' })).mockResolvedValueOnce(Response.json({ token, uses: 60, expiresAt: Date.now() + 86400000 }))
  vi.stubGlobal('fetch', fetchMock)
  let callback: (token: string) => Promise<void>
  window.turnstile = { render: vi.fn((_element, options) => { callback = options.callback as typeof callback; return 'widget' }), remove: vi.fn() }
  render(<PromptHandoff prompt="Instructions" request="Request" />)
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
  expect(fetchMock).not.toHaveBeenCalled()
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('Instructions' + proofAccessText(null)))
  fireEvent.click(screen.getByRole('button', { name: 'Enable hosted image checks' }))
  await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalled())
  await act(() => callback!('single-use-challenge'))
  expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', body: 'single-use-challenge' })
  expect(screen.getByText(/Hosted image checks enabled/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('Authorization: Bearer ' + token)))
  fireEvent.click(screen.getByText('More options'))
  fireEvent.click(screen.getByRole('button', { name: 'Copy request only' }))
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(expect.stringMatching(/^Request\n\n# Hosted proof access/)))
  fireEvent.click(screen.getByRole('button', { name: 'Use local guides instead' }))
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }))
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('Instructions' + proofAccessText(null)))
  expect(window.turnstile!.remove).toHaveBeenCalledWith('widget')
})
it('omits expired credentials and leaves copying available when verification cannot load', async () => {
  expect(proofAccessText({ token: 'private', uses: 60, expiresAt: 0 })).not.toContain('private')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ siteKey: null })))
  render(<PromptHandoff prompt="Instructions" request="Request" />)
  fireEvent.click(screen.getByRole('button', { name: 'Enable hosted image checks' }))
  await waitFor(() => expect(screen.getByText('Hosted checks are unavailable. Local guides still work.')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeEnabled()
})
