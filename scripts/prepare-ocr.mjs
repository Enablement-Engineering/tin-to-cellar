import { copyFile, mkdir, readdir } from 'node:fs/promises'
await mkdir('public/ocr', { recursive: true })
await copyFile('node_modules/tesseract.js/dist/worker.min.js', 'public/ocr/worker.min.js')
for (const name of await readdir('node_modules/tesseract.js-core')) {
  if (name.endsWith('.wasm.js') || name.endsWith('.wasm')) await copyFile(`node_modules/tesseract.js-core/${name}`, `public/ocr/${name}`)
}
await copyFile('node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz', 'public/ocr/eng.traineddata.gz')
