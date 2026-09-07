import { agentResponse, adminAgentResponse, type AgentDependencies } from './agents'
import { humanQueue, reviewRecord } from './review'
import type { Statement } from '../diagnostics'
import { GALLERY_NOTICE_VERSION, type GalleryLabelDraftV1, type GalleryReceipt, type GalleryState } from '../../src/lib/gallery/types';
import { canonicalJson, MAX_IMAGE_BYTES, MAX_METADATA_BYTES, parseGalleryDraft, uuid } from '../../src/lib/gallery/schema';
import { normalizeGalleryImage } from '../../src/lib/gallery/image';
import { buildGalleryPack } from '../../src/lib/gallery/pack';
import { verifyGalleryAdmin, verifyGalleryTurnstile } from './auth';
import { reserveGallery } from './admission';
import { addDays, boundedBody, database, responseHeaders, sha256, type GalleryDatabase, type GalleryEnv } from './storage';
export interface GalleryDependencies extends AgentDependencies {
    verifyAdmin?: typeof verifyGalleryAdmin;
    verifyTurnstile?: typeof verifyGalleryTurnstile;
    now?: () => Date;
}
interface Row {
    id: string;
    capability_hash: string;
    request_hash: string;
    state: GalleryState;
    row_version: number;
    created_at: string;
    expires_at: string;
    lease_until: string | null;
    metadata_json: string | null;
    metadata_hash: string | null;
    artwork_hash: string | null;
    digest: string | null;
    catalog_id: string | null;
    deletion_due: string | null;
    publication_id: string | null;
    published_at: string | null;
    approval_digest: string | null;
    published_maker: string | null;
    published_blend: string | null;
}
interface Asset {
    r2_key: string;
    sha256: string;
    bytes: number;
    kind: string;
}
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: responseHeaders });
const receipt = (r: Row, at = new Date()): GalleryReceipt => ({ id: r.id, state: r.state, version: r.row_version, expiresAt: r.expires_at, deletionDue: r.deletion_due, digest: r.digest, metadata: r.metadata_json && (r.state==='published' || (r.deletion_due ? r.deletion_due>at.toISOString() : r.expires_at>at.toISOString())) ? JSON.parse(r.metadata_json) : null, publicationId: r.publication_id });
const get = (db: GalleryDatabase, id: string) => db.prepare('SELECT * FROM gallery_submissions WHERE id=?').bind(id).first<Row>();
const terminal = ['rejected', 'withdrawn', 'expired', 'deleting', 'deleted'];
const visible = (r: Row, now: Date) => r.state === 'published' || (!terminal.includes(r.state) && r.expires_at > now.toISOString());
const capability = (r: Request) => { const h = r.headers.get('Authorization') ?? ''; return /^Bearer [a-f0-9]{64}$/.test(h) ? h.slice(7) : null; };
async function body(request: Request) { if (request.headers.get('Content-Type') !== 'application/json')
    throw new Error('invalid_metadata'); return JSON.parse(new TextDecoder().decode(await boundedBody(request, MAX_METADATA_BYTES))) as Record<string, unknown>; }
async function flags(db: GalleryDatabase, env: GalleryEnv) { const s = await db.prepare('SELECT * FROM gallery_settings WHERE id=1').first<{
    intake: number;
    serving: number;
    publication: number;
}>(); return { intake: !!s?.intake && env.GALLERY_INTAKE === 'true', serving: !!s?.serving && env.GALLERY_SERVING === 'true', publication: !!s?.publication && env.GALLERY_PUBLICATION === 'true' }; }
async function digest(metadata: GalleryLabelDraftV1, imageHash: string) { return sha256(`gallery-v1:${imageHash}:${await sha256(canonicalJson(metadata))}:${metadata.catalogId ?? ''}`); }
async function auditedMutation(db: GalleryDatabase, mutation: Statement, id: string, actor: string, action: string, now: Date, beforeDigest?: string|null) {
    // D1 batch executes both statements in one SQLite transaction. changes() is
    // scoped to the preceding guarded UPDATE, so a stale no-op cannot create an event.
    // Capture version/digest inside that transaction, not in a later row read.
    const results = await db.batch([
        mutation,
        db.prepare(`INSERT INTO gallery_review_events (id,submission_id,actor,action,row_version,digest,created_at,before_version,before_digest,request_id,reason)
            SELECT ?,id,?,?,row_version,digest,?,row_version-1,CASE WHEN ?='correct' THEN ? ELSE digest END,?,reason FROM gallery_submissions WHERE id=? AND changes()=1`)
            .bind(crypto.randomUUID(), actor, action, now.toISOString(), action, beforeDigest??null, crypto.randomUUID(), id),
    ]);
    return results[0] as { meta: { changes: number } };
}

async function assetResponse(db: GalleryDatabase, env: GalleryEnv, id: string, kind: string) { const a = await db.prepare('SELECT * FROM gallery_assets WHERE submission_id=? AND kind=?').bind(id, kind).first<Asset>(); if (!a)
    return json({ error: 'not_found' }, 404); const object = await env.GALLERY_ART!.get(a.r2_key); if (!object)
    return json({ error: 'storage_unavailable' }, 503); return new Response(await object.arrayBuffer(), { headers: { ...responseHeaders, 'Content-Type': kind === 'pack' ? 'application/zip' : 'image/png', ...(kind === 'pack' ? { 'Content-Disposition': `attachment; filename="label-${id}.cellarpack.zip"` } : {}) } }); }
async function putAsset(db: GalleryDatabase, env: GalleryEnv, id: string, kind: string, bytes: Uint8Array, version: number) { const hash = await sha256(bytes); const key = `gallery/${id}/${kind}-${version}-${hash}`; await env.GALLERY_ART!.put(key, bytes); const changed = await db.prepare(`INSERT INTO gallery_assets(id,submission_id,kind,r2_key,sha256,bytes) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM gallery_submissions WHERE id=? AND row_version=? AND state IN('uploading','preparing-publication')) ON CONFLICT(submission_id,kind) DO UPDATE SET r2_key=excluded.r2_key,sha256=excluded.sha256,bytes=excluded.bytes`).bind(crypto.randomUUID(), id, kind, key, hash, bytes.length, id, version).run(); if (!changed.meta.changes)
    throw new Error('review_changed'); return hash; }
async function publicProjection(r: Row) { const metadata = JSON.parse(r.metadata_json!) as GalleryLabelDraftV1; return { id: r.id, catalogId: r.catalog_id, maker: r.published_maker, blend: r.published_blend, edition: metadata.edition, description: metadata.description, geometry: 'circle-2.5', metadata: { surface: metadata.surface, writeInArea: metadata.writeInArea, references: metadata.references, package: metadata.package, variant: metadata.variant, edition: metadata.edition, description: metadata.description }, publishedAt: r.published_at }; }
export async function galleryResponse(request: Request, env: GalleryEnv, deps: GalleryDependencies = {}): Promise<Response> {
    if (!new URL(request.url).pathname.startsWith('/api/gallery/v1/'))
        return json({ error: 'not_found' }, 404);
    if(new URL(request.url).pathname.startsWith('/api/gallery/v1/agent/'))return agentResponse(request,env,deps);
    const now = deps.now?.() ?? new Date();
    const url = new URL(request.url);
    const path = url.pathname.slice('/api/gallery/v1'.length);
    const method = request.method;
    try {
        if (method !== 'GET' && request.headers.get('Origin') !== url.origin)
            return json({ error: 'forbidden' }, 403);
        if (!env.GALLERY || !env.GALLERY_ART) {
            if (path === '/config' && method === 'GET')
                return json({ intake: false, serving: false, noticeVersion: GALLERY_NOTICE_VERSION, turnstileSiteKey: '' });
            return json({ error: 'storage_unavailable' }, 503);
        }
        const db = database(env);
        const switches = await flags(db, env);
        if (path === '/config' && method === 'GET')
            return json({ ...switches, intake: switches.intake && !!env.GALLERY_TURNSTILE_SITE_KEY && !!env.GALLERY_IP_SALT && !!env.GALLERY_RATE_LIMITER && (!!env.GALLERY_TURNSTILE_SECRET || !!deps.verifyTurnstile), noticeVersion: GALLERY_NOTICE_VERSION, turnstileSiteKey: env.GALLERY_TURNSTILE_SITE_KEY ?? '' });
        if (path === '/submissions' && method === 'POST') {
            const token = capability(request);
            if (!token)
                return json({ error: 'not_found' }, 404);
            const draft = parseGalleryDraft(await body(request));
            const metadata = canonicalJson(draft);
            const hash = await sha256(metadata);
            const capHash = await sha256(token);
            const existing = await get(db, draft.submissionId);
            if (existing) {
                if (existing.capability_hash !== capHash)
                    return json({ error: 'not_found' }, 404);
                return existing.request_hash === hash ? json(receipt(existing,now)) : json({ error: 'review_changed' }, 409);
            }
            if (draft.acknowledgement.version !== GALLERY_NOTICE_VERSION)
                return json({ error: 'invalid_metadata' }, 400);
            if (!switches.intake)
                return json({ error: 'intake_closed' }, 503);
            if (!(await (deps.verifyTurnstile ?? verifyGalleryTurnstile)(request, env)))
                return json({ error: 'challenge_required' }, 403);
            if (draft.catalogId && !await db.prepare('SELECT id FROM gallery_tobaccos WHERE id=? AND active=1').bind(draft.catalogId).first())
                return json({ error: 'catalog_mapping_required' }, 400);
            await reserveGallery(db, env, request, draft, capHash, hash, metadata, now);
            return json(receipt((await get(db, draft.submissionId))!,now), 201);
        }
        const own = path.match(/^\/submissions\/([a-f0-9-]+)\/(artwork)$/);
        if (own && uuid(own[1]) && method === 'PUT') {
            const token = capability(request);
            const row = await get(db, own[1]);
            if (!token || !row || row.capability_hash !== await sha256(token))
                return json({ error: 'not_found' }, 404);
            if (own[2] === 'artwork' && method === 'PUT') {
                if(!row.metadata_json||terminal.includes(row.state))return json({error:'expired'},410);
                if (request.headers.get('Content-Type') !== 'image/png')
                    return json({ error: 'unsupported_image' }, 415);
                if (!switches.intake && ['reserved', 'uploading'].includes(row.state))
                    return json({ error: 'intake_closed' }, 503);
                const bytes = await boundedBody(request, MAX_IMAGE_BYTES);
                const draft = JSON.parse(row.metadata_json!) as GalleryLabelDraftV1;
                if (bytes.length !== draft.image.bytes || await sha256(bytes) !== draft.image.sha256)
                    return json({ error: 'image_mismatch' }, 400);
                if (['pending', 'published', 'preparing-publication'].includes(row.state))
                    return json(receipt(row, now));
                if (!['reserved', 'uploading'].includes(row.state) || row.expires_at <= now.toISOString())
                    return json({ error: 'expired' }, 410);
                const lease = await db.prepare("UPDATE gallery_submissions SET state='uploading',lease_until=?,row_version=row_version+1 WHERE id=? AND row_version=? AND (state='reserved' OR (state='uploading' AND lease_until<=?))").bind(addDays(now, 5 / 1440), row.id, row.row_version, now.toISOString()).run();
                if (!lease.meta.changes)
                    return json({ error: 'upload_in_progress' }, 409);
                const version = row.row_version + 1;
                try {
                    const image = await normalizeGalleryImage(bytes);
                    if (image.width !== draft.image.width || image.height !== draft.image.height)
                        throw new Error('image_mismatch');
                    const imageHash = await putAsset(db, env, row.id, 'artwork', image.artwork, version);
                    await putAsset(db, env, row.id, 'thumbnail', image.thumbnail, version);
                    const d = await digest(draft, imageHash);
                    const done = await db.prepare("UPDATE gallery_submissions SET state='pending',row_version=row_version+1,lease_until=NULL,expires_at=?,artwork_hash=?,digest=? WHERE id=? AND row_version=? AND state='uploading'").bind(addDays(now, 30), imageHash, d, row.id, version).run();
                    if (!done.meta.changes)
                        return json({ error: 'review_changed' }, 409);
                    return json(receipt((await get(db, row.id))!,now));
                }
                catch (e) {
                    await db.prepare("UPDATE gallery_submissions SET state='reserved',lease_until=NULL,row_version=row_version+1 WHERE id=? AND row_version=? AND state='uploading'").bind(row.id, version).run();
                    throw e;
                }
            }
        }
        if (path.startsWith('/admin/')) {
            const admin = await (deps.verifyAdmin ?? verifyGalleryAdmin)(request, env);
            if (!admin)
                return json({ error: 'forbidden' }, 403);
            if (path === '/admin/reconcile' && method === 'POST') {
                if (!switches.publication)
                    return json({ error: 'publication_closed' }, 503);
                const encoded = await boundedBody(request, MAX_IMAGE_BYTES + MAX_METADATA_BYTES + 65536);
                const form = await new Response(encoded as BodyInit, { headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' } }).formData();
                const rawMetadata = form.get('metadata');
                const artworkFile = form.get('artwork');
                if (typeof rawMetadata !== 'string' || !(artworkFile instanceof File) || artworkFile.type !== 'image/png' || new TextEncoder().encode(rawMetadata).length > MAX_METADATA_BYTES)
                    return json({ error: 'invalid_metadata' }, 400);
                const incoming = parseGalleryDraft(JSON.parse(rawMetadata));
                if (!incoming.catalogId || incoming.acknowledgement.version !== GALLERY_NOTICE_VERSION)
                    return json({ error: 'invalid_metadata' }, 400);
                const matches = (await db.prepare("SELECT * FROM gallery_submissions WHERE state='published' AND catalog_id=? LIMIT 2").bind(incoming.catalogId).all<Row>()).results;
                if (!matches.length)
                    return json({ error: 'publication_not_found' }, 404);
                if (matches.length !== 1)
                    return json({ error: 'review_changed' }, 409);
                const row = matches[0];
                const source = new Uint8Array(await artworkFile.arrayBuffer());
                if (source.length > MAX_IMAGE_BYTES || source.length !== incoming.image.bytes || await sha256(source) !== incoming.image.sha256)
                    return json({ error: 'image_mismatch' }, 400);
                const metadata = { ...incoming, submissionId: row.id };
                const normalized = await normalizeGalleryImage(source);
                if (normalized.width !== metadata.image.width || normalized.height !== metadata.image.height)
                    return json({ error: 'image_mismatch' }, 400);
                const tobacco = await db.prepare('SELECT maker,blend FROM gallery_tobaccos WHERE id=? AND active=1').bind(metadata.catalogId).first<{ maker: string; blend: string }>();
                if (!tobacco)
                    return json({ error: 'catalog_mapping_required' }, 400);
                const metadataJson = canonicalJson(metadata);
                const metadataHash = await sha256(metadataJson);
                const artworkHash = await sha256(normalized.artwork);
                const approvalDigest = await digest(metadata, artworkHash);
                const pack = await buildGalleryPack({ metadata, ...tobacco, packId: row.id, createdAt: row.created_at }, normalized.artwork);
                const version = row.row_version + 1;
                const prepared = [
                    { kind: 'artwork', bytes: normalized.artwork },
                    { kind: 'thumbnail', bytes: normalized.thumbnail },
                    { kind: 'pack', bytes: pack },
                ];
                const assets = await Promise.all(prepared.map(async ({ kind, bytes }) => {
                    const hash = await sha256(bytes);
                    const key = `gallery/${row.id}/${kind}-${version}-${hash}`;
                    await env.GALLERY_ART!.put(key, bytes);
                    return { kind, bytes, hash, key };
                }));
                if (!(await Promise.all(assets.map(asset => env.GALLERY_ART!.head(asset.key)))).every(Boolean))
                    throw new Error('storage_unavailable');
                const comparable = canonicalJson({ catalogId: metadata.catalogId, surface: metadata.surface, writeInArea: metadata.writeInArea, edition: metadata.edition, references: metadata.references, package: metadata.package, variant: metadata.variant });
                const dedupeHash = await sha256(artworkHash + comparable);
                const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes.length, 0);
                const mutationId = crypto.randomUUID();
                const update = db.prepare("UPDATE gallery_submissions SET request_hash=?,metadata_json=?,metadata_hash=?,input_bytes=?,artwork_hash=?,digest=?,approval_digest=?,published_maker=?,published_blend=?,dedupe_hash=?,reserved_bytes=?,row_version=row_version+1 WHERE id=? AND row_version=? AND state='published' AND EXISTS(SELECT 1 FROM gallery_settings WHERE id=1 AND publication=1) AND EXISTS(SELECT 1 FROM gallery_tobaccos WHERE id=gallery_submissions.catalog_id AND active=1 AND maker=? AND blend=?) AND (SELECT COALESCE(SUM(reserved_bytes),0) FROM gallery_submissions WHERE id<>?)<=8589934592-?")
                    .bind(metadataHash, metadataJson, metadataHash, source.length, artworkHash, approvalDigest, approvalDigest, tobacco.maker, tobacco.blend, dedupeHash, totalBytes, row.id, row.row_version, tobacco.maker, tobacco.blend, row.id, totalBytes);
                const statements = [
                    update,
                    db.prepare(`INSERT INTO gallery_review_events (id,submission_id,actor,action,row_version,digest,created_at,before_version,before_digest,request_id,reason)
                        SELECT ?,id,?,'reconcile',row_version,digest,?,row_version-1,?, ?,reason FROM gallery_submissions WHERE id=? AND changes()=1`)
                        .bind(mutationId, admin, now.toISOString(), row.digest, mutationId, row.id),
                    ...assets.map(asset => db.prepare(`INSERT INTO gallery_assets(id,submission_id,kind,r2_key,sha256,bytes) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM gallery_review_events WHERE id=? AND submission_id=?) ON CONFLICT(submission_id,kind) DO UPDATE SET r2_key=excluded.r2_key,sha256=excluded.sha256,bytes=excluded.bytes`)
                        .bind(crypto.randomUUID(), row.id, asset.kind, asset.key, asset.hash, asset.bytes.length, mutationId, row.id)),
                ];
                const [changed] = await db.batch(statements);
                if (!(changed as { meta: { changes: number } }).meta.changes)
                    return json({ error: 'review_changed' }, 409);
                return json(receipt((await get(db, row.id))!, now));
            }
            if (path === '/admin/intake' && method === 'POST') {
                const draft = parseGalleryDraft(await body(request));
                const metadata = canonicalJson(draft);
                const hash = await sha256(metadata);
                const existing = await get(db, draft.submissionId);
                if (existing)
                    return existing.request_hash === hash ? json(receipt(existing, now)) : json({ error: 'review_changed' }, 409);
                if (!switches.intake)
                    return json({ error: 'intake_closed' }, 503);
                if (draft.acknowledgement.version !== GALLERY_NOTICE_VERSION)
                    return json({ error: 'invalid_metadata' }, 400);
                if (draft.catalogId && !await db.prepare('SELECT id FROM gallery_tobaccos WHERE id=? AND active=1').bind(draft.catalogId).first())
                    return json({ error: 'catalog_mapping_required' }, 400);
                const capHash = await sha256(`admin-intake:${admin}:${draft.submissionId}`);
                try {
                    await db.prepare(`INSERT INTO gallery_submissions(id,capability_hash,request_hash,state,created_at,expires_at,metadata_json,metadata_hash,catalog_id,input_bytes,quota_key) VALUES(?,?,?,'reserved',?,?,?,?,?,?,?)`).bind(draft.submissionId, capHash, hash, now.toISOString(), addDays(now, 1 / 24), metadata, hash, draft.catalogId, draft.image.bytes, `admin:${now.toISOString().slice(0, 10)}:${draft.submissionId}`).run();
                }
                catch (e) {
                    if (String(e).includes('gallery_capacity'))
                        return json({ error: 'limit_exceeded' }, 429);
                    throw e;
                }
                return json(receipt((await get(db, draft.submissionId))!, now), 201);
            }
            const adminIntake = path.match(/^\/admin\/intake\/([a-f0-9-]+)\/artwork$/);
            if (adminIntake && uuid(adminIntake[1]) && method === 'PUT') {
                const row = await get(db, adminIntake[1]);
                if (!row)
                    return json({ error: 'not_found' }, 404);
                if (!row.metadata_json || terminal.includes(row.state))
                    return json({ error: 'expired' }, 410);
                if (request.headers.get('Content-Type') !== 'image/png')
                    return json({ error: 'unsupported_image' }, 415);
                if (!switches.intake && ['reserved', 'uploading'].includes(row.state))
                    return json({ error: 'intake_closed' }, 503);
                const bytes = await boundedBody(request, MAX_IMAGE_BYTES);
                const draft = JSON.parse(row.metadata_json) as GalleryLabelDraftV1;
                if (bytes.length !== draft.image.bytes || await sha256(bytes) !== draft.image.sha256)
                    return json({ error: 'image_mismatch' }, 400);
                if (['pending', 'published', 'preparing-publication'].includes(row.state))
                    return json(receipt(row, now));
                if (!['reserved', 'uploading'].includes(row.state) || row.expires_at <= now.toISOString())
                    return json({ error: 'expired' }, 410);
                const lease = await db.prepare("UPDATE gallery_submissions SET state='uploading',lease_until=?,row_version=row_version+1 WHERE id=? AND row_version=? AND (state='reserved' OR (state='uploading' AND lease_until<=?))").bind(addDays(now, 5 / 1440), row.id, row.row_version, now.toISOString()).run();
                if (!lease.meta.changes)
                    return json({ error: 'upload_in_progress' }, 409);
                const version = row.row_version + 1;
                try {
                    const image = await normalizeGalleryImage(bytes);
                    if (image.width !== draft.image.width || image.height !== draft.image.height)
                        throw new Error('image_mismatch');
                    const imageHash = await putAsset(db, env, row.id, 'artwork', image.artwork, version);
                    await putAsset(db, env, row.id, 'thumbnail', image.thumbnail, version);
                    const d = await digest(draft, imageHash);
                    const done = await auditedMutation(db, db.prepare("UPDATE gallery_submissions SET state='pending',row_version=row_version+1,lease_until=NULL,expires_at=?,artwork_hash=?,digest=? WHERE id=? AND row_version=? AND state='uploading'").bind(addDays(now, 30), imageHash, d, row.id, version), row.id, admin, 'curated-intake', now);
                    if (!done.meta.changes)
                        return json({ error: 'review_changed' }, 409);
                    return json(receipt((await get(db, row.id))!, now));
                }
                catch (e) {
                    await db.prepare("UPDATE gallery_submissions SET state='reserved',lease_until=NULL,row_version=row_version+1 WHERE id=? AND row_version=? AND state='uploading'").bind(row.id, version).run();
                    throw e;
                }
            }
            const extra=await adminAgentResponse(request,db,admin,now);if(extra)return extra;
            if(path==='/admin/submissions'&&method==='GET')return json(await humanQueue(db,url,now));
            const match = path.match(/^\/admin\/(submissions|publications)\/([a-f0-9-]+)(?:\/(artwork|thumbnail|approve|reject|unpublish|republish|refresh))?$/);
            if (!match || !uuid(match[2]))
                return json({ error: 'not_found' }, 404);
            let row = await get(db, match[2]);
            if (!row)
                return json({ error: 'not_found' }, 404);
            if (method === 'GET' && !match[3])
                return json(await reviewRecord(db,row,now));
            if (method === 'GET' && ['artwork', 'thumbnail'].includes(match[3]))
                return visible(row, now) ? assetResponse(db, env, row.id, match[3]) : json({ error: 'not_found' }, 404);
            if (!['POST', 'PATCH'].includes(method))
                return json({ error: 'not_found' }, 404);
            const action = await body(request);
            const allowed = method === 'PATCH' ? ['expectedVersion', 'metadata'] : match[3] === 'approve' ? ['expectedVersion', 'digest'] : match[3] === 'reject' ? ['expectedVersion', 'reason'] : ['expectedVersion'];
            if (Object.keys(action).sort().join() !== allowed.sort().join())
                return json({ error: 'invalid_metadata' }, 400);
            if (action.expectedVersion !== row.row_version)
                return json({ error: 'review_changed', submission: receipt(row,now) }, 409);
            if (method === 'PATCH' && !match[3]) {
                if (row.state !== 'pending' || row.expires_at <= now.toISOString())
                    return json({ error: 'review_changed' }, 409);
                const metadata = parseGalleryDraft(action.metadata);
                const old = JSON.parse(row.metadata_json!) as GalleryLabelDraftV1;
                if (canonicalJson(metadata.acknowledgement) !== canonicalJson(old.acknowledgement) || metadata.submissionId !== row.id || canonicalJson(metadata.image) !== canonicalJson(old.image) || canonicalJson(metadata.surface) !== canonicalJson(old.surface) || canonicalJson(metadata.writeInArea) !== canonicalJson(old.writeInArea))
                    return json({ error: 'invalid_metadata' }, 400);
                if (metadata.catalogId && !await db.prepare('SELECT id FROM gallery_tobaccos WHERE id=? AND active=1').bind(metadata.catalogId).first())
                    return json({ error: 'catalog_mapping_required' }, 400);
                const d = await digest(metadata, row.artwork_hash!);
                const changed = await auditedMutation(db, db.prepare("UPDATE gallery_submissions SET metadata_json=?,metadata_hash=?,catalog_id=?,digest=?,row_version=row_version+1 WHERE id=? AND row_version=? AND state='pending'").bind(canonicalJson(metadata), await sha256(canonicalJson(metadata)), metadata.catalogId, d, row.id, row.row_version), row.id, admin, 'correct', now, row.digest);
                if (!changed.meta.changes)
                    return json({ error: 'review_changed' }, 409);
            }
            else if (method === 'POST' && match[3] === 'approve') {
                if (!switches.publication)
                    return json({ error: 'publication_closed' }, 503);
                if (row.state !== 'pending' || row.expires_at <= now.toISOString() || action.digest !== row.digest)
                    return json({ error: 'review_changed' }, 409);
                const tobacco = await db.prepare('SELECT maker,blend FROM gallery_tobaccos WHERE id=? AND active=1').bind(row.catalog_id).first<{
                    maker: string;
                    blend: string;
                }>();
                if (!tobacco)
                    return json({ error: 'catalog_mapping_required' }, 400);
                const metadata = JSON.parse(row.metadata_json!) as GalleryLabelDraftV1;
                const same = (m: GalleryLabelDraftV1) => canonicalJson({ catalogId: m.catalogId, surface: m.surface, writeInArea: m.writeInArea, edition: m.edition, references: m.references, package: m.package, variant: m.variant });
                const duplicates = (await db.prepare("SELECT * FROM gallery_submissions WHERE state='published' AND artwork_hash=? AND catalog_id=?").bind(row.artwork_hash, row.catalog_id).all<Row>()).results;
                const duplicate = duplicates.find(r => same(JSON.parse(r.metadata_json!)) === same(metadata));
                if (duplicate) {
                    const changed = await auditedMutation(db, db.prepare("UPDATE gallery_submissions SET state='rejected',reason='duplicate',publication_id=?,deletion_due=?,receipt_until=?,row_version=row_version+1 WHERE id=? AND row_version=? AND state='pending'").bind(duplicate.id, addDays(now, 7), addDays(now, 90), row.id, row.row_version), row.id, admin, 'duplicate', now);
                    if (!changed.meta.changes)
                        return json({ error: 'review_changed' }, 409);
                    const current = (await get(db, row.id))!;
                    return json(await reviewRecord(db,current,now));
                }
                const dedupeHash = await sha256(row.artwork_hash! + same(metadata));
                const locked = await db.prepare("UPDATE gallery_submissions SET state='preparing-publication',lease_until=?,dedupe_hash=?,row_version=row_version+1 WHERE id=? AND row_version=? AND state='pending'").bind(addDays(now, 5 / 1440), dedupeHash, row.id, row.row_version).run();
                if (!locked.meta.changes)
                    return json({ error: 'review_changed' }, 409);
                const version = row.row_version + 1;
                try {
                    const asset = await db.prepare("SELECT * FROM gallery_assets WHERE submission_id=? AND kind='artwork'").bind(row.id).first<Asset>();
                    const object = asset && await env.GALLERY_ART.get(asset.r2_key);
                    if (!object)
                        throw new Error('storage_unavailable');
                    const bytes = new Uint8Array(await object.arrayBuffer());
                    if (await sha256(bytes) !== row.artwork_hash)
                        throw new Error('storage_unavailable');
                    const pack = await buildGalleryPack({ metadata: JSON.parse(row.metadata_json!), ...tobacco, packId: row.id, createdAt: row.created_at }, bytes);
                    await putAsset(db, env, row.id, 'pack', pack, version);
                    const prepared = (await db.prepare('SELECT r2_key FROM gallery_assets WHERE submission_id=?').bind(row.id).all<Asset>()).results;
                    if (prepared.length !== 3 || !(await Promise.all(prepared.map(a => env.GALLERY_ART!.head(a.r2_key)))).every(Boolean))
                        throw new Error('storage_unavailable');
                    if (!(await flags(db, env)).publication)
                        throw new Error('publication_closed');
                    const done = await auditedMutation(db, db.prepare("UPDATE gallery_submissions SET state='published',publication_id=id,published_at=?,approval_digest=digest,reviewer=?,published_maker=?,published_blend=?,lease_until=NULL,row_version=row_version+1,reserved_bytes=(SELECT SUM(bytes) FROM gallery_assets WHERE submission_id=?) WHERE id=? AND row_version=? AND state='preparing-publication' AND EXISTS(SELECT 1 FROM gallery_settings WHERE id=1 AND publication=1) AND EXISTS(SELECT 1 FROM gallery_tobaccos WHERE id=gallery_submissions.catalog_id AND active=1)").bind(now.toISOString(), admin, tobacco.maker, tobacco.blend, row.id, row.id, version), row.id, admin, 'approve', now);
                    if (!done.meta.changes)
                        return json({ error: 'review_changed' }, 409);
                }
                catch (e) {
                    await db.prepare("UPDATE gallery_submissions SET state='pending',lease_until=NULL,row_version=row_version+1 WHERE id=? AND row_version=? AND state='preparing-publication'").bind(row.id, version).run();
                    throw e;
                }
            }
            else if (method === 'POST' && match[3] === 'reject') {
                if (row.state !== 'pending' || !['unsuitable', 'rights-concern', 'duplicate', 'other'].includes(String(action.reason)))
                    return json({ error: 'review_changed' }, 409);
                const changed = await auditedMutation(db, db.prepare("UPDATE gallery_submissions SET state='rejected',reason=?,deletion_due=?,receipt_until=?,row_version=row_version+1 WHERE id=? AND row_version=? AND state='pending'").bind(action.reason, addDays(now, 7), addDays(now, 90), row.id, row.row_version), row.id, admin, 'reject', now);
                if (!changed.meta.changes)
                    return json({ error: 'review_changed' }, 409);
            }
            else if (method === 'POST' && match[3] === 'unpublish') {
                const changed = await auditedMutation(db, db.prepare("UPDATE gallery_submissions SET state='unpublished',expires_at=?,deletion_due=?,row_version=row_version+1 WHERE id=? AND row_version=? AND state='published'").bind(addDays(now, 30), addDays(now, 30), row.id, row.row_version), row.id, admin, 'unpublish', now);
                if (!changed.meta.changes)
                    return json({ error: 'review_changed' }, 409);
            }
            else if (method === 'POST' && match[3] === 'refresh') {
                if (!switches.publication)
                    return json({ error: 'publication_closed' }, 503);
                if (row.state !== 'published' || !row.catalog_id || !row.metadata_json || !row.artwork_hash)
                    return json({ error: 'review_changed' }, 409);
                const tobacco = await db.prepare('SELECT maker,blend FROM gallery_tobaccos WHERE id=? AND active=1').bind(row.catalog_id).first<{
                    maker: string;
                    blend: string;
                }>();
                if (!tobacco)
                    return json({ error: 'catalog_mapping_required' }, 400);
                const asset = await db.prepare("SELECT * FROM gallery_assets WHERE submission_id=? AND kind='artwork'").bind(row.id).first<Asset>();
                const object = asset && await env.GALLERY_ART.get(asset.r2_key);
                if (!object) throw new Error('storage_unavailable');
                const bytes = new Uint8Array(await object.arrayBuffer());
                if (await sha256(bytes) !== row.artwork_hash) throw new Error('storage_unavailable');
                const pack = await buildGalleryPack({ metadata: JSON.parse(row.metadata_json), ...tobacco, packId: row.id, createdAt: row.created_at }, bytes);
                const hash = await sha256(pack);
                const key = `gallery/${row.id}/pack-${row.row_version + 1}-${hash}`;
                await env.GALLERY_ART.put(key, pack);
                if (!await env.GALLERY_ART.head(key)) throw new Error('storage_unavailable');
                const mutationId = crypto.randomUUID();
                const [changed] = await db.batch([
                    db.prepare("UPDATE gallery_submissions SET published_maker=?,published_blend=?,row_version=row_version+1,reserved_bytes=(SELECT COALESCE(SUM(bytes),0) FROM gallery_assets WHERE submission_id=? AND kind<>'pack')+? WHERE id=? AND row_version=? AND state='published' AND EXISTS(SELECT 1 FROM gallery_settings WHERE id=1 AND publication=1) AND EXISTS(SELECT 1 FROM gallery_tobaccos WHERE id=gallery_submissions.catalog_id AND active=1 AND maker=? AND blend=?) AND (SELECT COALESCE(SUM(reserved_bytes),0) FROM gallery_submissions WHERE id<>?)+(SELECT COALESCE(SUM(bytes),0) FROM gallery_assets WHERE submission_id=? AND kind<>'pack')<=8589934592-?")
                        .bind(tobacco.maker, tobacco.blend, row.id, pack.length, row.id, row.row_version, tobacco.maker, tobacco.blend, row.id, row.id, pack.length),
                    db.prepare("INSERT INTO gallery_review_events(id,submission_id,actor,action,row_version,digest,created_at,before_version,before_digest,request_id,reason) SELECT ?,id,?,'refresh',row_version,digest,?,row_version-1,digest,?,reason FROM gallery_submissions WHERE id=? AND changes()=1")
                        .bind(mutationId, admin, now.toISOString(), mutationId, row.id),
                    db.prepare("UPDATE gallery_assets SET r2_key=?,sha256=?,bytes=? WHERE submission_id=? AND kind='pack' AND EXISTS(SELECT 1 FROM gallery_review_events WHERE id=?)")
                        .bind(key, hash, pack.length, row.id, mutationId),
                ]);
                if (!(changed as {meta:{changes:number}}).meta.changes) return json({error:'review_changed'},409);
            }
            else if (method === 'POST' && match[3] === 'republish') {
                if (!switches.publication)
                    return json({ error: 'publication_closed' }, 503);
                const assets = (await db.prepare('SELECT * FROM gallery_assets WHERE submission_id=?').bind(row.id).all<Asset>()).results;
                if (assets.length !== 3 || !(await Promise.all(assets.map(a => env.GALLERY_ART!.head(a.r2_key)))).every(Boolean))
                    return json({ error: 'storage_unavailable' }, 503);
                if(!(await flags(db,env)).publication)return json({error:'publication_closed'},503);
                const changed = await auditedMutation(db, db.prepare("UPDATE gallery_submissions SET state='published',deletion_due=NULL,row_version=row_version+1 WHERE id=? AND row_version=? AND state='unpublished' AND expires_at>? AND digest=approval_digest AND EXISTS(SELECT 1 FROM gallery_settings WHERE id=1 AND publication=1) AND EXISTS(SELECT 1 FROM gallery_tobaccos WHERE id=gallery_submissions.catalog_id AND active=1)").bind(row.id, row.row_version, now.toISOString()), row.id, admin, 'republish', now);
                if (!changed.meta.changes)
                    return json({ error: 'review_changed' }, 409);
            }
            else
                return json({ error: 'not_found' }, 404);
            row = (await get(db, row.id))!;
            return json(await reviewRecord(db,row,now));
        }
        if (path === '/labels' && method === 'GET') {
            if (!switches.serving)
                return json({ labels: [], nextCursor: null, serving: false });
            const cursor = url.searchParams.get('cursor') ?? '';
            const catalog = url.searchParams.get('catalogId') ?? '';
            const edition = url.searchParams.get('edition') ?? '';
            const geometry = url.searchParams.get('geometry');
            if ((cursor && !uuid(cursor)) || catalog.length > 200 || edition.length > 120)
                return json({ error: 'invalid_filter' }, 400);
            if (geometry && geometry !== 'circle-2.5')
                return json({ labels: [], nextCursor: null, serving: true });
            const rows = (await db.prepare("SELECT * FROM gallery_submissions WHERE state='published' AND id>? AND (?='' OR catalog_id=?) AND (?='' OR json_extract(metadata_json,'$.edition')=?) ORDER BY id LIMIT 25").bind(cursor, catalog, catalog, edition, edition).all<Row>()).results;
            return json({ labels: await Promise.all(rows.slice(0, 24).map(r => publicProjection(r))), nextCursor: rows.length > 24 ? rows[23].id : null, serving: true });
        }
        const label = path.match(/^\/labels\/([a-f0-9-]+)(?:\/(artwork|thumbnail|pack))?$/);
        if (label && uuid(label[1]) && method === 'GET') {
            if (!switches.serving)
                return json({ error: 'not_found' }, 404);
            const row = await get(db, label[1]);
            if (!row || row.state !== 'published')
                return json({ error: 'not_found' }, 404);
            return label[2] ? assetResponse(db, env, row.id, label[2]) : json(await publicProjection(row));
        }
        return json({ error: 'not_found' }, 404);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : '';
        const known = ['invalid_filter', 'review_changed', 'invalid_metadata', 'limit_exceeded', 'unsupported_image', 'image_mismatch', 'invalid_geometry', 'intake_unavailable', 'publication_closed'];
        return json({ error: known.includes(message) ? message : 'storage_unavailable' }, message === 'review_changed' ? 409 : message === 'limit_exceeded' ? 429 : known.includes(message) ? 400 : 503);
    }
}
export { cleanGallery } from './cleanup';
