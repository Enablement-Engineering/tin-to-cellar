// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer'
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createCollection } from '../lib/collection/commands'
import { applyImport, planImport, prepareImport } from '../lib/collection/import'
import { collectionFixture } from '../lib/collection/test-fixtures'
import { usePrintLabels } from './usePrintLabels'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('uses canonical blend independently of a display name already containing its maker', async () => {
  vi.stubGlobal('Blob', NodeBlob)
  const pack = await collectionFixture(manifest => { manifest.labels[0].displayName = 'Fixture Maker — Fixture Blend' })
  const candidate = await prepareImport(pack, { origin: 'local' })
  const empty = createCollection()
  const collection = applyImport(empty, planImport(empty, candidate))
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fixture'), revokeObjectURL: vi.fn() })
  const { result } = renderHook(() => usePrintLabels(collection))
  expect(result.current.labels[0]).toMatchObject({ maker: 'Fixture Maker', blend: 'Fixture Blend' })
  expect(Object.values(collection.designs)[0].item.label.displayName).toBe('Fixture Maker — Fixture Blend')
})
