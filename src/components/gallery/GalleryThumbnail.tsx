import { validGalleryPreview } from '../../lib/gallery/preview'
import { GalleryImage } from './GalleryImage'

export function GalleryThumbnail({ src, alt, eager, preview }: { src: string; alt: string; eager: boolean; preview?: string }) {
  return <GalleryImage className="gallery-thumbnail" src={src} preview={validGalleryPreview(preview) ? preview : undefined} alt={alt} eager={eager} />
}
