import { DEFAULT_PROOF_GEOMETRY, MAX_PROOF_BYTES, MAX_PROOF_SIZE, proofGeometry } from '../src/lib/proof/geometry'
import overlay from './avery-94502-proof-overlay.png'

interface ImageHandle {
  transform(options: { width: number; height: number }): ImageHandle
  draw(image: ImageHandle, options: { left: number; top: number }): ImageHandle
  output(options: { format: 'image/png' }): Promise<{ response(options?: { headers: Record<string, string> }): Response }>
}
export interface ProofImages { input(stream: ReadableStream<Uint8Array>): ImageHandle }

const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
export async function proofResponse(request: Request, images?: ProofImages, admit: () => Promise<Response | null> = async () => Response.json({ error: 'Proof allowance unavailable.' }, { status: 503, headers })): Promise<Response> {
  if (request.method === 'GET') return Response.json({
    version: 1, purpose: 'Circular label review proof, never printable artwork',
    method: 'POST', contentType: 'image/png', body: 'Raw PNG bytes, not JSON or multipart',
    authorization: 'Bearer credential from Enable hosted image checks on the website. Without access, or on 401/429/503, use local guides; do not retry repeatedly.',
    parameters: { units: 'inches', ...DEFAULT_PROOF_GEOMETRY },
    supportedProfile: 'Avery 94502 only: diameter=2.5, bleed=0.125, safe=0.125. Other geometries must use local guides.',
    limits: { bytes: MAX_PROOF_BYTES, squarePixels: '128–2048', encoding: '8-bit RGB/RGBA, non-interlaced PNG' },
    response: 'image/png; save the response and visually inspect it alongside the package reference',
    legend: { cyan: 'finished trim', magentaDashed: 'safe boundary for essential artwork', shaded: 'bleed outside trim' },
    storesUploads: false, modifiesOriginal: false,
    limitations: 'Guides are geometric, not automatic visual validation. Never include the proof in artwork assets. If unavailable, make equivalent guides locally and continue.',
  }, { headers })
  if (request.method !== 'POST') return Response.json({ error: 'Use GET or POST.' }, { status: 405, headers: { ...headers, Allow: 'GET, POST' } })
  if (request.headers.has('Content-Encoding')) return Response.json({ error: 'Send an uncompressed PNG body.' }, { status: 415, headers })
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'image/png') return Response.json({ error: 'Send raw image/png bytes.' }, { status: 415, headers })
  if (Number(request.headers.get('Content-Length')) > MAX_PROOF_BYTES) return Response.json({ error: 'Maximum upload is 8 MiB.' }, { status: 413, headers })
  if (!images) return Response.json({ error: 'Native proof rendering is not configured. Create guides locally.' }, { status: 503, headers })
  const reader = request.body?.getReader()
  if (!reader) return Response.json({ error: 'Missing PNG.' }, { status: 400, headers })
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}) }, 10000)
  try {
    const geometry = proofGeometry(new URL(request.url).searchParams)
    if (geometry.diameter !== 2.5 || geometry.bleed !== 0.125 || geometry.safe !== 0.125) throw new Error('Hosted proofs currently support Avery 94502 only. Create guides locally for other dimensions.')
    const chunks: Uint8Array[] = []; let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (timedOut) return Response.json({ error: 'Upload timed out. Create review guides locally.' }, { status: 408, headers })
      if (done) break
      size += value.length
      if (size > MAX_PROOF_BYTES) { await reader.cancel(); return Response.json({ error: 'Maximum upload is 8 MiB.' }, { status: 413, headers }) }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    // Cloudflare's native compositor handles full decoding; keep JS work below Free-plan CPU limits.
    const signature = [137, 80, 78, 71, 13, 10, 26, 10]
    if (bytes.length < 33 || signature.some((value, index) => bytes[index] !== value)) throw new Error('Invalid PNG.')
    const view = new DataView(bytes.buffer)
    const width = view.getUint32(16), height = view.getUint32(20)
    if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') throw new Error('Invalid PNG header.')
    if (width !== height || width < 128 || width > MAX_PROOF_SIZE) throw new Error('Use a square PNG from 128 to 2048 pixels.')
    if (bytes[24] !== 8 || ![2, 6].includes(bytes[25]) || bytes[26] || bytes[27] || bytes[28]) throw new Error('Use non-interlaced 8-bit RGB/RGBA PNG.')
    // Reject truncated containers and animation before admitting native image work.
    let position = 8, dataSeen = false, ended = false
    while (position + 12 <= bytes.length) {
      const length = view.getUint32(position)
      if (length > bytes.length - position - 12) throw new Error('Truncated PNG.')
      const type = String.fromCharCode(...bytes.slice(position + 4, position + 8))
      if (['acTL', 'fcTL', 'fdAT'].includes(type)) throw new Error('Animated PNG is not supported.')
      if (type === 'IDAT' && length > 0) dataSeen = true
      position += length + 12
      if (type === 'IEND') { ended = length === 0 && position === bytes.length; break }
    }
    if (!dataSeen || !ended) throw new Error('Incomplete PNG.')
    clearTimeout(timeout)
    const rejected = await admit()
    if (rejected) return rejected
    const result = await images.input(new Response(bytes).body!)
      .draw(images.input(new Response(overlay).body!).transform({ width, height }), { top: 0, left: 0 })
      .output({ format: 'image/png' })
    return result.response({ headers: {
      ...headers, 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="label-review-proof.png"',
      'X-Proof-Trim-Radius': String(width * 2.5 / 2.75 / 2), 'X-Proof-Safe-Radius': String(width * 2.25 / 2.75 / 2),
      'X-Proof-Only': 'true',
    } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to create proof.' }, { status: 400, headers })
  } finally { clearTimeout(timeout); void reader.cancel().catch(() => {}); reader.releaseLock() }
}
