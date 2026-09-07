import { useEffect, useState } from 'react'
export const API = '/api/gallery/v1'
export type GalleryConfig = { intake: boolean; serving: boolean; noticeVersion: string; turnstileSiteKey: string }
export async function request<T>(path: string, init: RequestInit = {}, capability?: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...(init.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(capability ? { Authorization: `Bearer ${capability}` } : {}), ...init.headers }, cache: 'no-store', referrerPolicy: 'no-referrer' })
  if (!response.ok) {
    if (response.status === 409) throw new Error('This submission changed. Refresh its status before trying again.')
    if (response.status === 401 || response.status === 403) throw new Error('Access was not confirmed. Please try again.')
    if (response.status === 404) throw new Error('This item is unavailable.')
    if (response.status === 429) throw new Error('Sharing is at its current limit. Please try again later; you can still print.')
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(`The request was not completed${body.error ? ` (${body.error.replaceAll('_', ' ')})` : ''}.`)
  }
  return response.json() as Promise<T>
}
export function useConfig() {
  const [config, setConfig] = useState<GalleryConfig | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { let alive = true; request<GalleryConfig>('/config').then(value => { if (alive) setConfig(value) }).catch(() => { if (alive) setError('The community library is unavailable right now. Local printing still works.') }); return () => { alive = false } }, [])
  return { config, error }
}
export function errorText(error: unknown) { return error instanceof Error ? error.message : 'The request could not be confirmed. Please try again.' }

export class GalleryUploadError extends Error {
  readonly retryable: boolean
  constructor(message: string, retryable: boolean) { super(message); this.name = 'GalleryUploadError'; this.retryable = retryable }
}
export async function uploadFailure(response: Response): Promise<GalleryUploadError> {
  const result = await response.json().catch(() => null) as { error?: unknown } | null
  const code = typeof result?.error === 'string' && result.error.length <= 64 ? result.error : ''
  if (code === 'rate_limited') return new GalleryUploadError('Uploads are temporarily at their limit. Wait a minute, then retry this label. You can still print it.', true)
  const permanent: Record<string, string> = {
    unsupported_image: 'This artwork is not supported for sharing. Use a static, non-interlaced, 8-bit RGB or RGBA sRGB PNG without an embedded ICC profile, then rebuild and re-import the pack. You can still print this label.',
    image_mismatch: 'The uploaded artwork does not match its recorded image details. Re-import the original validated pack before sharing. You can still print your open labels.',
    invalid_geometry: 'This circle or blank writing area is not supported for sharing. Correct the artwork and pack geometry, then re-import the pack. You can still print your open labels.',
    limit_exceeded: 'This image exceeds the sharing size limit. Rebuild and re-import a pack with artwork within the stated limits. You can still print this label.',
    expired: 'This upload reservation has expired. Start a new submission if you still want to share this label. You can still print it.',
    upload_attempts_exhausted: 'This submission has used its upload attempts. Start a new submission to try sharing again. You can still print this label.',
  }
  if (permanent[code]) return new GalleryUploadError(permanent[code], false)
  return new GalleryUploadError(code === 'intake_closed' ? 'Sharing is paused. Keep this tab open and try again later. You can still print this label.' : 'Artwork upload was not confirmed. Keep this tab open and retry this label.', true)
}
