export const GALLERY_NOTICE_VERSION = '2026-09-06-v2';
export const GALLERY_ARTWORK_PROFILE = 'circle-2.5@1' as const
export type GalleryTobacco = { catalogId: string } | { maker: string; blend: string }
export interface GalleryEvidence {
    package?: 'tin' | 'pouch' | 'box' | 'bulk' | 'other' | 'unknown';
    variant?: 'current' | 'historical' | 'special' | 'unknown';
    references?: { url: string; role: 'package-appearance' | 'variant-identification' }[];
}
export interface GalleryLabelDraft {
    version: 2;
    submissionId: string;
    tobacco: GalleryTobacco;
    artworkProfileId: typeof GALLERY_ARTWORK_PROFILE;
    writingArea: import('../cellarpack/types').NormalizedWriteAreaGeometry;
    edition?: string;
    altText?: string;
    evidence?: GalleryEvidence;
    image: { sha256: string; bytes: number; width: number; height: number };
    acknowledgement: { version: typeof GALLERY_NOTICE_VERSION | '2026-09-06-v1'; accepted: true };
}
export type GalleryState = 'reserved' | 'uploading' | 'pending' | 'preparing-publication' | 'published' | 'unpublished' | 'rejected' | 'withdrawn' | 'expired' | 'deleting' | 'deleted';
export interface GalleryReceipt {
    id: string;
    state: GalleryState;
    version: number;
    expiresAt: string;
    deletionDue: string | null;
    digest: string | null;
    metadata: GalleryLabelDraft | null;
    publicationId: string | null;
}
export interface GalleryPublicLabel {
    id: string;
    catalogId: string;
    maker: string;
    blend: string;
    edition?: string;
    altText: string;
    artworkProfileId: typeof GALLERY_ARTWORK_PROFILE;
    publishedAt: string;
}

export type GalleryAgentScope = 'queue:read' | 'submission:read' | 'artwork:read' | 'recommendation:write'
export interface GalleryAgentGrant {
  id: string; clientId: string; label: string; scopes: GalleryAgentScope[]; selection: 'selected' | 'all-pending'; submissionIds: string[];
  createdAt: string; expiresAt: string; revokedAt: string | null; version: number
}
export interface GalleryGrantDraft { clientId: string; label: string; scopes: GalleryAgentScope[]; selection: 'selected' | 'all-pending'; submissionIds: string[]; expiresAt: string }
export type GalleryFindingCategory = 'catalog-match' | 'duplicate' | 'artwork' | 'writing-area' | 'geometry' | 'reference' | 'sharing-concern'
export type GalleryEvidencePointer = { type: 'artwork'; region?: { x:number; y:number; width:number; height:number } } | { type: 'metadata'; field: 'tobacco' | 'edition' | 'evidence' | 'altText' | 'artworkProfileId' | 'writingArea' } | { type: 'reference'; url: string } | { type: 'duplicate'; publicationId: string }
export interface GalleryRecommendationDraft {
  schemaVersion: 1; expectedVersion: number; digest: string; idempotencyKey: string;
  assessment: 'ready-for-human-review' | 'needs-attention' | 'unable-to-assess';
  findings: { category: GalleryFindingCategory; severity: 'info' | 'warning'; explanation: string; evidence?: GalleryEvidencePointer[] }[];
  suggestedCatalogId?: string; supersedesId?: string
}
export interface GalleryRecommendation { id:string; submissionId:string; version:number; digest:string; actorLabel:string; createdAt:string; stale:boolean; recommendation:GalleryRecommendationDraft }
export interface GalleryReviewRecord extends GalleryReceipt {
  createdAt:string; maker:string|null; blend:string|null; mappingNeeded:boolean;
  canonicalHash:string|null; metadataHash:string|null; uploadedHash:string|null;
  publishedIdentity:{maker:string;blend:string}|null;
  validation:{format:'gallery-v2'; geometry:'circle-2.5'; imageValidated:boolean; visualReviewRequired:true};
}
export interface GalleryHistoryEvent { id:string; action:string; actorType:'human'|'agent'|'contributor'|'system'; actor:string; version:number|null; digest:string|null; createdAt:string; result:string|null; beforeVersion?:number|null; beforeDigest?:string|null; requestId?:string|null; reason?:string|null }
