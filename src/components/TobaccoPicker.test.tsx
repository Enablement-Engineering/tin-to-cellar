// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TobaccoPicker } from './TobaccoPicker'
vi.mock('../lib/tobacco-catalog', () => ({
  formatTobacco: (entry: { maker: string; blend: string }) => `${entry.maker} — ${entry.blend}`,
  searchTobaccos: (query: string) => [{ id: 'pirate', maker: 'Cornell & Diehl', blend: 'Pirate Kake' }, { id: 'nightcap', maker: 'Peterson', blend: 'Nightcap' }].filter((entry) => `${entry.maker} ${entry.blend}`.toLowerCase().includes(query.toLowerCase().trim())),
}))
function Harness() {
  const [value, setValue] = useState('')
  return <><TobaccoPicker value={value} onChange={setValue} /><output data-testid="published">{value}</output></>
}
const type = (value: string) => fireEvent.change(screen.getByRole('combobox'), { target: { value } })
afterEach(cleanup)
describe('TobaccoPicker', () => {
  it('selects catalog suggestions only after explicit keyboard navigation or a click', () => {
    render(<Harness />)
    type('Pirate')
    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).not.toHaveAttribute('aria-activedescendant')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const first = screen.getAllByRole('option')[0]
    expect(input).toHaveAttribute('aria-activedescendant', first.id)
    expect(first).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Remove Cornell & Diehl — Pirate Kake' })).toBeInTheDocument()
    type('Peterson')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(screen.getByRole('option', { name: 'Use “Peterson”' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('option', { name: 'Nightcap by Peterson' }))
    expect(screen.getByTestId('published')).toHaveTextContent('Peterson — Nightcap')
  })
  it('keeps custom text on Enter rather than silently selecting the first match', () => {
    render(<Harness />)
    type('Pirate')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Remove Pirate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Cornell & Diehl — Pirate Kake' })).not.toBeInTheDocument()
    type('Unlisted Family Blend')
    fireEvent.click(screen.getByRole('option', { name: 'Use “Unlisted Family Blend”' }))
    expect(screen.getByRole('button', { name: 'Remove Unlisted Family Blend' })).toBeInTheDocument()
  })
  it('closes suggestions with Escape and immediately publishes unfinished text for copying', () => {
    render(<Harness />)
    type('My unfinished blend')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('published')).toHaveTextContent('My unfinished blend')
    fireEvent.blur(screen.getByRole('combobox'))
    expect(screen.getByTestId('published')).toHaveTextContent('My unfinished blend')
  })
  it('deduplicates names without changing custom spelling and lets users remove and clear selections', () => {
    render(<Harness />)
    type('My Blend')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    type('my blend')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    expect(within(screen.getByRole('list', { name: 'Selected tobaccos' })).getAllByRole('listitem')).toHaveLength(1)
    type('Another blend')
    fireEvent.click(screen.getByRole('button', { name: 'Remove My Blend' }))
    expect(screen.getByTestId('published')).toHaveTextContent(/^Another blend$/)
    fireEvent.click(screen.getByRole('button', { name: 'Clear tobaccos' }))
    expect(screen.getByTestId('published')).toBeEmptyDOMElement()
    expect(screen.getByRole('combobox')).toHaveValue('')
  })
  it('accepts a multiline batch paste as names and removes repeated lines', () => {
    render(<Harness />)
    fireEvent.paste(screen.getByRole('combobox'), { clipboardData: { getData: () => 'First Blend\r\nSecond Blend\r\nfirst blend\n' } })
    expect(screen.getByRole('button', { name: 'Remove First Blend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Second Blend' })).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('')
    expect(screen.getByTestId('published').textContent).toBe('First Blend\nSecond Blend')
  })
})
