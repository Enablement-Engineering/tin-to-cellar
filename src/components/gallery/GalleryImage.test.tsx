// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GalleryImage } from './GalleryImage'

const decode = vi.fn<() => Promise<void>>()
beforeEach(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: decode })
  decode.mockReset().mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); Reflect.deleteProperty(HTMLImageElement.prototype, 'decode') })

it('waits for decode and ignores the previous source finishing after a replacement', async () => {
  let finish!: () => void
  decode.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const { container, rerender } = render(<GalleryImage src="/one.png" alt="One" />)
  fireEvent.load(screen.getByRole('img'))
  expect(container.firstElementChild?.className).toContain('--pending')
  rerender(<GalleryImage src="/two.png" alt="Two" />)
  await act(async () => { finish() })
  expect(container.firstElementChild?.className).toContain('--pending')
  fireEvent.load(screen.getByRole('img'))
  await waitFor(() => expect(container.firstElementChild?.className).toContain('--loaded'))
})

it('decodes an image already in the browser cache without needing another load event', async () => {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(320)
  const { container } = render(<GalleryImage src="/cached.png" alt="Cached" />)
  await waitFor(() => expect(container.firstElementChild?.className).toContain('--loaded'))
})

it('shows decode failures and allows the sharp image to load even if its preview fails', async () => {
  decode.mockRejectedValueOnce(new Error('corrupt image'))
  const { container, rerender } = render(<GalleryImage src="/bad.png" alt="Bad" />)
  fireEvent.load(screen.getByRole('img'))
  await screen.findByText('Image unavailable')
  rerender(<GalleryImage src="/good.png" preview="/bad-preview.png" alt="Good" />)
  fireEvent.error(container.querySelector('.gallery-image-placeholder')!)
  expect(container.querySelector('.gallery-image-placeholder')).toBeNull()
  fireEvent.load(screen.getByRole('img'))
  await waitFor(() => expect(container.firstElementChild?.className).toContain('--loaded'))
})
