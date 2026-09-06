import type JSZip from 'jszip'

export class ExtractionLimitError extends Error {}

/** Stop the inflater as soon as actual output exceeds the permitted byte budget. */
export function extractBounded(entry: JSZip.JSZipObject, maxBytes: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let size = 0
    let stopped = false
    // JSZip 3.10 exposes this documented streaming API but omits it from JSZipObject typings.
    const stream = (entry as JSZip.JSZipObject & {
      internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array>
    }).internalStream('uint8array')
    stream.on('data', (chunk: Uint8Array) => {
      if (stopped) return
      size += chunk.byteLength
      if (size > maxBytes) {
        stopped = true
        stream.pause()
        chunks.length = 0
        reject(new ExtractionLimitError('Actual decompressed bytes exceed the entry or pack limit.'))
        return
      }
      chunks.push(chunk)
    })
    stream.on('error', (error: Error) => {
      if (stopped) return
      stopped = true
      chunks.length = 0
      reject(error)
    })
    stream.on('end', () => {
      if (stopped) return
      const result = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.byteLength
      }
      resolve(result)
    })
    stream.resume()
  })
}
