import JSZip from 'jszip'
import type { CellarPackManifest } from './types'

const ONE_PIXEL_RGBA_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII='

export function testPng(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(ONE_PIXEL_RGBA_PNG_BASE64), (character) => character.charCodeAt(0))
}

export async function makeTestManifest(): Promise<CellarPackManifest> {
  const image = testPng()
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(image).buffer)
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return {
    format: 'tin-to-cellar/cellarpack',
    schemaVersion: '0.1.0',
    packId: 'urn:uuid:43649b43-8094-4a32-b5ee-8be75208fb63',
    createdAt: '2026-08-31T18:10:00Z',
    generator: { name: 'Tin to Cellar test fixture', version: '1.0.0' },
    labels: [
      {
        id: 'fixture-blend',
        maker: 'Fixture Maker',
        blend: 'Fixture Blend',
        artworkAssetId: 'asset-fixture',
        surface: {
          shape: 'circle',
          finishedSize: { width: 0.002, height: 0.002, unit: 'in' },
          bleed: { top: 0, right: 0, bottom: 0, left: 0, unit: 'in' },
          safeInset: { top: 0.0001, right: 0.0001, bottom: 0.0001, left: 0.0001, unit: 'in' },
        },
        writeInAreas: [
          {
            id: 'jarred-date',
            purpose: 'jarred-date',
            geometry: {
              shape: 'rounded-rectangle',
              x: 0.35,
              y: 0.46,
              width: 0.3,
              height: 0.08,
              cornerRadius: 0.04,
            },
            background: {
              integratedInArtwork: true,
              appearance: 'opaque warm cream',
              minimumContrastWithInk: 'high',
            },
            overlay: {
              mode: 'blank',
            },
          },
        ],
        research: {
          status: 'complete',
          observedPackage: {
            format: 'round tin',
            variant: 'fixture package variant',
            variantDateOrEdition: 'unknown',
          },
          visualAnalysis: {
            palette: ['cream', 'brown'],
            motifs: ['fixture ornament'],
            border: 'single dark rule',
            typography: 'heritage serif',
            hierarchy: 'blend then maker',
            style: 'traditional tobacconist',
          },
          sources: [
            {
              id: 'fixture-package-source',
              type: 'web',
              role: 'package-appearance',
              url: 'https://example.com/fixture',
              title: 'Fixture package image',
              retrievedAt: '2026-08-31T18:00:00Z',
            },
          ],
          adaptationSummary: 'Adapted the fixture package to a circular label with a light date field.',
        },
      },
    ],
    assets: {
      'asset-fixture': {
        path: 'artwork/fixture-blend.png',
        mediaType: 'image/png',
        pixelWidth: 1,
        pixelHeight: 1,
        sha256,
        colorSpace: 'sRGB',
        alpha: true,
      },
    },
  }
}

export async function makeCellarPack(options: {
  mutateManifest?: (manifest: CellarPackManifest) => void
  extraEntries?: Array<{ path: string; data: string | Uint8Array }>
  manifestText?: string
} = {}): Promise<ArrayBuffer> {
  const manifest = await makeTestManifest()
  options.mutateManifest?.(manifest)
  const zip = new JSZip()
  zip.file('manifest.json', options.manifestText ?? JSON.stringify(manifest))
  zip.file('artwork/fixture-blend.png', testPng())
  for (const entry of options.extraEntries ?? []) zip.file(entry.path, entry.data)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}
