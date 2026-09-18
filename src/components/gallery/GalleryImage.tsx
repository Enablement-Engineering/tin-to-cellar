import { useEffect, useRef, useState } from 'react'
import '../../styles/gallery-image.css'

type Props = { src: string; preview?: string; alt: string; eager?: boolean; className?: string; errorMessage?: string }

export function GalleryImage(props: Props) {
  // A replacement source gets fresh load state, including cached images and in-flight decodes.
  return <ImageContent key={props.src} {...props} />
}

function ImageContent({ src, preview, alt, eager = true, className = '', errorMessage }: Props) {
  const image = useRef<HTMLImageElement>(null)
  const [state, setState] = useState<'pending' | 'loaded' | 'error'>('pending')
  const [previewFailed, setPreviewFailed] = useState(false)
  useEffect(() => {
    const element = image.current!
    let active = true
    const fail = () => { if (active) setState('error') }
    const finish = async () => {
      try {
        await element.decode()
        if (active) setState('loaded')
      } catch { fail() }
    }
    element.addEventListener('load', finish)
    element.addEventListener('error', fail)
    if (element.complete) { if (element.naturalWidth) void finish(); else fail() }
    return () => { active = false; element.removeEventListener('load', finish); element.removeEventListener('error', fail) }
  }, [])
  return <span className={`gallery-image gallery-image--${state} ${className}`}>
    {preview && !previewFailed && <img className="gallery-image-placeholder" src={preview} alt="" aria-hidden="true" onError={() => setPreviewFailed(true)} />}
    <img ref={image} className="gallery-image-main" src={src} alt={alt} width={320} height={320} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    {state === 'error' && <span className="gallery-image-error" role={errorMessage ? 'alert' : undefined}>{errorMessage ?? 'Image unavailable'}</span>}
  </span>
}
