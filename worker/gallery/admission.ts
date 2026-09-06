import type { GalleryLabelDraftV1 } from '../../src/lib/gallery/types';
import { addDays, sha256, type GalleryDatabase, type GalleryEnv } from './storage';
export async function reserveGallery(db: GalleryDatabase, env: GalleryEnv, request: Request, draft: GalleryLabelDraftV1, capabilityHash: string, requestHash: string, metadata: string, now: Date) {
    if (!env.GALLERY_IP_SALT || !env.GALLERY_RATE_LIMITER)
        throw new Error('intake_unavailable');
    const ipHash = await sha256(`${env.GALLERY_IP_SALT}:${now.toISOString().slice(0, 10)}:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`);
    if (!(await env.GALLERY_RATE_LIMITER.limit({ key: ipHash })).success)
        throw new Error('limit_exceeded');
    try {
        await db.prepare(`INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,metadata_json,metadata_hash,catalog_id,input_bytes,quota_key) VALUES(?,?,?,'reserved',?,?,?,?,?,?,?)`).bind(draft.submissionId, capabilityHash, requestHash, now.toISOString(), addDays(now, 1 / 24), metadata, requestHash, draft.catalogId, draft.image.bytes, `ip:${now.toISOString().slice(0, 10)}:${ipHash}`).run();
    }
    catch (e) {
        if (String(e).includes('gallery_capacity'))
            throw new Error('limit_exceeded');
        throw e;
    }
}
