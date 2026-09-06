import { useEffect, useState } from 'react'
import type { GalleryHistoryEvent, GalleryRecommendation, GalleryReviewRecord } from '../../lib/gallery/types'
import { errorText, request } from './client'
import { PrivateImage } from './PrivateImage'
export function ReviewEvidence({ record }: { record: GalleryReviewRecord }) {
  const [recommendations, setRecommendations] = useState<GalleryRecommendation[]>([])
  const [events, setEvents] = useState<GalleryHistoryEvent[]>([])
  const [cursor, setCursor] = useState<string | null>(null), [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      request<{ recommendations: GalleryRecommendation[] }>(`/admin/submissions/${record.id}/recommendations`, { signal: controller.signal }),
      request<{ events: GalleryHistoryEvent[]; nextCursor: string | null }>(`/admin/submissions/${record.id}/history`, { signal: controller.signal }),
    ]).then(([advice, history]) => { setRecommendations(advice.recommendations ?? []); setEvents(history.events ?? []); setCursor(history.nextCursor ?? null) }).catch(e => { if (!controller.signal.aborted) setError(errorText(e)) })
    return () => controller.abort()
  }, [record.id, record.version])
  const more = async () => { try { const result = await request<{ events: GalleryHistoryEvent[]; nextCursor: string | null }>(`/admin/submissions/${record.id}/history?cursor=${encodeURIComponent(cursor ?? '')}`); setEvents(old => [...old, ...result.events]); setCursor(result.nextCursor) } catch (e) { setError(errorText(e)) } }
  const metadata = record.metadata
  const current = recommendations.filter(item => record.state === 'pending' && !item.stale && item.version === record.version && item.digest === record.digest)
  const stale = recommendations.filter(item => !current.includes(item))
  const advice = (items: GalleryRecommendation[]) => items.map(item => <article className="gallery-advice" key={item.id}>
    <h4>{item.recommendation.assessment.replaceAll('-', ' ')}</h4><p>{item.actorLabel} · Version {item.version} · {new Date(item.createdAt).toLocaleString()}</p>
    {item.recommendation.findings.map((finding, index) => <div key={index}><strong>{finding.category.replaceAll('-', ' ')} · {finding.severity}</strong><p>{finding.explanation}</p>{finding.evidence?.map((pointer, i) => <p className="field-hint" key={i}>{pointer.type === 'metadata' ? `Metadata field: ${pointer.field}` : pointer.type === 'reference' ? `Supplied reference: ${pointer.url}` : pointer.type === 'duplicate' ? `Existing design: ${pointer.publicationId}` : pointer.region ? `Artwork region: x ${pointer.region.x}, y ${pointer.region.y}, width ${pointer.region.width}, height ${pointer.region.height}` : 'Full artwork'}</p>)}</div>)}
    {item.recommendation.suggestedCatalogId && <p>Suggested catalog ID: {item.recommendation.suggestedCatalogId}</p>}
  </article>)
  return <div className="gallery-review-evidence">
    <details><summary>Geometry and validation</summary>{metadata && <><PrivateImage id={record.id} alt="Submitted label thumbnail" className="gallery-detail-thumbnail" /><dl className="gallery-facts"><dt>Finished label</dt><dd>{metadata.surface.shape} · {metadata.surface.finishedSize.width} × {metadata.surface.finishedSize.height} {metadata.surface.finishedSize.unit}</dd><dt>Bleed, top / right / bottom / left</dt><dd>{[metadata.surface.bleed.top, metadata.surface.bleed.right, metadata.surface.bleed.bottom, metadata.surface.bleed.left].join(' / ')} {metadata.surface.bleed.unit}</dd><dt>Safe inset, top / right / bottom / left</dt><dd>{[metadata.surface.safeInset.top, metadata.surface.safeInset.right, metadata.surface.safeInset.bottom, metadata.surface.safeInset.left].join(' / ')} {metadata.surface.safeInset.unit}</dd><dt>Blank writing area</dt><dd>{metadata.writeInArea.geometry.shape} · x {metadata.writeInArea.geometry.x}, y {metadata.writeInArea.geometry.y}, width {metadata.writeInArea.geometry.width}, height {metadata.writeInArea.geometry.height}. Coordinates are relative to the finished label.</dd></dl></>}
    <p>{record.validation?.imageValidated ? 'Image format and geometry checks passed.' : 'Image validation has not been confirmed.'} Visual review is still required for lettering, packaging fidelity, and the blank writing area. These checks do not establish authorship or permission.</p><p className="field-hint">Format: {record.validation?.format ?? 'Not recorded'}. No inspection guides are added to printable artwork.</p></details>
    <details><summary>Image and metadata integrity</summary><dl className="gallery-facts gallery-digest">{[['Uploaded PNG SHA-256', record.uploadedHash], ['Canonical artwork SHA-256', record.canonicalHash], ['Metadata SHA-256', record.metadataHash], ['Approval digest', record.digest]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not available'}</dd></div>)}</dl><p>Hashes identify bytes and the reviewed version. They do not prove packaging fidelity or rights.</p></details>
    <section aria-label="Advisory recommendations"><h3>Agent recommendations</h3><p className="field-hint">Advisory only. Recommendations never change metadata or approve a label.</p>{error && <p role="alert">{error}</p>}<h4>Current version</h4>{current.length ? advice(current) : <p>No recommendations for this version.</p>}{stale.length > 0 && <details><summary>Stale recommendations ({stale.length})</summary><p>These refer to an earlier version or a submission that is no longer pending.</p>{advice(stale)}</details>}</section>
    <section aria-label="Review history"><h3>History</h3>{events.length ? <ol className="gallery-timeline">{events.map(event => <li key={event.id}><strong>{event.action.replaceAll('-', ' ')}</strong><p>{event.actorType} · {event.actor} · {new Date(event.createdAt).toLocaleString()}{event.version !== null ? ` · Version ${event.version}` : ''}</p>{event.result && <p>{event.result}</p>}</li>)}</ol> : <p>No recorded activity yet.</p>}{cursor && <button className="button secondary" onClick={() => void more()}>More history</button>}</section>
  </div>
}
