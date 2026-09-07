// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GalleryBrowse } from './GalleryBrowse'
const labels = [
  { id: '43649b43-8094-4a32-b5ee-8be75208fb63', maker: 'Maker', blend: 'One', description: 'First design' },
  { id: '43649b43-8094-4a32-b5ee-8be75208fb64', maker: 'Maker', blend: 'Two', description: 'Second design' },
]
beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/config') ? { serving: true } : { serving: true, labels, nextCursor: null } })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.resetAllMocks() })

it('adds through the shared collection callback and displays only committed selections', async () => {
  const onAdd = vi.fn().mockResolvedValue(undefined), onPrint = vi.fn()
  const view = render(<GalleryBrowse onAdd={onAdd} onPrint={onPrint} />)
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add to your labels' }))[0])
  await waitFor(() => expect(onAdd).toHaveBeenCalledWith(labels[0]))
  expect(sessionStorage.getItem('gallery-pack-selection')).toBeNull()
  expect(screen.queryByText('Added to your labels')).not.toBeInTheDocument()
  view.rerender(<GalleryBrowse onAdd={onAdd} onPrint={onPrint} selectedIds={[labels[0].id]} />)
  expect(screen.getByRole('button', { name: 'Added to your labels' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Review & print' })); expect(onPrint).toHaveBeenCalledOnce()
})

it('retains committed selections after a failed add and allows retry', async () => {
  const onAdd = vi.fn().mockRejectedValue(new Error('This design is unavailable.'))
  render(<GalleryBrowse onAdd={onAdd} selectedIds={[labels[0].id]} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Add to your labels' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This design is unavailable')
  expect(screen.getByRole('button', { name: 'Added to your labels' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Add to your labels' })).toBeEnabled()
})
