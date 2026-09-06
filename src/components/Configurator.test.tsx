// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Configurator } from './Configurator'
import type { ConfiguratorState } from './ui-model'
const base: ConfiguratorState = { tobaccos: '', artDirection: '' }
afterEach(cleanup)
describe('Configurator', () => {
  it('only asks for tobaccos and optional requests and explains the paper', () => {
    render(<Configurator value={base} onChange={() => undefined} />)
    expect(screen.getByRole('combobox', { name: 'Tobaccos' })).toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByText(/Avery 94502 · 2.5-inch circles · US Letter/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Width')).not.toBeInTheDocument()
  })
  it('preserves the entered tobacco and special request text', () => {
    const onChange = vi.fn()
    render(<Configurator value={base} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Tobaccos'), { target: { value: 'Escudo Navy De Luxe' } })
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ tobaccos: 'Escudo Navy De Luxe' })
    fireEvent.change(screen.getByLabelText('Special requests'), { target: { value: 'Use the older tin' } })
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({ artDirection: 'Use the older tin' })
  })
})
