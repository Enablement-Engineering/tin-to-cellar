// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ExamplePack } from './ExamplePack'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('loads the ZIP only on request and passes the assembled file to the importer', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer })
  vi.stubGlobal('fetch', fetcher)
  const onFile = vi.fn().mockResolvedValue(undefined)
  render(<ExamplePack busy={false} onFile={onFile} />)
  expect(fetcher).not.toHaveBeenCalled()
  expect(screen.getAllByRole('img')).toHaveLength(10)
  fireEvent.click(screen.getByRole('button', { name: 'Import preview pack with ten labels' }))
  await waitFor(() => expect(onFile).toHaveBeenCalledOnce())
  const file = onFile.mock.calls[0][0] as File
  expect(file.name).toBe('tin-to-cellar-ten-blends.cellarpack.zip')
  expect(file.size).toBe(4)
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/examples/ten-blends/pack-aa', '/examples/ten-blends/pack-ab'])
})

it('downloads a ZIP without importing it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(2) }))
  const createObjectURL = vi.fn(() => 'blob:example')
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const onFile = vi.fn()
  render(<ExamplePack busy={false} onFile={onFile} />)
  fireEvent.click(screen.getByRole('button', { name: 'Download preview ZIP' }))
  await waitFor(() => expect(click).toHaveBeenCalledOnce())
  expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('tin-to-cellar-ten-blends.cellarpack.zip')
  expect(onFile).not.toHaveBeenCalled()
})

it('offers retry after a failed download and respects an existing import', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  const onFile = vi.fn()
  const { rerender } = render(<ExamplePack busy={false} onFile={onFile} />)
  fireEvent.click(screen.getByRole('button', { name: 'Import preview pack with ten labels' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Please try again')
  expect(onFile).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Import preview pack with ten labels' })).toBeEnabled()
  rerender(<ExamplePack busy onFile={onFile} />)
  expect(screen.getByRole('button', { name: 'Import preview pack with ten labels' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Download preview ZIP' })).toBeDisabled()
})
