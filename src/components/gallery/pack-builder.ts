import { importCellarPack } from '../../lib/cellarpack'
import type { CellarPackImportResult } from '../../lib/cellarpack/types'

import { validChoice, type PackChoice } from './pack-selection'

type PublicationDownloadOptions = { signal?: AbortSignal; fetcher?: typeof fetch }

/** Download and validate one current publication without fetching research links. */
export async function downloadPublishedPack(choice: PackChoice, { signal, fetcher = fetch }: PublicationDownloadOptions = {}): Promise<{ file: File; result: CellarPackImportResult }> {
  if (!validChoice(choice)) throw new Error('Choose a valid community label.')
  signal?.throwIfAborted()
  const timeout = AbortSignal.timeout(30000)
  const response = await fetcher(`/api/gallery/v1/labels/${choice.id}/pack`, { cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout, referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error(`${choice.maker} ${choice.blend} could not be downloaded. It may no longer be available. Retry or choose another design.`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error('The pack download was empty. Please try again.')
  const chunks: Uint8Array[] = []; let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break
      size += value.length
      if (size > 19 * 1024 * 1024) { await reader.cancel(); throw new Error('This community label download is too large. Choose another design.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  signal?.throwIfAborted()
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  const result = await importCellarPack(bytes.buffer)
  signal?.throwIfAborted()
  if (result.status !== 'ready' || result.labels.length !== 1 || result.quarantinedLabels.length) throw new Error(`${choice.maker} ${choice.blend} failed its pack checks. Retry or choose another design.`)
  if (result.labels[0].artwork.mediaType !== 'image/png') throw new Error('This gallery artwork is not a PNG.')
  return { file: new File([bytes.buffer], 'community-label.cellarpack.zip', { type: 'application/zip' }), result }
}
