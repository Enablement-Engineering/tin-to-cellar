// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Configurator } from './Configurator'
import type { ConfiguratorState } from './ui-model'

const base: ConfiguratorState = {
  tobaccos: '',
  shape: 'circle',
  width: 2.5,
  height: 2.5,
  bleed: 0.125,
  stock: 'tin-to-cellar:avery-94502@1',
  inspirationUrls: '',
  plannedFiles: '',
  writeInMode: 'JARRED',
  artDirection: '',
}

afterEach(cleanup)

describe('Configurator', () => {
  it('explains the guided interview path when the tobacco list is empty', () => {
    render(<Configurator value={base} onChange={() => undefined} />)
    expect(screen.getByText(/agent to begin by asking/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Tobaccos')).toHaveValue('')
  })

  it('preserves the entered tobacco text and reports the batch count', async () => {
    const onChange = vi.fn()
    render(<Configurator value={base} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Tobaccos'), { target: { value: 'Escudo Navy De Luxe' } })

    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ tobaccos: 'Escudo Navy De Luxe' })
  })

  it('keeps a circle square when its width changes', async () => {
    const onChange = vi.fn()
    render(<Configurator value={base} onChange={onChange} />)

    const width = screen.getByLabelText('Width')
    fireEvent.change(width, { target: { value: '3' } })

    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ width: 3, height: 3 })
  })
})
