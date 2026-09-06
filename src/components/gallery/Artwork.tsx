import { useEffect, useState } from 'react'
export function Artwork({ data, alt }: { data: ArrayBuffer; alt: string }) {
  const [url, setUrl] = useState('')
  // Blob URLs are external resources whose lifetime follows these artwork bytes.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { const next = URL.createObjectURL(new Blob([data])); setUrl(next); return () => URL.revokeObjectURL(next) }, [data])
  return url ? <img src={url} alt={alt} /> : null
}
