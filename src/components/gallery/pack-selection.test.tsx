// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GalleryBrowse } from './GalleryBrowse'
import { buildSelectedPack } from './pack-builder'
vi.mock('./pack-builder', () => ({ buildSelectedPack: vi.fn() }))
const labels = [
  { id: '43649b43-8094-4a32-b5ee-8be75208fb63', maker: 'Maker', blend: 'One', description: 'First design' },
  { id: '43649b43-8094-4a32-b5ee-8be75208fb64', maker: 'Maker', blend: 'Two', description: 'Second design' },
]
beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/config') ? { serving: true } : { labels, nextCursor: null } })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks() })
it('keeps selection through browsing and remount, removes entries and prints the whole selection', async () => {
  const onUse = vi.fn().mockResolvedValue(undefined)
  const first = render(<GalleryBrowse onUse={onUse} />)
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add to pack' }))[0])
  fireEvent.click(screen.getByRole('button', { name: 'Add to pack' }))
  expect(screen.getByRole('button', { name: 'Your pack · 2 labels' })).toBeInTheDocument()
  expect(screen.queryByRole('link', {name: 'Download ZIP'})).toBeNull()
  const blend = screen.getByRole('combobox', {name: 'Maker or blend'})
  fireEvent.change(blend, {target: {value: 'Peterson Nightcap'}})
  fireEvent.keyDown(blend, {key: 'ArrowDown'})
  fireEvent.keyDown(blend, {key: 'Enter'})
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain('catalogId='))
  first.unmount()
  render(<GalleryBrowse onUse={onUse} />)
  await screen.findByRole('button', {name: 'Your pack · 2 labels'})
  fireEvent.click(screen.getByRole('button', {name: 'Your pack · 2 labels'}))
  fireEvent.click(screen.getByRole('button', {name: 'Remove Maker One from pack'}))
  expect(screen.getByRole('button', {name: 'Your pack · 1 label'})).toBeInTheDocument()
  const file = new File(['combined'], 'community-labels.cellarpack.zip')
  vi.mocked(buildSelectedPack).mockResolvedValue(file)
  fireEvent.click(screen.getByRole('button', {name: 'Print selected labels'}))
  await waitFor(() => expect(onUse).toHaveBeenCalledWith(file))
  expect(buildSelectedPack).toHaveBeenCalledWith([{id: labels[1].id, maker: 'Maker', blend: 'Two'}])
  fireEvent.click(screen.getByRole('button', {name: 'Clear pack'}))
  expect(screen.queryByRole('button', {name: 'Download pack'})).toBeNull()
})
it('retains selected labels after a download failure and allows retry', async () => {
  render(<GalleryBrowse onUse={vi.fn()} />)
  fireEvent.click((await screen.findAllByRole('button', {name: 'Add to pack'}))[0])
  fireEvent.click(screen.getByRole('button', {name: 'Your pack · 1 label'}))
  vi.mocked(buildSelectedPack).mockRejectedValue(new Error('This label is unavailable. Remove it or retry.'))
  fireEvent.click(screen.getByRole('button', {name: 'Download pack'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('This label is unavailable')
  expect(screen.getByRole('button', {name: 'Your pack · 1 label'})).toBeInTheDocument()
  expect(screen.getByRole('button', {name: 'Download pack'})).toBeEnabled()
})
