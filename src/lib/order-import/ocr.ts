export async function readOrderImage(file: File, onProgress: (progress: number) => void, signal: AbortSignal): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.')
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP screenshot.')
  const bitmap = await createImageBitmap(file)
  const pixels = bitmap.width * bitmap.height
  if (pixels > 20_000_000) { bitmap.close(); throw new Error('This image is too large. Crop it to the product list.') }
  // Small receipt text is much more reliable at roughly document-scan resolution.
  const scale = Math.min(2, 2400 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * Math.max(1, scale))
  canvas.height = Math.round(bitmap.height * Math.max(1, scale))
  const context = canvas.getContext('2d')
  if (!context) { bitmap.close(); throw new Error('This browser cannot read images. Try pasting the product list.') }
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  signal.throwIfAborted()
  const { createWorker, PSM } = await import('tesseract.js')
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined
  let cancel: () => void = () => {}
  const aborted = new Promise<never>((_, reject) => {
    cancel = () => { reject(new DOMException('Cancelled', 'AbortError')) }
  })
  signal.addEventListener('abort', cancel, { once: true })
  const pendingWorker = createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr',
    workerBlobURL: false,
    logger: (event) => { if (!signal.aborted && event.status === 'recognizing text') onProgress(Math.round(event.progress * 100)) },
  }).then(async (created) => {
    if (signal.aborted) { await created.terminate(); throw new DOMException('Cancelled', 'AbortError') }
    return created
  })
  try {
    if (signal.aborted) cancel()
    worker = await Promise.race([pendingWorker, aborted])
    await Promise.race([worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT }), aborted])
    const result = await Promise.race([worker.recognize(canvas), aborted])
    if (!result.data.text.trim()) throw new Error('No readable text found. Try a clearer screenshot of the product list.')
    return result.data.text
  } finally { signal.removeEventListener('abort', cancel); await worker?.terminate() }
}
