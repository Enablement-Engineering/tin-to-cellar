// Review-only Avery 94502 guide; bundled into the Worker, never printed as artwork.
import { encode } from 'fast-png'
import { writeFile } from 'node:fs/promises'
const size = 1254, trim = 570, safe = 513, stroke = size / 600
const data = new Uint8Array(size * size * 4)
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  const offset = (y * size + x) * 4
  const dx = x + 0.5 - size / 2, dy = y + 0.5 - size / 2
  const radius = Math.hypot(dx, dy)
  if (radius > trim) data.set([240, 240, 240, 179], offset)
  const isTrim = Math.abs(radius - trim) < stroke
  const isSafe = Math.abs(radius - safe) < stroke && Math.floor((Math.atan2(dy, dx) + Math.PI) * safe / 10.5) % 2 === 0
  if (isTrim || isSafe) data.set(isTrim ? [0, 175, 220, 255] : [220, 0, 160, 255], offset)
}
await writeFile(new URL('../worker/avery-94502-proof-overlay.png', import.meta.url), encode({ width: size, height: size, channels: 4, data }))
