import { useEffect, useState } from 'react'
import type { GalleryHistoryEvent, GalleryRecommendation, GalleryReviewRecord } from '../../lib/gallery/types'
import { publicReference } from '../../lib/gallery/schema'
import { errorText, request } from './client'

export function ReviewEvidence({ record, compact = false }: { record: GalleryReviewRecord; compact?: boolean }) {
  const [recommendations, setRecommendations] = useState<GalleryRecommendation[]>([])
  const [events, setEvents] = useState<GalleryHistoryEvent[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      request<{ recommendations: GalleryRecommendation[] }>(`/admin/submissions/${record.id}/recommendations`, { signal: controller.signal }),
      compact ? Promise.resolve({ events: [] as GalleryHistoryEvent[], nextCursor: null }) : request<{ events: GalleryHistoryEvent[]; nextCursor: string | null }>(`/admin/submissions/${record.id}/history`, { signal: controller.signal }),
    ]).then(([advice, history]) => { if (!controller.signal.aborted) { setRecommendations(advice.recommendations ?? []); setEvents(history.events ?? []); setCursor(history.nextCursor ?? null) } }).catch(cause => { if (!controller.signal.aborted) setError(errorText(cause)) })
    return () => controller.abort()
  }, [record.id, record.version, compact])
  const more = async () => {
    try { const result = await request<{ events: GalleryHistoryEvent[]; nextCursor: string | null }>(`/admin/submissions/${record.id}/history?cursor=${encodeURIComponent(cursor ?? '')}`); setEvents(old => [...old, ...result.events]); setCursor(result.nextCursor) }
    catch (cause) { setError(errorText(cause)) }
  }
  const metadata = record.metadata
  const current = recommendations.filter(item => record.state === 'pending' && !item.stale && item.version === record.version && item.digest === record.digest)
  const stale = recommendations.filter(item => !current.includes(item))
  const warnings = current.flatMap(item => item.recommendation.findings.filter(finding => finding.severity === 'warning'))
  const sources = metadata?.evidence?.references ?? []
  const advice = (items: GalleryRecommendation[]) => items.map(item => <article className="gallery-advice" key={item.id}>
    <h4>{item.recommendation.assessment.replaceAll('-', ' ')}</h4><p>{item.actorLabel} · Version {item.version} · {new Date(item.createdAt).toLocaleString()}</p>
    {item.recommendation.findings.map((finding, index) => <div key={index}><strong>{finding.category.replaceAll('-', ' ')} · {finding.severity}</strong><p>{finding.explanation}</p>{finding.evidence?.map((pointer, i) => <p className="field-hint" key={i}>{pointer.type === 'metadata' ? `Metadata field: ${pointer.field}` : pointer.type === 'reference' ? `Supplied reference: ${pointer.url}` : pointer.type === 'duplicate' ? `Existing design: ${pointer.publicationId}` : pointer.region ? `Artwork region: x ${pointer.region.x}, y ${pointer.region.y}, width ${pointer.region.width}, height ${pointer.region.height}` : 'Full artwork'}</p>)}</div>)}
    {item.recommendation.suggestedCatalogId && <p>Suggested catalog ID: {item.recommendation.suggestedCatalogId}</p>}
  </article>)
  return <div className="gallery-review-evidence">
    {warnings.length > 0 && <section aria-label="Review warnings"><h3>Needs attention</h3>{warnings.map((finding, index) => <p key={index}>{finding.explanation}</p>)}</section>}
    {error && <p role="alert">Review evidence could not load. {error}</p>}
    <details><summary>Sources ({sources.length})</summary>
      {!sources.length && <p>No public source links supplied.</p>}
      {sources.map((source, index) => <p key={index}>{publicReference(source.url) ? <a href={source.url} target="_blank" rel="noreferrer">{source.role === 'package-appearance' ? 'Package appearance' : 'Variant identification'}: {source.url}</a> : source.url}</p>)}
      {metadata?.evidence?.package && <p>Package: {metadata.evidence.package}</p>}{metadata?.evidence?.variant && <p>Variant: {metadata.evidence.variant}</p>}
    </details>
    {!compact && <><details><summary>Geometry and validation</summary>
      {metadata && <p>2.5-inch circle · 0.125-inch bleed and safe inset · {metadata.image.width} × {metadata.image.height} pixels</p>}
      {metadata && <p>Blank writing area: {metadata.writingArea.shape}, x {metadata.writingArea.x}, y {metadata.writingArea.y}, width {metadata.writingArea.width}, height {metadata.writingArea.height}. Coordinates are relative to the finished label.</p>}
      <p>{record.validation?.imageValidated ? 'Image format and geometry checks passed.' : 'Image validation has not been confirmed.'} Inspect lettering, package appearance, and the blank writing area before approving.</p>
    </details>
    <details><summary>Image and metadata integrity</summary><dl className="gallery-facts gallery-digest">{[['Uploaded PNG SHA-256', record.uploadedHash], ['Canonical artwork SHA-256', record.canonicalHash], ['Metadata SHA-256', record.metadataHash], ['Approval digest', record.digest]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not available'}</dd></div>)}</dl><p>Hashes identify the artwork and reviewed version.</p></details></>}
    <details><summary>Agent recommendations ({current.length})</summary><p className="field-hint">Advisory only. Recommendations do not approve labels.</p>{current.length ? advice(current) : <p>No recommendations for this version.</p>}{stale.length > 0 && <details><summary>Stale recommendations ({stale.length})</summary>{advice(stale)}</details>}</details>
    {!compact && <details><summary>Review history</summary>{events.length ? <ol className="gallery-timeline">{events.map(event => <li key={event.id}><strong>{event.action.replaceAll('-', ' ')}</strong><p>{event.actorType} · {event.actor} · {new Date(event.createdAt).toLocaleString()}{event.version !== null ? ` · Version ${event.version}` : ''}</p>{event.result && <p>{event.result}</p>}</li>)}</ol> : <p>No recorded activity yet.</p>}{cursor && <button className="button secondary" onClick={() => void more()}>More history</button>}</details>}
  </div>
}
