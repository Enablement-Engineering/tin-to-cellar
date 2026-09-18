import { encode } from 'fast-png'

/** A bounded, alpha-aware preview from already decoded pixels. Never touches original artwork. */
export function galleryPreview(data: Uint8Array, width: number, height: number, channels: number): string {
  if (width !== 320 || height !== 320 || ![3, 4].includes(channels) || data.length !== width * height * channels) throw new Error('invalid_thumbnail')
  const size = 12, pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let alpha = 0, red = 0, green = 0, blue = 0, count = 0
    for (let sy = Math.floor(y * height / size); sy < Math.floor((y + 1) * height / size); sy++) {
      for (let sx = Math.floor(x * width / size); sx < Math.floor((x + 1) * width / size); sx++) {
        const at = (sy * width + sx) * channels, a = channels === 4 ? data[at + 3] : 255
        alpha += a; red += data[at] * a; green += data[at + 1] * a; blue += data[at + 2] * a; count++
      }
    }
    const at = (y * size + x) * 4
    pixels[at] = alpha ? Math.round(red / alpha) : 0
    pixels[at + 1] = alpha ? Math.round(green / alpha) : 0
    pixels[at + 2] = alpha ? Math.round(blue / alpha) : 0
    pixels[at + 3] = Math.round(alpha / count)
  }
  const png = encode({ width: size, height: size, channels: 4, depth: 8, data: pixels })
  return `data:image/png;base64,${btoa(String.fromCharCode(...png))}`
}

export function validGalleryPreview(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 1200 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
}
