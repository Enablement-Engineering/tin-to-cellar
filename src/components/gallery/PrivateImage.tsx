import { useEffect, useState } from 'react'
import { API } from './client'
export function PrivateImage({ id, kind = 'thumbnail', alt, className = '' }: { id: string; kind?: 'thumbnail' | 'artwork'; alt: string; className?: string }) {
  const [image, setImage] = useState<{ id: string; url: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController(); let url = ''
    void fetch(`${API}/admin/submissions/${id}/${kind}`, { signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer' }).then(async response => {
      if (!response.ok) return
      const blob = await response.blob()
      if (!controller.signal.aborted) { url = URL.createObjectURL(blob); setImage({ id, url }) }
    }).catch(() => {})
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [id, kind])
  return image?.id === id ? <img className={className} src={image.url} alt={alt} /> : <span className="gallery-thumbnail-placeholder" aria-label="Preview unavailable">Preview</span>
}
