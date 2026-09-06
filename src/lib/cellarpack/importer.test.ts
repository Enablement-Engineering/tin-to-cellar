import { describe, expect, it, vi } from 'vitest'
import * as imageModule from './image'
import { importCellarPack } from './importer'
import { makeCellarPack, makeTestManifest, testPng } from './test-fixtures'
import JSZip from 'jszip'
import { sha256Hex } from './image'
import type { CellarPackManifest } from './types'

describe('importCellarPack', () => {
  it('imports a conforming browser-local pack', async () => {
    const result = await importCellarPack(await makeCellarPack())

    expect(result.status).toBe('ready')
    expect(result.labels.map((label) => label.id)).toEqual(['fixture-blend'])
    expect(result.quarantinedLabels).toHaveLength(0)
    expect(result.conformance.archive).toBe('conformant')
    expect(result.conformance.generator).toBe('conformant')
    expect(result.issues.map((issue) => issue.code)).toContain('MISSING_PREVIEW')
  })

  it('quarantines a label with a bad asset hash without rejecting the pack', async () => {
    const result = await importCellarPack(
      await makeCellarPack({
        mutateManifest: (manifest) => {
          manifest.assets['asset-fixture'].sha256 = '0'.repeat(64)
        },
      }),
    )

    expect(result.status).toBe('partial')
    expect(result.labels).toHaveLength(0)
    expect(result.quarantinedLabels[0].issues.map((issue) => issue.code)).toContain(
      'ASSET_HASH_MISMATCH',
    )
  })

  it('quarantines artwork whose signature and declared media type disagree', async () => {
    const result = await importCellarPack(
      await makeCellarPack({
        mutateManifest: (manifest) => {
          manifest.assets['asset-fixture'].mediaType = 'image/jpeg'
        },
      }),
    )

    expect(result.status).toBe('partial')
    expect(result.quarantinedLabels[0].issues.map((issue) => issue.code)).toContain(
      'UNSUPPORTED_IMAGE_TYPE',
    )
  })

  it('quarantines artwork whose decoded dimensions disagree with the manifest', async () => {
    const result = await importCellarPack(
      await makeCellarPack({
        mutateManifest: (manifest) => {
          manifest.assets['asset-fixture'].pixelWidth = 2
        },
      }),
    )

    expect(result.status).toBe('partial')
    expect(result.quarantinedLabels[0].issues.map((issue) => issue.code)).toContain(
      'IMAGE_DIMENSION_MISMATCH',
    )
  })

  it('quarantines a write area that crosses a circular trim edge', async () => {
    const result = await importCellarPack(
      await makeCellarPack({
        mutateManifest: (manifest) => {
          manifest.labels[0].writeInAreas[0].geometry = {
            shape: 'rectangle',
            x: 0,
            y: 0,
            width: 0.35,
            height: 0.2,
          }
        },
      }),
    )

    expect(result.status).toBe('partial')
    expect(result.quarantinedLabels[0].issues.map((issue) => issue.code)).toContain(
      'WRITE_AREA_OUTSIDE_TRIM',
    )
  })

  it('rejects unsupported schema majors', async () => {
    const result = await importCellarPack(
      await makeCellarPack({
        mutateManifest: (manifest) => {
          manifest.schemaVersion = '2.0.0'
        },
      }),
    )

    expect(result.status).toBe('rejected')
    expect(result.issues.map((issue) => issue.code)).toContain('UNSUPPORTED_SCHEMA_MAJOR')
  })

  it('rejects traversal paths before content import', async () => {
    const result = await importCellarPack(
      await makeCellarPack({ extraEntries: [{ path: '../escape.txt', data: 'nope' }] }),
    )

    expect(result.status).toBe('rejected')
    expect(result.issues.map((issue) => issue.code)).toContain('UNSAFE_ZIP_PATH')
  })

  it('rejects case-folded duplicate entry names', async () => {
    const result = await importCellarPack(
      await makeCellarPack({
        extraEntries: [
          { path: 'preview/Label.jpg', data: 'first' },
          { path: 'preview/label.jpg', data: 'second' },
        ],
      }),
    )

    expect(result.status).toBe('rejected')
    expect(result.issues.map((issue) => issue.code)).toContain('DUPLICATE_ENTRY')
  })

  it('rejects a nested archive disguised as inert content', async () => {
    const result = await importCellarPack(
      await makeCellarPack({
        extraEntries: [{ path: 'notes.txt', data: new Uint8Array([0x50, 0x4b, 0x03, 0x04]) }],
      }),
    )

    expect(result.status).toBe('rejected')
    expect(result.issues.map((issue) => issue.code)).toContain('NESTED_ARCHIVE_REJECTED')
  })

  it('rejects active content disguised as inert content', async () => {
    const result = await importCellarPack(
      await makeCellarPack({
        extraEntries: [{ path: 'notes.txt', data: '<script>alert("nope")</script>' }],
      }),
    )

    expect(result.status).toBe('rejected')
    expect(result.issues.map((issue) => issue.code)).toContain('ACTIVE_CONTENT_REJECTED')
  })

  it('rejects malformed manifest JSON', async () => {
    const result = await importCellarPack(await makeCellarPack({ manifestText: '{ nope' }))

    expect(result.status).toBe('rejected')
    expect(result.issues.map((issue) => issue.code)).toContain('INVALID_MANIFEST_JSON')
  })

  it('ignores unknown optional fields in a 1.x manifest', async () => {
    const result = await importCellarPack(
      await makeCellarPack({
        mutateManifest: (manifest) => {
          ;(manifest as CellarPackManifest & { futureField?: unknown }).futureField = {
            enabled: true,
          }
          manifest.schemaVersion = '1.2.0'
        },
      }),
    )

    expect(result.status).toBe('ready')
  })

  it('imports limited research but marks generator conformance false', async () => {
    const result = await importCellarPack(
      await makeCellarPack({
        mutateManifest: (manifest) => {
          manifest.labels[0].research.status = 'limited'
          manifest.labels[0].research.limitations = 'Only one historical source was available.'
        },
      }),
    )

    expect(result.status).toBe('ready')
    expect(result.conformance.generator).toBe('nonconformant')
    expect(result.issues.map((issue) => issue.code)).toContain('LIMITED_RESEARCH')
  })
})


describe('untrusted artifact regression cases', () => {
  it('quarantines a matching-hash PNG header with no pixel data', async () => {
    const manifest = await makeTestManifest()
    const bytes = testPng().slice(0, 29)
    manifest.assets['asset-fixture'].sha256 = await sha256Hex(bytes.buffer)
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(manifest))
    zip.file('artwork/fixture-blend.png', bytes)
    const result = await importCellarPack(await zip.generateAsync({ type: 'arraybuffer' }))
    expect(result.status).toBe('partial')
    expect(result.labels).toHaveLength(0)
    expect(result.quarantinedLabels[0].issues.map((issue) => issue.code)).toContain('UNSUPPORTED_IMAGE_TYPE')
  })

  it('rejects invalid asset-map keys and excessive asset counts', async () => {
    const invalidKey = await importCellarPack(await makeCellarPack({ mutateManifest: (manifest) => {
      manifest.assets['NOT canonical!'] = manifest.assets['asset-fixture']
    } }))
    expect(invalidKey.status).toBe('rejected')
    const excessive = await importCellarPack(await makeCellarPack({ mutateManifest: (manifest) => {
      for (let index = 0; index < 300; index++) manifest.assets[`asset-${index}`] = manifest.assets['asset-fixture']
    } }))
    expect(excessive.status).toBe('rejected')
    expect(excessive.issues.some((issue) => issue.message.includes('300'))).toBe(true)
  })

  it('reports missing contract fields together with preflight failures', async () => {
    const result = await importCellarPack(await makeCellarPack({ manifestText: JSON.stringify({ schemaVersion: 1, labels: [{}] }) }))
    expect(result.status).toBe('rejected')
    expect(result.issues.some((issue) => issue.message.includes('artworkAssetId'))).toBe(true)
    expect(result.issues.some((issue) => issue.message.includes('generator'))).toBe(true)
    expect(result.issues.some((issue) => issue.path === 'schemaVersion')).toBe(true)
  })

  it('stops a forged-size compressed stream at the declared byte limit', async () => {
    const zip = await JSZip.loadAsync(await makeCellarPack())
    zip.file('notes.txt', new Uint8Array(1024 * 1024))
    const bytes = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
    const view = new DataView(bytes)
    for (let offset = 0; offset + 46 < bytes.byteLength; offset++) {
      if (view.getUint32(offset, true) !== 0x02014b50) continue
      const name = new TextDecoder().decode(new Uint8Array(bytes, offset + 46, view.getUint16(offset + 28, true)))
      if (name === 'notes.txt') view.setUint32(offset + 24, 1, true)
    }
    const result = await importCellarPack(bytes)
    expect(result.status).toBe('rejected')
    expect(result.issues.some((issue) => issue.code === 'ZIP_LIMIT_EXCEEDED')).toBe(true)
  })
})


it('enforces the pack pixel budget before decoding the next image', async () => {
  // Header dimensions deliberately simulate large artwork without allocating it.
  const decoder = vi.spyOn(imageModule, 'validateImageDecoding').mockResolvedValue(undefined)
  try {
    const manifest = await makeTestManifest()
    const bytes = testPng()
    new DataView(bytes.buffer).setUint32(16, 8000)
    new DataView(bytes.buffer).setUint32(20, 8000)
    manifest.assets['asset-fixture'].pixelWidth = 8000
    manifest.assets['asset-fixture'].pixelHeight = 8000
    manifest.assets['asset-fixture'].sha256 = await sha256Hex(bytes.buffer)
    manifest.labels = Array.from({ length: 4 }, (_, index) => ({ ...structuredClone(manifest.labels[0]), id: `label-${index}` }))
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(manifest))
    zip.file('artwork/fixture-blend.png', bytes)
    const result = await importCellarPack(await zip.generateAsync({ type: 'arraybuffer' }))
    expect(result.status).toBe('rejected')
    expect(result.issues.some((issue) => issue.code === 'IMAGE_LIMIT_EXCEEDED')).toBe(true)
    expect(decoder).toHaveBeenCalledTimes(3)
  } finally { decoder.mockRestore() }
})
