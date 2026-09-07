export class BodyReadError extends Error {
  readonly status: 400 | 408 | 413
  constructor(message: string, status: 400 | 408 | 413) { super(message); this.name = 'BodyReadError'; this.status = status }
}

/** Read at most maxBytes within one deadline, including slow or stalled streams. */
export async function boundedJson(request: Request, { maxBytes, timeoutMs = 5000 }: { maxBytes: number; timeoutMs?: number }): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) throw new BodyReadError('Missing body', 400)
  const chunks: Uint8Array[] = []
  let size = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BodyReadError('Body read timed out', 408)), timeoutMs)
  })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline])
      if (done) break
      size += value.length
      if (size > maxBytes) throw new BodyReadError('Body is too large', 413)
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
    catch { throw new BodyReadError('Invalid JSON body', 400) }
  } catch (error) {
    if (error instanceof BodyReadError) throw error
    throw new BodyReadError('Body could not be read', 400)
  } finally {
    clearTimeout(timer)
    // Cancellation must not extend the deadline when an underlying source stalls.
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
