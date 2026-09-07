import { useState } from 'react'

export function GalleryThumbnail({ src, alt, eager }: { src: string; alt: string; eager: boolean }) {
  const [state, setState] = useState<'pending' | 'loaded' | 'error'>('pending')
  return <span className={`gallery-thumbnail gallery-thumbnail--${state}`}>
    <img src={src} alt={alt} width={320} height={320} loading={eager ? 'eager' : 'lazy'} decoding="async"
      onLoad={() => setState('loaded')} onError={() => setState('error')} />
  </span>
}
