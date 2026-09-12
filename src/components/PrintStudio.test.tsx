// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { useState, type ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrintStudio } from './PrintStudio'
import type { PrintLabel, PrintSettings } from './ui-model'
import { AVERY_94502_PROFILE } from '../lib/sheets/profiles'
function Studio(props: Omit<ComponentProps<typeof PrintStudio>, 'settings' | 'onSettingsChange'>) {
  const [settings, setSettings] = useState<PrintSettings>({ page: 0, firstSlot: 1, offset: { x: 0, y: 0 } })
  return <PrintStudio {...props} settings={settings} onSettingsChange={patch => setSettings(current => ({ ...current, ...patch, offset: { ...current.offset, ...patch.offset } }))} />
}
const label: PrintLabel = { id: 'a', maker: 'Maker', blend: 'Blend', imageUrl: 'blob:a', imageFrame: { left: -5, top: -5, width: 110, height: 110 } }
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('PrintStudio', () => {
  it('prepares label pages for browser printing and clears mode after printing or unmount', () => {
    const { unmount } = render(<Studio labels={[label]} quantities={{ a: 1 }} onQuantityChange={() => undefined} />)
    expect(document.body.dataset.printMode).toBeUndefined()
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.body.dataset.printMode).toBe('labels')
    window.dispatchEvent(new Event('afterprint'))
    expect(document.body.dataset.printMode).toBeUndefined()
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.body.dataset.printMode).toBe('labels')
    unmount()
    expect(document.body.dataset.printMode).toBeUndefined()
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.body.dataset.printMode).toBeUndefined()
  })
  it('preserves an explicitly requested alignment proof during beforeprint', () => {
    render(<Studio labels={[label]} quantities={{ a: 1 }} onQuantityChange={() => undefined} />)
    vi.spyOn(window, 'print').mockImplementation(() => window.dispatchEvent(new Event('beforeprint')))
    fireEvent.click(screen.getByRole('button', { name: 'Print alignment sheet' }))
    expect(document.body.dataset.printMode).toBe('calibration')
    window.dispatchEvent(new Event('afterprint'))
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.body.dataset.printMode).toBe('labels')
  })
  it('lays quantities into exact-size sheets, preserving leading blank slots', () => {
    const { container } = render(<Studio labels={[label]} quantities={{ a: 9 }} onQuantityChange={() => undefined} />)
    fireEvent.change(screen.getByLabelText('Start at slot'), { target: { value: '2' } })
    const pages = container.querySelectorAll<HTMLElement>('.production-page')
    expect(pages).toHaveLength(2)
    const { page, slots } = AVERY_94502_PROFILE
    for (const sheet of [pages[0], container.querySelector<HTMLElement>('.calibration-print')!]) {
      expect(sheet.style.width).toBe(`${page.width}${page.unit}`)
      expect(sheet.style.height).toBe(`${page.height}${page.unit}`)
    }
    expect(container.querySelector('.simple-sheet')).toHaveStyle({ aspectRatio: `${page.width} / ${page.height}` })
    expect(screen.getByLabelText('Start at slot').querySelectorAll('option')).toHaveLength(slots.length)
    expect(pages[0].querySelector('.production-slot')?.querySelector('img')).toBeNull()
    const second = pages[0].querySelectorAll<HTMLElement>('.production-slot')[1]
    expect(second.style.left).toBe('3in')
    expect(second.style.top).toBe('1in')
    expect(second.style.width).toBe('2.5in')
    expect(second.querySelector('.write-in')).toBeNull()
    expect(pages[1].querySelectorAll('img')).toHaveLength(1)
  })
  it('shares offset geometry between preview and print and renders nine proof circles', () => {
    const { container } = render(<Studio labels={[label]} quantities={{ a: 1 }} onQuantityChange={() => undefined} />)
    fireEvent.change(screen.getByLabelText('Horizontal adjustment'), { target: { value: '.1' } })
    const preview = container.querySelector<HTMLElement>('.preview-slot')!
    expect(parseFloat(preview.style.left)).toBeCloseTo(.475 / 8.5 * 100)
    expect(container.querySelector<HTMLElement>('.production-pages')?.style.getPropertyValue('--offset-x')).toBe('0.1in')
    expect(container.querySelector<HTMLElement>('.calibration-print')?.style.getPropertyValue('--offset-x')).toBe('0.1in')
    expect(container.querySelectorAll('.proof-slot')).toHaveLength(9)
    vi.spyOn(window, 'print').mockImplementation(() => {})
    fireEvent.click(screen.getByRole('button', { name: 'Print alignment sheet' }))
    expect(document.body.dataset.printMode).toBe('calibration')
    window.dispatchEvent(new Event('afterprint'))
    expect(document.body.dataset.printMode).toBeUndefined()
  })
  it('excludes zero quantities and never offers crop or date controls', () => {
    render(<Studio labels={[label]} quantities={{ a: 0 }} onQuantityChange={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Print 0 labels' })).toBeDisabled()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})

it('uses delta commands and narrow settings patches while persistence is pending', () => {
  const onQuantityChange = vi.fn(), onSettingsChange = vi.fn()
  render(<PrintStudio labels={[label]} quantities={{ a: 1 }} onQuantityChange={onQuantityChange} settings={{ page: 0, firstSlot: 1, offset: { x: 0, y: 0 } }} onSettingsChange={onSettingsChange} saving />)
  fireEvent.click(screen.getByRole('button', { name: 'More Blend' }))
  fireEvent.click(screen.getByRole('button', { name: 'More Blend' }))
  expect(onQuantityChange.mock.calls).toEqual([['a', { delta: 1 }], ['a', { delta: 1 }]])
  fireEvent.change(screen.getByLabelText('Start at slot'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Horizontal adjustment'), { target: { value: '.1' } })
  expect(onSettingsChange.mock.calls).toEqual([[{ firstSlot: 2 }], [{ offset: { x: .1 } }]])
  expect(screen.getByRole('button', { name: 'Print 1 label' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Print alignment sheet' })).toBeDisabled()
  window.dispatchEvent(new Event('beforeprint'))
  expect(document.body.dataset.printMode).toBe('pending')
})

it('enables printing the updated job after saving finishes', () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {})
  const props = { labels: [label], quantities: { a: 1 }, onQuantityChange: vi.fn(), settings: { page: 0, firstSlot: 1, offset: { x: 0, y: 0 } }, onSettingsChange: vi.fn() }
  const view = render(<PrintStudio {...props} saving />)
  fireEvent.click(screen.getByRole('button', { name: 'Print 1 label' }))
  expect(print).not.toHaveBeenCalled()
  view.rerender(<PrintStudio {...props} quantities={{ a: 3 }} saving={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'Print 3 labels' }))
  expect(print).toHaveBeenCalledOnce()
  expect(view.container.querySelectorAll('.production-slot img')).toHaveLength(3)
})

it('counts only the explicit label print action and keeps printing independent of collection', () => {
  const onPrintRequested = vi.fn(() => { throw new Error('Optional collection failed') })
  const print = vi.spyOn(window, 'print').mockImplementation(() => {})
  render(<Studio labels={[label]} quantities={{ a: 2 }} onQuantityChange={() => undefined} onPrintRequested={onPrintRequested} />)
  window.dispatchEvent(new Event('beforeprint'))
  window.dispatchEvent(new Event('afterprint'))
  fireEvent.click(screen.getByRole('button', { name: 'Print alignment sheet' }))
  expect(onPrintRequested).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Print 2 labels' }))
  expect(onPrintRequested).toHaveBeenCalledOnce()
  expect(print).toHaveBeenCalledTimes(2)
})
