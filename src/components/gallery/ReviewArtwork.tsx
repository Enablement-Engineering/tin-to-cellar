import { useEffect, useState } from 'react'
import { API, errorText } from './client'

export function ReviewArtwork({ id, alt, onReady }: { id: string; alt: string; onReady: (ready: boolean) => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl = ''
    void fetch(`${API}/admin/submissions/${id}/artwork`, { signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer' }).then(async response => {
      if (!response.ok) throw new Error('Artwork is unavailable. Reload this submission to try again.')
      const blob = await response.blob()
      if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) }
    }).catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id])
  return <div className="review-artwork">
    {error ? <p role="alert">{error}</p> : url ? <a href={url} target="_blank" rel="noreferrer">
      <img className="gallery-review-art" src={url} alt={alt} onLoad={() => onReady(true)} onError={() => { onReady(false); setError('Artwork could not be displayed. Reload this submission to try again.') }} />
      <span>Open full-resolution artwork</span>
    </a> : <p role="status">Loading artwork…</p>}
  </div>
}
