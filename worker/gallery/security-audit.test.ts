// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { encode } from 'fast-png';
import { galleryResponse } from './routes';
import { sha256, type GalleryBucket, type GalleryDatabase, type GalleryEnv } from './storage';
import type { GalleryLabelDraft } from '../../src/lib/gallery/types';
class DB implements GalleryDatabase {
    readonly db: DatabaseSync;
    constructor(db = new DatabaseSync(':memory:')) { this.db = db; db.exec(readFileSync(new URL('../../migrations/gallery/0001_gallery.sql', import.meta.url), 'utf8'));db.exec(readFileSync(new URL('../../migrations/gallery/0002_agent_review.sql', import.meta.url), 'utf8'));db.exec(readFileSync(new URL('../../migrations/gallery/0003_audit_context.sql', import.meta.url), 'utf8')); db.exec(readFileSync(new URL('../../migrations/gallery/0004_upload_attempts.sql', import.meta.url), 'utf8')); db.exec(readFileSync(new URL('../../migrations/gallery/0005_label_metadata_v2.sql', import.meta.url), 'utf8')); db.exec("UPDATE gallery_settings SET intake=1,publication=1,serving=1; INSERT INTO gallery_tobaccos VALUES('test-blend','Test','Blend','[]',1,'fixture')"); }
    prepare(sql: string) { let args: unknown[] = []; const stmt = { bind: (...a: unknown[]) => { args = a; return stmt; }, run: async () => ({ meta: { changes: Number(this.db.prepare(sql).run(...args as never[]).changes) } }), first: async <T>() => (this.db.prepare(sql).get(...args as never[]) ?? null) as T | null, all: async <T>() => ({ results: this.db.prepare(sql).all(...args as never[]) as T[] }) }; return stmt; }
    private pendingBatch: Promise<void> = Promise.resolve();
    async batch(statements: ReturnType<DB['prepare']>[]) {
        const execute=async()=>{this.db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());this.db.exec('COMMIT');return results}catch(error){this.db.exec('ROLLBACK');throw error}};
        const result=this.pendingBatch.then(execute);
        this.pendingBatch=result.then(()=>{},()=>{});
        return result;
    }

}
class Bucket implements GalleryBucket {
    objects = new Map<string, Uint8Array>();
    failPut = false;
    failDelete = false;
    async put(key: string, bytes: Uint8Array) { if (this.failPut)
        throw Error('injected'); this.objects.set(key, bytes.slice()); }
    async get(key: string) { const bytes = this.objects.get(key); return bytes ? { body: new Response(bytes.slice().buffer as ArrayBuffer).body!, arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer } : null; }
    async head(key: string) { return this.objects.has(key) ? {} : null; }
    async delete(key: string) { if (this.failDelete)
        throw Error('injected'); this.objects.delete(key); }
    async list() { return { objects: [...this.objects.keys()].map(key => ({ key, uploaded: new Date('2026-01-01') })), truncated: false }; }
}
let db: DB, bucket: Bucket, env: GalleryEnv, draft: GalleryLabelDraft, png: Uint8Array;
const key = 'a'.repeat(64), now = new Date('2026-09-06T12:00:00Z');
const deps = { verifyAdmin: async (r: Request) => r.headers.get('X-Test-Admin') === 'yes' ? 'admin' : null, verifyTurnstile: async () => true, verifyAgent: async (r:Request)=>r.headers.get('X-Test-Machine')==='yes'?'fixture.access':null, now: () => now };
function call(path: string, method = 'GET', data?: unknown, headers: Record<string, string> = {}) { return galleryResponse(new Request('https://site.example/api/gallery/v1' + path, { method, headers: { Origin: 'https://site.example', Authorization: `Bearer ${key}`, ...(data instanceof Uint8Array ? { 'Content-Type': 'image/png' } : data ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: data instanceof Uint8Array ? data as BodyInit : data ? JSON.stringify(data) : undefined }), env, deps); }
async function submit() { expect((await call('/submissions', 'POST', draft)).status).toBe(201); const r = await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png); expect(r.status).toBe(200); return r.json(); }
async function approve() { const r = await submit(); const approved = await call(`/admin/submissions/${draft.submissionId}/approve`, 'POST', { expectedVersion: r.version, digest: r.digest }, { 'X-Test-Admin': 'yes' }); expect(approved.status).toBe(200); return approved.json(); }
it('distinguishes a serving library with no matches from disabled listing responses', async () => {
  expect(await (await call('/labels?catalogId=test-blend')).json()).toEqual({ serving: true, labels: [], nextCursor: null });
  expect(await (await call('/labels?geometry=unsupported')).json()).toEqual({ serving: true, labels: [], nextCursor: null });
  env.GALLERY_SERVING = 'false';
  expect(await (await call('/labels?catalogId=test-blend')).json()).toEqual({ serving: false, labels: [], nextCursor: null });
});
beforeEach(async () => { db = new DB(); bucket = new Bucket(); env = { GALLERY: db, GALLERY_ART: bucket, GALLERY_INTAKE: 'true', GALLERY_SERVING: 'true', GALLERY_PUBLICATION: 'true', GALLERY_IP_SALT: 'fixture', GALLERY_MUTATION_RATE_LIMITER: { limit: async () => ({ success: true }) }, GALLERY_READ_RATE_LIMITER: { limit: async () => ({ success: true }) }, GALLERY_IMAGE_RATE_LIMITER: { limit: async () => ({ success: true }) }, GALLERY_PACK_RATE_LIMITER: { limit: async () => ({ success: true }) }, GALLERY_UPLOAD_RATE_LIMITER: { limit: async () => ({ success: true }) }, GALLERY_RATE_LIMITER: { limit: async () => ({ success: true }) } }; png = encode({ width: 825, height: 825, channels: 3, depth: 8, data: new Uint8Array(825 * 825 * 3).fill(255) }); draft = { version: 2, submissionId: crypto.randomUUID(), tobacco: { catalogId: 'test-blend' }, artworkProfileId: 'circle-2.5@1', altText: 'Synthetic test label', writingArea: { shape: 'rectangle', x: .35, y: .6, width: .3, height: .1 }, image: { sha256: await sha256(png), bytes: png.length, width: 825, height: 825 }, acknowledgement: { version: '2026-09-06-v2', accepted: true } }; });

it.each(['/config', '/labels', ...['', '/artwork', '/thumbnail', '/pack'].map(suffix => '/labels/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' + suffix)])('limits public read %s before database or object access', async path => {
  const limit = vi.fn(async () => ({ success: false }));
  env.GALLERY_READ_RATE_LIMITER = env.GALLERY_IMAGE_RATE_LIMITER = env.GALLERY_PACK_RATE_LIMITER = { limit };
  const query = vi.spyOn(db, 'prepare');
  const read = vi.spyOn(bucket, 'get');
  const response = await call(path);
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'rate_limited' });
  expect(response.headers.get('Retry-After')).toBe('60');
  expect(query).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
  expect(limit).toHaveBeenCalledOnce();
});

it('serves published downloads with a separate read allowance and fails closed when it is unavailable', async () => {
  await approve();
  env.GALLERY_RATE_LIMITER = { limit: async () => ({ success: false }) };
  expect((await call(`/labels/${draft.submissionId}/pack`)).status).toBe(200);
  env.GALLERY_PACK_RATE_LIMITER = undefined;
  const query = vi.spyOn(db, 'prepare');
  const read = vi.spyOn(bucket, 'get');
  expect((await call(`/labels/${draft.submissionId}/pack`)).status).toBe(503);
  expect(query).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
});

it.each(['denied', 'missing'] as const)('rejects %s upload allowance before reading the body', async mode => {
  expect((await call('/submissions', 'POST', draft)).status).toBe(201);
  env.GALLERY_UPLOAD_RATE_LIMITER = mode === 'missing' ? undefined : { limit: async () => ({ success: false }) };
  const request = new Request(`https://site.example/api/gallery/v1/submissions/${draft.submissionId}/artwork`, { method: 'PUT', headers: { Origin: 'https://site.example', Authorization: `Bearer ${key}`, 'Content-Type': 'image/png' }, body: png as BodyInit });
  const reader = vi.spyOn(request.body!, 'getReader');
  const response = await galleryResponse(request, env, deps);
  expect(response.status).toBe(mode === 'missing' ? 503 : 429);
  expect(await response.json()).toEqual({ error: mode === 'missing' ? 'rate_limit_unavailable' : 'rate_limited' });
  if (mode === 'denied') expect(response.headers.get('Retry-After')).toBe('60');
  expect(reader).not.toHaveBeenCalled();
  expect(db.db.prepare('SELECT upload_attempts FROM gallery_submissions').get()!.upload_attempts).toBe(0);
});

it('durably bounds malformed PNG retries across fresh rate allowances', async () => {
  png[png.length - 1] ^= 1;
  draft.image.sha256 = await sha256(png);
  expect((await call('/submissions', 'POST', draft)).status).toBe(201);
  for (let i = 0; i < 3; i++) {
    const response = await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'unsupported_image' });
  }
  const response = await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png);
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'upload_attempts_exhausted' });
  expect(db.db.prepare('SELECT state,upload_attempts FROM gallery_submissions').get()).toMatchObject({ state: 'reserved', upload_attempts: 3 });
});

it('charges mismatched bodies, permits a transient recovery, and preserves successful idempotency', async () => {
  await call('/submissions', 'POST', draft);
  expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', new Uint8Array([1]))).status).toBe(400);
  bucket.failPut = true;
  expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)).status).toBe(503);
  bucket.failPut = false;
  expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)).status).toBe(200);
  expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)).status).toBe(200);
  expect(db.db.prepare('SELECT upload_attempts FROM gallery_submissions').get()!.upload_attempts).toBe(3);
});

it('does not refund abandoned leases or allow concurrent requests to exceed the attempt cap', async () => {
  await call('/submissions', 'POST', draft);
  db.db.exec("UPDATE gallery_submissions SET state='uploading',upload_attempts=2,lease_until='2026-09-06T11:59:00.000Z'");
  bucket.failPut = true;
  const responses = await Promise.all([call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png), call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)]);
  expect(responses.filter(r => r.status === 503)).toHaveLength(1);
  expect(responses.filter(r => r.status === 409 || r.status === 429)).toHaveLength(1);
  expect(db.db.prepare('SELECT upload_attempts FROM gallery_submissions').get()!.upload_attempts).toBe(3);
  expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)).status).toBe(429);
});

it('fails public reads closed when salt is absent or the limiter fails', async () => {
  const query = vi.spyOn(db, 'prepare');
  env.GALLERY_IP_SALT = undefined;
  expect((await call('/labels')).status).toBe(503);
  env.GALLERY_IP_SALT = 'fixture';
  env.GALLERY_READ_RATE_LIMITER = { limit: async () => { throw Error('unavailable'); } };
  expect((await call('/labels')).status).toBe(503);
  expect(query).not.toHaveBeenCalled();
});

it.each(['GET', 'HEAD', 'OPTIONS', 'POST', 'DELETE', 'PATCH', 'PUT'])('rejects unsupported public %s routes before storage or body access', async method => {
  const query = vi.spyOn(db, 'prepare');
  const read = vi.spyOn(bucket, 'get');
  for (const path of ['/unknown', '/labels/not-a-uuid', '/submissions/not-a-uuid/artwork']) {
    const request = new Request('https://site.example/api/gallery/v1' + path, { method, headers: { Origin: 'https://site.example' }, ...(!['GET', 'HEAD'].includes(method) ? { body: '{}' } : {}) });
    const reader = request.body ? vi.spyOn(request.body, 'getReader') : null;
    expect((await galleryResponse(request, env, deps)).status).toBe(404);
    if (reader) expect(reader).not.toHaveBeenCalled();
  }
  expect(query).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
});

it.each(['HEAD', 'OPTIONS', 'POST', 'DELETE', 'PATCH', 'PUT'])('rejects unsupported %s on a known read route before storage', async method => {
  const query = vi.spyOn(db, 'prepare');
  expect((await call('/labels', method)).status).toBe(404);
  expect(query).not.toHaveBeenCalled();
});

it.each(['denied', 'missing', 'failed', 'salt-missing'] as const)('fails submission admission closed when %s before body, queries, or challenge verification', async mode => {
  if (mode === 'missing') env.GALLERY_MUTATION_RATE_LIMITER = undefined;
  else env.GALLERY_MUTATION_RATE_LIMITER = { limit: async () => { if (mode === 'failed') throw Error('unavailable'); return { success: mode === 'salt-missing' }; } };
  if (mode === 'salt-missing') env.GALLERY_IP_SALT = undefined;
  const query = vi.spyOn(db, 'prepare');
  const challenge = vi.fn(async () => false);
  const reservation = vi.spyOn(env.GALLERY_RATE_LIMITER!, 'limit');
  const request = new Request('https://site.example/api/gallery/v1/submissions', { method: 'POST', headers: { Origin: 'https://site.example', Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
  const reader = vi.spyOn(request.body!, 'getReader');
  const response = await galleryResponse(request, env, { ...deps, verifyTurnstile: challenge });
  expect(response.status).toBe(mode === 'denied' ? 429 : 503);
  if (mode === 'denied') expect(response.headers.get('Retry-After')).toBe('60');
  expect(query).not.toHaveBeenCalled();
  expect(reader).not.toHaveBeenCalled();
  expect(challenge).not.toHaveBeenCalled();
  expect(reservation).not.toHaveBeenCalled();
});

it('charges failed challenges without using the reservation quota and blocks subsequent work when exhausted', async () => {
  const limit = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValue({ success: false });
  env.GALLERY_MUTATION_RATE_LIMITER = { limit };
  const challenge = vi.fn(async () => false);
  const reservation = vi.spyOn(env.GALLERY_RATE_LIMITER!, 'limit');
  const send = () => galleryResponse(new Request('https://site.example/api/gallery/v1/submissions', { method: 'POST', headers: { Origin: 'https://site.example', Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(draft) }), env, { ...deps, verifyTurnstile: challenge });
  expect((await send()).status).toBe(403);
  const query = vi.spyOn(db, 'prepare');
  expect((await send()).status).toBe(429);
  expect(query).not.toHaveBeenCalled();
  expect(challenge).toHaveBeenCalledOnce();
  expect(limit).toHaveBeenCalledTimes(2);
  expect(reservation).not.toHaveBeenCalled();
});

it('charges idempotent reservation replays separately and preserves replay once request admission resumes', async () => {
  await call('/submissions', 'POST', draft);
  const reservation = vi.spyOn(env.GALLERY_RATE_LIMITER!, 'limit');
  const query = vi.spyOn(db, 'prepare');
  env.GALLERY_MUTATION_RATE_LIMITER = { limit: async () => ({ success: false }) };
  expect((await call('/submissions', 'POST', draft)).status).toBe(429);
  expect(query).not.toHaveBeenCalled();
  env.GALLERY_MUTATION_RATE_LIMITER = { limit: async () => ({ success: true }) };
  expect((await call('/submissions', 'POST', draft)).status).toBe(200);
  expect(reservation).not.toHaveBeenCalled();
});

it('disables advertised intake when public mutation admission is unavailable', async () => {
  env.GALLERY_TURNSTILE_SITE_KEY = 'fixture';
  expect(await (await call('/config')).json()).toMatchObject({ intake: true });
  env.GALLERY_MUTATION_RATE_LIMITER = undefined;
  expect(await (await call('/config')).json()).toMatchObject({ intake: false });
});
