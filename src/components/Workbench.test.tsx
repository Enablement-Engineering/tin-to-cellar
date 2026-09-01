// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Workbench } from './Workbench'
import type { LabelInstance, WorkbenchLabel } from './ui-model'

const labels: WorkbenchLabel[] = [
  {
    id: 'escudo',
    maker: 'A&C Petersen',
    blend: 'Escudo Navy De Luxe',
    imageUrl: 'data:image/png;base64,',
    imageFrame: { left: -5, top: -5, width: 110, height: 110 },
    shape: 'circle',
    width: 2.5,
    height: 2.5,
    writeIn: { x: .3, y: .72, width: .4, height: .1, textColor: '#241d16' },
    researchStatus: 'complete',
    variant: 'Cream tin with oxblood display type',
    adaptationSummary: 'Circular cellar rendition',
    sources: [],
    warnings: [],
  },
  {
    id: 'pirate-kake',
    maker: 'Cornell & Diehl',
    blend: 'Pirate Kake',
    imageUrl: 'data:image/png;base64,',
    imageFrame: { left: -5, top: -5, width: 110, height: 110 },
    shape: 'circle',
    width: 2.5,
    height: 2.5,
    writeIn: { x: .3, y: .72, width: .4, height: .1, textColor: '#241d16' },
    researchStatus: 'complete',
    variant: 'Nautical package',
    adaptationSummary: 'Circular cellar rendition',
    sources: [],
    warnings: [],
  },
]

const instances: LabelInstance[] = [
  { instanceId: 'one', labelId: 'escudo', zoom: 1, x: 0, y: 0 },
  { instanceId: 'two', labelId: 'pirate-kake', zoom: 1, x: 0, y: 0 },
]

afterEach(cleanup)

describe('Workbench', () => {
  it('offers a non-drag reorder control and reports the reordered model', async () => {
    const user = userEvent.setup()
    const onInstancesChange = vi.fn()
    render(
      <Workbench
        labels={labels}
        instances={instances}
        mode="JARRED"
        onModeChange={() => undefined}
        onInstancesChange={onInstancesChange}
        onProceed={() => undefined}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Move slot 1 later' }))

    expect(onInstancesChange).toHaveBeenCalledWith([instances[1], instances[0]])
  })

  it('exposes the provenance panel without placing it inside the sheet label', () => {
    render(
      <Workbench
        labels={labels}
        instances={instances}
        mode="JARRED"
        onModeChange={() => undefined}
        onInstancesChange={() => undefined}
        onProceed={() => undefined}
      />,
    )

    expect(screen.getByRole('complementary', { name: 'Artwork provenance' })).toHaveTextContent('Cream tin with oxblood display type')
    expect(screen.getByRole('list', { name: 'Avery 94502 label sheet' })).not.toHaveTextContent('Cream tin with oxblood display type')
  })

  it('lets the user inspect and reorder overflow sheets', async () => {
    const user = userEvent.setup()
    const onInstancesChange = vi.fn()
    const overflowInstances = Array.from({ length: 10 }, (_, index) => ({
      instanceId: `instance-${index}`,
      labelId: index === 9 ? 'pirate-kake' : 'escudo',
      zoom: 1,
      x: 0,
      y: 0,
    }))

    render(
      <Workbench
        labels={labels}
        instances={overflowInstances}
        mode="JARRED"
        onModeChange={() => undefined}
        onInstancesChange={onInstancesChange}
        onProceed={() => undefined}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Next →' }))

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Slot 10, Pirate Kake' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Move slot 10 earlier' }))
    expect(onInstancesChange).toHaveBeenCalledWith([
      ...overflowInstances.slice(0, 8),
      overflowInstances[9],
      overflowInstances[8],
    ])
  })
})
