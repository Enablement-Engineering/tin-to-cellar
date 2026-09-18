import { expect, it } from 'vitest'
import { decode } from 'fast-png'
import { galleryPreview, validGalleryPreview } from './preview'

it('keeps previews under 1200 characters even for noisy opaque pixels', () => {
  const data = new Uint8Array(320 * 320 * 4)
  for (let i = 0; i < data.length; i++) data[i] = (i * 73 + Math.floor(i / 320)) % 256
  const preview = galleryPreview(data, 320, 320, 4)
  expect(validGalleryPreview(preview)).toBe(true)
  const png = decode(Uint8Array.from(atob(preview.split(',')[1]), char => char.charCodeAt(0)))
  expect([png.width, png.height]).toEqual([12, 12])
})

it('excludes hidden RGB from transparent pixels and preserves alpha', () => {
  const data = new Uint8Array(320 * 320 * 4)
  for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 2] = 255 }
  const preview = galleryPreview(data, 320, 320, 4)
  data.fill(0)
  expect(galleryPreview(data, 320, 320, 4)).toBe(preview)
  expect(() => galleryPreview(data, 321, 320, 4)).toThrow('invalid_thumbnail')
  expect(validGalleryPreview('https://example.com/tracker.png')).toBe(false)
  expect(validGalleryPreview('data:image/svg+xml;base64,aaaa')).toBe(false)
})
