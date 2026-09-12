// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { encode } from 'fast-png';
import JSZip from 'jszip';
import { galleryResponse } from './routes';
import { cleanGallery } from './cleanup';
import { sha256, type GalleryBucket, type GalleryDatabase, type GalleryEnv } from './storage';
import type { GalleryLabelDraft, GalleryReceipt } from '../../src/lib/gallery/types';
import { canonicalJson, parseGalleryDraft } from '../../src/lib/gallery/schema';
import { verifyGalleryAdmin } from './auth';
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
describe('private gallery workflow', () => {
    it('pauses all gallery operations and cleanup until saved metadata is migrated', async () => {
        await submit();
        db.db.prepare("UPDATE gallery_submissions SET metadata_json=json_set(metadata_json,'$.version',1),expires_at='2000-01-01'").run();
        const before = db.db.prepare('SELECT * FROM gallery_submissions').all();
        for (const path of ['/labels','/admin/submissions','/agent/jobs']) expect((await call(path)).status).toBe(503);
        expect(await cleanGallery(env,now)).toEqual({deleted:0,failures:0,orphans:0});
        expect(db.db.prepare('SELECT * FROM gallery_submissions').all()).toEqual(before);
        db.db.prepare("UPDATE gallery_submissions SET metadata_json=json_set(metadata_json,'$.version',2)").run();
        expect((await call('/labels')).status).toBe(200);
    });
    it('admits proofed operator artwork without a public challenge while preserving human publication review', async () => {
        env.GALLERY_RATE_LIMITER = { limit: async () => ({ success: false }) };
        const create = await call('/admin/intake', 'POST', draft, { 'X-Test-Admin': 'yes' });
        expect(create.status).toBe(201);
        expect((await create.json()).state).toBe('reserved');
        expect((await call('/admin/intake', 'POST', draft, { 'X-Test-Admin': 'yes' })).status).toBe(200);
        expect((await call(`/admin/intake/${draft.submissionId}/artwork`, 'PUT', png)).status).toBe(403);
        const uploaded = await call(`/admin/intake/${draft.submissionId}/artwork`, 'PUT', png, { 'X-Test-Admin': 'yes' });
        expect(uploaded.status).toBe(200);
        const pending = await uploaded.json();
        expect(pending.state).toBe('pending');
        expect((await call(`/labels/${draft.submissionId}`)).status).toBe(404);
        expect(db.db.prepare("SELECT COUNT(*) AS n FROM gallery_review_events WHERE submission_id=? AND action='curated-intake'").get(draft.submissionId)!.n).toBe(1);
        const published = await call(`/admin/submissions/${draft.submissionId}/approve`, 'POST', { expectedVersion: pending.version, digest: pending.digest }, { 'X-Test-Admin': 'yes' });
        expect(published.status).toBe(200);
        expect((await published.json()).state).toBe('published');
    });
    it('gates exact reviewed bytes and every direct URL after human unpublish', async () => { const pending = await submit(); expect((await call(`/labels/${draft.submissionId}/artwork`)).status).toBe(404); expect((await call(`/submissions/${draft.submissionId}/preview`, 'GET', undefined, { Authorization: 'Bearer ' + 'b'.repeat(64) })).status).toBe(404); expect((await call(`/admin/submissions/${draft.submissionId}/artwork`)).status).toBe(403); const r = await call(`/admin/submissions/${draft.submissionId}/approve`, 'POST', { expectedVersion: pending.version, digest: pending.digest }, { 'X-Test-Admin': 'yes' }); expect(r.status).toBe(200); const published = await r.json(); for (const kind of ['artwork', 'thumbnail', 'pack']) {
        const a = await call(`/labels/${draft.submissionId}/${kind}`);
        expect(a.status).toBe(200);
        expect(a.headers.get('cache-control')).toBe('no-store');
    } const projection = await (await call(`/labels/${draft.submissionId}`)).text(); for (const secret of ['capability_hash', 'acknowledgement', 'proposedIdentity', 'r2_key', 'reviewer'])
        expect(projection).not.toContain(secret); expect((await call(`/admin/submissions/${draft.submissionId}/unpublish`, 'POST', { expectedVersion: published.version }, { 'X-Test-Admin': 'yes' })).status).toBe(200); for (const kind of ['artwork', 'thumbnail', 'pack'])
        expect((await call(`/labels/${draft.submissionId}/${kind}`, 'GET', undefined, { 'If-None-Match': 'anything' })).status).toBe(404); expect((await call(`/submissions/${draft.submissionId}/withdraw`, 'POST', {})).status).toBe(404); });
    it('resolves retries without consumed challenges and rejects changed uploads', async () => { await submit(); env.GALLERY_INTAKE = 'false'; expect((await call('/submissions', 'POST', draft)).status).toBe(200); expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)).status).toBe(200); const changed = png.slice(); changed[50] ^= 1; expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', changed)).status).toBe(400); expect((await call('/submissions', 'POST', { ...draft, edition: 'different' })).status).toBe(409); });
    it('rejects malformed PNG even with its correct declared hash', async () => { png = new Uint8Array([1, 2, 3]); draft.image.bytes = 3; draft.image.sha256 = await sha256(png); expect((await call('/submissions', 'POST', draft)).status).toBe(201); expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)).status).not.toBe(200); expect(bucket.objects.size).toBe(0); });
    it('cannot approve stale metadata or publish an unknown blend', async () => { draft.tobacco = { maker: 'Unknown', blend: 'Test' }; const r = await submit(); expect((await call(`/admin/submissions/${draft.submissionId}/approve`, 'POST', { expectedVersion: r.version, digest: r.digest }, { 'X-Test-Admin': 'yes' })).status).toBe(400); const mapped = { ...draft, tobacco: { catalogId: 'test-blend' } }; expect((await call(`/admin/submissions/${draft.submissionId}`, 'PATCH', { expectedVersion: r.version, metadata: mapped }, { 'X-Test-Admin': 'yes' })).status).toBe(200); expect((await call(`/admin/submissions/${draft.submissionId}/approve`, 'POST', { expectedVersion: r.version, digest: r.digest }, { 'X-Test-Admin': 'yes' })).status).toBe(409); });
    it('retains capacity and retryable records across failed delete', async () => { const r=await submit(); await call(`/admin/submissions/${draft.submissionId}/reject`,'POST',{expectedVersion:r.version,reason:'unsuitable'},{'X-Test-Admin':'yes'}); bucket.failDelete = true; const failed = await cleanGallery(env, new Date('2026-09-14')); expect(failed.failures).toBeGreaterThan(0); expect(db.db.prepare('SELECT reserved_bytes FROM gallery_submissions').get()!.reserved_bytes).toBeGreaterThan(0); bucket.failDelete = false; expect((await cleanGallery(env, new Date('2026-09-14'))).deleted).toBe(1); expect(bucket.objects.size).toBe(0); expect(db.db.prepare('SELECT metadata_json FROM gallery_submissions').get()!.metadata_json).toBeNull(); });
    it('recovers failed writes without exposing a pending artifact', async () => { await call('/submissions', 'POST', draft); bucket.failPut = true; expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)).status).toBe(503); expect((await call(`/labels/${draft.submissionId}/artwork`)).status).toBe(404); bucket.failPut = false; expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)).status).toBe(200); });
    it('atomically enforces daily reservation caps', async () => { for (let i = 0; i < 20; i++) {
        draft.submissionId = crypto.randomUUID();
        expect((await call('/submissions', 'POST', draft)).status).toBe(201);
    } draft.submissionId = crypto.randomUUID(); expect((await call('/submissions', 'POST', draft)).status).toBe(429); expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_submissions').get()!.n).toBe(20); });
    it('rejects cross-origin changes and forged production admin', async () => { expect((await call('/submissions', 'POST', draft, { Origin: 'https://evil.example' })).status).toBe(403); expect(await verifyGalleryAdmin(new Request('https://site.example', { headers: { 'Cf-Access-Jwt-Assertion': 'forged' } }), { GALLERY_ACCESS_ISSUER: 'https://test.cloudflareaccess.com', GALLERY_ACCESS_AUD: 'aud', GALLERY_ADMIN_SUBJECT: 'admin' })).toBeNull(); });
    it('rejects private manifest fields and unsafe reference URLs', () => { expect(() => parseGalleryDraft({ ...draft, notes: 'secret' })).toThrow(); expect(() => parseGalleryDraft({ ...draft, evidence: { references: [{ role: 'package-appearance', url: 'https://shop.example/a%40b.com' }] } })).toThrow(); expect(() => parseGalleryDraft({ ...draft, evidence: { references: [{ role: 'package-appearance', url: 'http://127.0.0.1/' }] } })).toThrow(); });
    it('binds publication identity to review and resolves public duplicates only', async () => { const original = await approve(); const oldId = draft.submissionId; db.db.exec("UPDATE gallery_tobaccos SET maker='Renamed' WHERE id='test-blend'"); expect((await (await call(`/labels/${oldId}`)).json()).maker).toBe('Test'); draft.submissionId = crypto.randomUUID(); const pending = await submit(); expect(pending.publicationId).toBeNull(); const duplicate = await (await call(`/admin/submissions/${draft.submissionId}/approve`, 'POST', { expectedVersion: pending.version, digest: pending.digest }, { 'X-Test-Admin': 'yes' })).json(); expect(duplicate.state).toBe('rejected'); expect(duplicate.publicationId).toBe(original.id); expect(db.db.prepare("SELECT COUNT(*) AS n FROM gallery_submissions WHERE state='published'").get()!.n).toBe(1); });
    it('refreshes a published identity and downloadable pack after a catalog correction', async () => {
        const published = await approve();
        db.db.exec("UPDATE gallery_tobaccos SET maker='Test',blend='Blend: Corrected' WHERE id='test-blend'");
        const refreshed = await call(`/admin/publications/${draft.submissionId}/refresh`, 'POST', { expectedVersion: published.version }, { 'X-Test-Admin': 'yes' });
        expect(refreshed.status).toBe(200);
        expect((await refreshed.json()).publishedIdentity).toEqual({ maker: 'Test', blend: 'Blend: Corrected' });
        const projection = await (await call(`/labels/${draft.submissionId}`)).json();
        expect(projection.blend).toBe('Blend: Corrected');
        const archive = await (await call(`/labels/${draft.submissionId}/pack`)).arrayBuffer();
        const zip = await JSZip.loadAsync(archive);
        const manifest = JSON.parse(await zip.file('manifest.json')!.async('text'));
        expect(manifest.labels[0].blend).toBe('Blend: Corrected');
        expect(db.db.prepare("SELECT COUNT(*) AS n FROM gallery_review_events WHERE submission_id=? AND action='refresh'").get(draft.submissionId)!.n).toBe(1);
    });
    it('keeps a matching publication unchanged until staged replacement review exists', async () => {
        const published = await approve();
        const originalId = published.id;
        const before = new Uint8Array(await (await call(`/labels/${originalId}/artwork`)).arrayBuffer());
        const replacement = encode({ width: 825, height: 825, channels: 3, depth: 8, data: new Uint8Array(825 * 825 * 3).fill(64) });
        const reference = 'https://www.smokingpipes.com/pipe-tobacco/test/blend/product_id/1';
        const revised = { ...draft, submissionId: crypto.randomUUID(), evidence: { references: [{ role: 'package-appearance' as const, url: reference }] }, image: { ...draft.image, sha256: await sha256(replacement), bytes: replacement.length } };
        const form = new FormData();
        form.set('metadata', JSON.stringify(revised));
        form.set('artwork', new Blob([replacement as Uint8Array<ArrayBuffer>], { type: 'image/png' }), 'label.png');
        const response = await galleryResponse(new Request('https://site.example/api/gallery/v1/admin/reconcile', { method: 'POST', headers: { Origin: 'https://site.example', 'X-Test-Admin': 'yes' }, body: form }), env, deps);
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: 'replacement_review_required' });
        expect(new Uint8Array(await (await call(`/labels/${originalId}/artwork`)).arrayBuffer())).toEqual(before);
        expect(db.db.prepare("SELECT COUNT(*) AS n FROM gallery_submissions WHERE state='published' AND catalog_id='test-blend'").get()!.n).toBe(1);
        expect(db.db.prepare("SELECT COUNT(*) AS n FROM gallery_review_events WHERE submission_id=? AND action='reconcile'").get(originalId)!.n).toBe(0);
    });
    it('serializes concurrent upload leases and cancels approval after a terminal retention transition', async () => { await call('/submissions', 'POST', draft); const uploads = await Promise.all([call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png), call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)]); expect(uploads.filter(r => r.status === 200)).toHaveLength(1); expect(uploads.filter(r => r.status === 409)).toHaveLength(1); const pending = await (await call(`/admin/submissions/${draft.submissionId}`,'GET',undefined,{'X-Test-Admin':'yes'})).json(); const originalPut = bucket.put.bind(bucket); bucket.put = async (k, b) => { await originalPut(k, b); if (k.includes('/pack-'))
        db.db.prepare("UPDATE gallery_submissions SET state='expired',row_version=row_version+1 WHERE id=?").run(draft.submissionId); }; expect((await call(`/admin/submissions/${draft.submissionId}/approve`, 'POST', { expectedVersion: pending.version, digest: pending.digest }, { 'X-Test-Admin': 'yes' })).status).not.toBe(200); expect((await call(`/labels/${draft.submissionId}/pack`)).status).toBe(404); expect((await (await call(`/admin/submissions/${draft.submissionId}`,'GET',undefined,{'X-Test-Admin':'yes'})).json()).state).toBe('expired'); });
    it('rejects alternate API versions and stops new bytes when intake closes', async () => { await call('/submissions', 'POST', draft); env.GALLERY_INTAKE = 'false'; expect((await call(`/submissions/${draft.submissionId}/artwork`, 'PUT', png)).status).toBe(503); expect((await galleryResponse(new Request('https://site.example/api/gallery/v2/config'), env, deps)).status).toBe(404); });
 it('does not delete a publication when a cleanup claim loses its race',async()=>{
  await approve();db.db.exec("UPDATE gallery_submissions SET state='unpublished',deletion_due='2026-09-05',expires_at='2026-10-05'");
  const prepare=db.prepare.bind(db);db.prepare=(sql:string)=>{const statement=prepare(sql);if(sql.startsWith("UPDATE gallery_submissions SET state='deleting'")){const run=statement.run;statement.run=async()=>{db.db.exec("UPDATE gallery_submissions SET state='published',deletion_due=NULL");return run()}}return statement};
  expect((await cleanGallery(env,now)).deleted).toBe(0);expect(bucket.objects.size).toBe(3);expect((await call(`/labels/${draft.submissionId}/pack`)).status).toBe(200)
 });
 it('sweeps an old failed-upload object without touching the new upload version',async()=>{
  await call('/submissions','POST',draft);const put=bucket.put.bind(bucket);let first=true;bucket.put=async(k,b)=>{if(k.includes('thumbnail')&&first){first=false;throw Error('injected')}await put(k,b)};
  expect((await call(`/submissions/${draft.submissionId}/artwork`,'PUT',png)).status).toBe(503);const oldKeys=[...bucket.objects.keys()];expect((await call(`/submissions/${draft.submissionId}/artwork`,'PUT',png)).status).toBe(200);
  expect((await cleanGallery(env,now)).orphans).toBe(1);expect(oldKeys.every(k=>!bucket.objects.has(k))).toBe(true);expect((await call(`/admin/submissions/${draft.submissionId}/thumbnail`,'GET',undefined,{'X-Test-Admin':'yes'})).status).toBe(200)
 });
 it('fails publication closed when catalog or switch changes during preparation',async()=>{
  const pending=await submit();const put=bucket.put.bind(bucket);bucket.put=async(k,b)=>{await put(k,b);if(k.includes('/pack-'))db.db.exec('UPDATE gallery_settings SET publication=0')};
  expect((await call(`/admin/submissions/${draft.submissionId}/approve`,'POST',{expectedVersion:pending.version,digest:pending.digest},{'X-Test-Admin':'yes'})).status).not.toBe(200);expect((await call(`/labels/${draft.submissionId}/artwork`)).status).toBe(404)
 });

 it('accepts valid finished-trim oval geometry without treating it as its bounding box',()=>{
  draft.writingArea={shape:'oval',x:.272807,y:.70614,width:.449123,height:.209649};
  expect(parseGalleryDraft(draft).writingArea).toEqual(draft.writingArea);
  draft.writingArea={...draft.writingArea,y:.85};expect(()=>parseGalleryDraft(draft)).toThrow();
 });

 it('preserves schema-valid rounded rectangle radii while using the importer perimeter clamp',()=>{
  draft.writingArea={shape:'rounded-rectangle',x:.268657,y:.737489,width:.459175,height:.113257,cornerRadius:.5};
  expect(parseGalleryDraft(draft).writingArea.cornerRadius).toBe(.5);
  draft.writingArea.cornerRadius=.51;expect(()=>parseGalleryDraft(draft)).toThrow();
  draft.writingArea.cornerRadius=NaN;expect(()=>parseGalleryDraft(draft)).toThrow();
 });

 it.each(['correct','duplicate','approve','reject','unpublish','republish'])('rolls back %s when its audit insert fails, then retries with one event',async(action)=>{
  let current:GalleryReceipt;
  if(action==='unpublish'||action==='republish'){
   current=await approve();
   if(action==='republish')current=await(await call(`/admin/submissions/${draft.submissionId}/unpublish`,'POST',{expectedVersion:current.version},{'X-Test-Admin':'yes'})).json();
  }else if(action==='duplicate'){
   await approve();draft.submissionId=crypto.randomUUID();current=await submit();
  }else current=await submit();
  const before=db.db.prepare('SELECT * FROM gallery_submissions WHERE id=?').get(draft.submissionId)!;
  const existingCount=db.db.prepare('SELECT COUNT(*) AS n FROM gallery_review_events WHERE submission_id=?').get(draft.submissionId)!.n;
  db.db.exec(`CREATE TRIGGER fail_review_event BEFORE INSERT ON gallery_review_events WHEN NEW.action='${action}' BEGIN SELECT RAISE(ABORT,'injected audit failure'); END;`);
  const invoke=async(r:GalleryReceipt)=>action==='correct'?call(`/admin/submissions/${draft.submissionId}`,'PATCH',{expectedVersion:r.version,metadata:{...draft,edition:'reviewed edition'}},{'X-Test-Admin':'yes'}):call(`/admin/submissions/${draft.submissionId}/${action==='duplicate'?'approve':action}`,'POST',{expectedVersion:r.version,...(['approve','duplicate'].includes(action)?{digest:r.digest}:action==='reject'?{reason:'unsuitable'}:{})},{'X-Test-Admin':'yes'});
  expect((await invoke(current)).status).toBe(503);
  const after=db.db.prepare('SELECT * FROM gallery_submissions WHERE id=?').get(draft.submissionId)!;
  expect(after.state).toBe(before.state);expect(after.metadata_json).toBe(before.metadata_json);
  expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_review_events WHERE submission_id=?').get(draft.submissionId)!.n).toBe(existingCount);
  if(action!=='approve')expect(after.row_version).toBe(before.row_version);
  db.db.exec('DROP TRIGGER fail_review_event');current=await(await call(`/admin/submissions/${draft.submissionId}`,'GET',undefined,{'X-Test-Admin':'yes'})).json();
  expect((await invoke(current)).status).toBe(200);
  const events=db.db.prepare('SELECT * FROM gallery_review_events WHERE submission_id=? AND action=?').all(draft.submissionId,action);
  expect(events).toHaveLength(1);const committed=db.db.prepare('SELECT * FROM gallery_submissions WHERE id=?').get(draft.submissionId)!;
  expect(events[0].row_version).toBe(committed.row_version);expect(events[0].digest).toBe(committed.digest);expect(events[0].actor).toBe('admin');
 });
 it('does not write a competing reviewer event for a stale guarded transition',async()=>{
  const pending=await submit();const commands=[call(`/admin/submissions/${draft.submissionId}/reject`,'POST',{expectedVersion:pending.version,reason:'unsuitable'},{'X-Test-Admin':'yes'}),call(`/admin/submissions/${draft.submissionId}`,'PATCH',{expectedVersion:pending.version,metadata:{...draft,edition:'competing edit'}},{'X-Test-Admin':'yes'})];
  const results=await Promise.all(commands);expect(results.map(r=>r.status).sort()).toEqual([200,409]);
  const events=db.db.prepare('SELECT * FROM gallery_review_events WHERE submission_id=?').all(draft.submissionId);expect(events).toHaveLength(1);
  const row=db.db.prepare('SELECT * FROM gallery_submissions WHERE id=?').get(draft.submissionId)!;expect(events[0].row_version).toBe(row.row_version);expect(events[0].digest).toBe(row.digest);expect(events[0].action).toBe(row.state==='rejected'?'reject':'correct');
 });

 async function machineGrant(ids:string[],scopes=['queue:read','submission:read','artwork:read','recommendation:write']){
  env.GALLERY_AGENT_ENABLED='true';const response=await call('/admin/agent-grants','POST',{clientId:'fixture.access',label:'Local assistant',scopes,selection:'selected',submissionIds:ids,expiresAt:'2026-09-20T12:00:00.000Z'},{'X-Test-Admin':'yes'});expect(response.status).toBe(201);return response.json();
 }
 const agentCall=(path:string,method='GET',body?:unknown)=>call('/agent'+path,method,body,{'X-Test-Machine':'yes'});
 const proposal=(r:{version:number;digest:string})=>({schemaVersion:1,expectedVersion:r.version,digest:r.digest,idempotencyKey:crypto.randomUUID(),assessment:'ready-for-human-review',findings:[{category:'artwork',severity:'info',explanation:'Synthetic original label inspected.',evidence:[{type:'artwork'}]}]});
 it('limits a machine to selected pending records and rejects every human mutation',async()=>{
  const selected=await submit();draft.submissionId=crypto.randomUUID();const unselected=await submit();await machineGrant([selected.id]);
  const queue=await(await agentCall('/submissions')).json();expect(queue.submissions.map((r:{id:string})=>r.id)).toEqual([selected.id]);expect(queue.counts).toBeUndefined();
  expect((await agentCall(`/submissions/${selected.id}/artwork`)).status).toBe(200);expect((await agentCall(`/submissions/${unselected.id}`)).status).toBe(404);
  const detail=await(await agentCall(`/submissions/${selected.id}`)).text();for(const field of ['capability_hash','r2_key','quota_key','reviewer'])expect(detail).not.toContain(field);
  for(const action of ['approve','reject','unpublish','republish','withdraw'])expect((await agentCall(`/submissions/${selected.id}/${action}`,'POST',{})).status).toBe(404);
  expect((await call(`/admin/submissions/${selected.id}/approve`,'POST',{expectedVersion:selected.version,digest:selected.digest},{'X-Test-Machine':'yes'})).status).toBe(403);
  expect((await call(`/agent/submissions/${selected.id}`)).status).toBe(403);
 });
 it('checks grant scopes, expiry and revocation on every access',async()=>{
  const r=await submit();const grant=await machineGrant([r.id],['submission:read']);expect((await agentCall('/submissions')).status).toBe(403);expect((await agentCall(`/submissions/${r.id}/artwork`)).status).toBe(403);expect((await agentCall(`/submissions/${r.id}`)).status).toBe(200);
  db.db.prepare('UPDATE gallery_agent_grants SET expires_at=? WHERE id=?').run('2000-01-01',grant.id);expect((await agentCall(`/submissions/${r.id}`)).status).toBe(403);
  db.db.prepare('UPDATE gallery_agent_grants SET expires_at=? WHERE id=?').run('2026-09-20',grant.id);expect((await call(`/admin/agent-grants/${grant.id}/revoke`,'POST',{expectedVersion:grant.version},{'X-Test-Admin':'yes'})).status).toBe(200);expect((await agentCall(`/submissions/${r.id}`)).status).toBe(403);
 });
 it('appends advisory recommendations idempotently without changing review state',async()=>{
  const r=await submit();await machineGrant([r.id]);const body=proposal(r);expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',body)).status).toBe(201);expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',body)).status).toBe(200);
  expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',{...body,assessment:'needs-attention'})).status).toBe(409);
  const state=await(await call(`/admin/submissions/${r.id}`,'GET',undefined,{'X-Test-Admin':'yes'})).json();expect(state.version).toBe(r.version);expect(state.state).toBe('pending');
  expect(db.db.prepare("SELECT COUNT(*) AS n FROM gallery_review_events WHERE submission_id=? AND action='recommendation'").get(r.id)!.n).toBe(1);
  const edited=await(await call(`/admin/submissions/${r.id}`,'PATCH',{expectedVersion:r.version,metadata:{...draft,edition:'corrected'}},{'X-Test-Admin':'yes'})).json();expect(edited.version).toBe(r.version+1);
  expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',{...body,idempotencyKey:crypto.randomUUID()})).status).toBe(409);
  const list=await(await call(`/admin/submissions/${r.id}/recommendations`,'GET',undefined,{'X-Test-Admin':'yes'})).json();expect(list.recommendations[0].stale).toBe(true);
 });
 it('rolls recommendation and quotas back together when audit persistence fails',async()=>{
  const r=await submit();await machineGrant([r.id]);db.db.exec("CREATE TRIGGER fail_agent_audit BEFORE INSERT ON gallery_review_events WHEN NEW.action='recommendation' BEGIN SELECT RAISE(ABORT,'injected'); END");
  const body=proposal(r);expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',body)).status).toBe(503);expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_agent_recommendations').get()!.n).toBe(0);expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_agent_quota').get()!.n).toBe(0);
  db.db.exec('DROP TRIGGER fail_agent_audit');expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',body)).status).toBe(201);
 });
 it('handles concurrent identical recommendations as one append and one quota charge',async()=>{
  const r=await submit();await machineGrant([r.id]);const body=proposal(r);const responses=await Promise.all([agentCall(`/submissions/${r.id}/recommendations`,'POST',body),agentCall(`/submissions/${r.id}/recommendations`,'POST',body)]);expect(responses.map(r=>r.status).sort()).toEqual([200,201]);expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_agent_recommendations').get()!.n).toBe(1);expect(db.db.prepare('SELECT MAX(used) AS n FROM gallery_agent_quota').get()!.n).toBe(1);
 });
 it('rechecks grant revocation during image retrieval and recommendation commit',async()=>{
  const r=await submit();const grant=await machineGrant([r.id]);const get=bucket.get.bind(bucket);bucket.get=async key=>{const result=await get(key);db.db.prepare('UPDATE gallery_agent_grants SET revoked_at=? WHERE id=?').run(now.toISOString(),grant.id);return result};expect((await agentCall(`/submissions/${r.id}/artwork`)).status).toBe(404);bucket.get=get;
  db.db.prepare('UPDATE gallery_agent_grants SET revoked_at=NULL WHERE id=?').run(grant.id);const batch=db.batch.bind(db);db.batch=async statements=>{db.db.prepare('UPDATE gallery_agent_grants SET revoked_at=? WHERE id=?').run(now.toISOString(),grant.id);return batch(statements)};
  expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',proposal(r))).status).toBe(409);expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_agent_recommendations').get()!.n).toBe(0);
 });
 it('enforces recommendation minute limits and strict evidence/actor boundaries',async()=>{
  const r=await submit();await machineGrant([r.id]);expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',{...proposal(r),actor:'Dylan'})).status).toBe(400);
  expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',{...proposal(r),findings:[{category:'reference',severity:'warning',explanation:'Look here',evidence:[{type:'reference',url:'https://unselected.example/private'}]}]})).status).toBe(400);
  for(let i=0;i<6;i++)expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',proposal(r))).status).toBe(201);const limited=await agentCall(`/submissions/${r.id}/recommendations`,'POST',proposal(r));expect(limited.status).toBe(429);expect(limited.headers.get('Retry-After')).toBe('60');
 });
 it('purges recommendation text at content expiry and surfaces maintenance results',async()=>{
  const r=await submit();await machineGrant([r.id]);await agentCall(`/submissions/${r.id}/recommendations`,'POST',proposal(r));await call(`/admin/submissions/${r.id}/reject`,'POST',{expectedVersion:r.version,reason:'unsuitable'},{'X-Test-Admin':'yes'});bucket.failDelete=true;await cleanGallery(env,new Date('2026-09-14'));expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_agent_recommendations').get()!.n).toBe(0);const operations=await(await call('/admin/operations','GET',undefined,{'X-Test-Admin':'yes'})).json();expect(operations.lastCleanupFailures).toBeGreaterThan(0);expect(operations.cleanupWaiting).toBe(1);
 });

 it('registers and revokes grants atomically with their human audit events',async()=>{
  const r=await submit();env.GALLERY_AGENT_ENABLED='true';const input={clientId:'fixture.access',label:'Test agent',scopes:['submission:read'],selection:'selected',submissionIds:[r.id],expiresAt:'2026-09-20T12:00:00.000Z'};
  db.db.exec("CREATE TRIGGER fail_grant_event BEFORE INSERT ON gallery_agent_grant_events BEGIN SELECT RAISE(ABORT,'injected'); END");expect((await call('/admin/agent-grants','POST',input,{'X-Test-Admin':'yes'})).status).toBe(503);expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_agent_grants').get()!.n).toBe(0);db.db.exec('DROP TRIGGER fail_grant_event');
  const grant=await(await call('/admin/agent-grants','POST',input,{'X-Test-Admin':'yes'})).json();db.db.exec("CREATE TRIGGER fail_revoke_event BEFORE INSERT ON gallery_agent_grant_events WHEN NEW.action='revoke' BEGIN SELECT RAISE(ABORT,'injected'); END");expect((await call(`/admin/agent-grants/${grant.id}/revoke`,'POST',{expectedVersion:1},{'X-Test-Admin':'yes'})).status).toBe(503);expect((await agentCall(`/submissions/${r.id}`)).status).toBe(200);db.db.exec('DROP TRIGGER fail_revoke_event');
  const results=await Promise.all([call(`/admin/agent-grants/${grant.id}/revoke`,'POST',{expectedVersion:1},{'X-Test-Admin':'yes'}),call(`/admin/agent-grants/${grant.id}/revoke`,'POST',{expectedVersion:1},{'X-Test-Admin':'yes'})]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(db.db.prepare("SELECT COUNT(*) AS n FROM gallery_agent_grant_events WHERE action='revoke'").get()!.n).toBe(1);
 });
 it('enforces hard daily image quota and per-version recommendation cap',async()=>{
  const r=await submit();const grant=await machineGrant([r.id]);db.db.prepare('INSERT INTO gallery_agent_quota VALUES(?,100,100,?)').run(`${grant.id}:image:day:2026-09-06`,'2026-09-08');expect((await agentCall(`/submissions/${r.id}/artwork`)).status).toBe(429);expect((await agentCall(`/submissions/${r.id}/thumbnail`)).status).toBe(200);
  for(let i=0;i<10;i++){db.db.prepare("DELETE FROM gallery_agent_quota WHERE bucket LIKE '%recommendation:minute%'").run();expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',proposal(r))).status).toBe(201)}db.db.prepare("DELETE FROM gallery_agent_quota WHERE bucket LIKE '%recommendation:minute%'").run();expect((await agentCall(`/submissions/${r.id}/recommendations`,'POST',proposal(r))).status).toBe(429);expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_agent_recommendations').get()!.n).toBe(10);
 });
 it('provides opaque stable oldest-first queue and mixed audit pagination',async()=>{
  const r=await submit();await machineGrant([r.id]);await agentCall(`/submissions/${r.id}`);await agentCall(`/submissions/${r.id}/recommendations`,'POST',proposal(r));
  const history=await(await call(`/admin/submissions/${r.id}/history`,'GET',undefined,{'X-Test-Admin':'yes'})).json();expect(history.events.some((e:{action:string})=>e.action==='detail')).toBe(true);expect(history.events.some((e:{action:string})=>e.action==='recommendation')).toBe(true);
  for(let i=0;i<25;i++)db.db.prepare('INSERT INTO gallery_agent_activity VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(`fixture:${String(i).padStart(2,'0')}`,null,r.id,'detail','allowed',r.version,r.digest,now.toISOString(),now.toISOString(),1,'2026-10-01');
  const first=await(await call(`/admin/submissions/${r.id}/history`,'GET',undefined,{'X-Test-Admin':'yes'})).json();expect(first.events).toHaveLength(24);const second=await(await call(`/admin/submissions/${r.id}/history?cursor=${first.nextCursor}`,'GET',undefined,{'X-Test-Admin':'yes'})).json();expect(second.events.length).toBeGreaterThan(0);expect(second.events.every((e:{id:string})=>!first.events.some((f:{id:string})=>e.id===f.id))).toBe(true);
  const queue=await(await call('/admin/submissions?state=pending&mappingNeeded=false&search=Blend','GET',undefined,{'X-Test-Admin':'yes'})).json();expect(queue.submissions.map((s:{id:string})=>s.id)).toEqual([r.id]);expect(queue.submissions[0].canonicalHash).toBeTruthy();
 });

 it('returns numeric zero counts for an empty human review queue',async()=>{
  const response=await call('/admin/submissions','GET',undefined,{'X-Test-Admin':'yes'});
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({submissions:[],nextCursor:null,counts:{pending:0,reservedBytes:0,oldestPendingAt:null,cleanupWaiting:0}});
 });

 it('denies removed contributor status, preview and withdrawal routes even with the upload nonce',async()=>{
  const pending=await submit();
  for(const [path,method] of [[`/submissions/${pending.id}`,'GET'],[`/submissions/${pending.id}/preview`,'GET'],[`/submissions/${pending.id}/withdraw`,'POST']]){
   expect((await call(path,method,method==='POST'?{}:undefined)).status).toBe(404);
  }
  expect((await call('/submissions','POST',draft)).status).toBe(200);
  expect((await call(`/submissions/${pending.id}/artwork`,'PUT',png)).status).toBe(200);
  const review=await(await call(`/admin/submissions/${pending.id}`,'GET',undefined,{'X-Test-Admin':'yes'})).json();expect(review.state).toBe('pending');
 });

});

it('requires v2 for new intake while preserving historical v1 retries, corrections and publication', async () => {
    expect((await (await call('/config')).json()).noticeVersion).toBe('2026-09-06-v2');
    const legacy: GalleryLabelDraft = { ...draft, acknowledgement: { version: '2026-09-06-v1', accepted: true } };
    expect((await call('/submissions', 'POST', legacy)).status).toBe(400);
    const pending = await submit();
    // Model a record accepted before the notice change, without changing its consent.
    db.db.prepare('UPDATE gallery_submissions SET metadata_json=?,request_hash=? WHERE id=?').run(canonicalJson(legacy), await sha256(canonicalJson(legacy)), legacy.submissionId);
    expect((await call('/submissions', 'POST', legacy)).status).toBe(200);
    const path = `/admin/submissions/${legacy.submissionId}`;
    const headers = { 'X-Test-Admin': 'yes' };
    expect((await call(path, 'PATCH', { expectedVersion: pending.version, metadata: draft }, headers)).status).toBe(400);
    const saved = await call(path, 'PATCH', { expectedVersion: pending.version, metadata: { ...legacy, edition: 'Reviewed historical submission' } }, headers);
    expect(saved.status).toBe(200);
    const corrected = await saved.json();
    expect(corrected.metadata.acknowledgement).toEqual(legacy.acknowledgement);
    expect((await call(`${path}/approve`, 'POST', { expectedVersion: corrected.version, digest: corrected.digest }, headers)).status).toBe(200);
    expect((await call(`/labels/${legacy.submissionId}/pack`)).status).toBe(200);
    expect(JSON.parse(db.db.prepare('SELECT metadata_json FROM gallery_submissions WHERE id=?').get(legacy.submissionId)!.metadata_json as string).acknowledgement).toEqual(legacy.acknowledgement);
});

// Replacement failures must leave the previously published resource usable.
async function replacement(shade = 64) {
    const bytes = encode({ width: 825, height: 825, channels: 3, depth: 8, data: new Uint8Array(825 * 825 * 3).fill(shade) });
    const metadata = { ...draft, submissionId: crypto.randomUUID(), altText: `Replacement ${shade}`, image: { ...draft.image, bytes: bytes.length, sha256: await sha256(bytes) } };
    return { bytes, metadata };
}
function reconcile(input: Awaited<ReturnType<typeof replacement>>, headers: Record<string, string> = {}) {
    const form = new FormData();
    form.set('metadata', JSON.stringify(input.metadata));
    form.set('artwork', new Blob([Uint8Array.from(input.bytes)], { type: 'image/png' }), 'label.png');
    return galleryResponse(new Request('https://site.example/api/gallery/v1/admin/reconcile', { method: 'POST', headers: { Origin: 'https://site.example', 'X-Test-Admin': 'yes', ...headers }, body: form }), env, deps);
}
async function publicationSnapshot() {
    return {
        row: db.db.prepare('SELECT * FROM gallery_submissions WHERE id=?').get(draft.submissionId),
        assets: db.db.prepare('SELECT * FROM gallery_assets WHERE submission_id=? ORDER BY kind').all(draft.submissionId),
        pack: await sha256(new Uint8Array(await (await call(`/labels/${draft.submissionId}/pack`)).arrayBuffer())),
        artwork: await sha256(new Uint8Array(await (await call(`/labels/${draft.submissionId}/artwork`)).arrayBuffer())),
        projection: await (await call(`/labels/${draft.submissionId}`)).json(),
    };
}
describe('curated publication replacement integrity', () => {
    it('rejects missing or foreign origins and unauthenticated curated requests', async () => {
        const input = await replacement();
        for (const headers of [{ Origin: 'https://evil.example' }, { Origin: '' }, { 'X-Test-Admin': '' }] as Record<string, string>[]) {
            expect((await reconcile(input, headers)).status).toBe(403);
        }
        expect(bucket.objects.size).toBe(0);
        expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_submissions').get()!.n).toBe(0);
    });
    it('preserves new curated intake fallback while existing replacements fail closed', async () => {
        const input = await replacement();
        const absent = await reconcile(input);
        expect(absent.status).toBe(404);
        expect(await absent.json()).toEqual({ error: 'publication_not_found' });
        expect(bucket.objects.size).toBe(0);
    });
    it('rejects oversized multipart uploads before storing any objects', async () => {
        await approve();
        const before = await publicationSnapshot();
        const form = new FormData();
        form.set('metadata', JSON.stringify(draft));
        form.set('artwork', new Blob([new Uint8Array(9 * 1024 * 1024)], { type: 'image/png' }), 'large.png');
        // Materialize this fixture before cancellation: Node 24's multipart
        // producer can enqueue after cancellation. Stream cancellation itself
        // is exercised below with an explicit controllable ReadableStream.
        const encoded = new Response(form);
        const bytes = await encoded.arrayBuffer();
        const response = await galleryResponse(new Request('https://site.example/api/gallery/v1/admin/reconcile', { method: 'POST', headers: { Origin: 'https://site.example', 'X-Test-Admin': 'yes', 'Content-Type': encoded.headers.get('Content-Type')! }, body: bytes }), env, deps);
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
        expect(await publicationSnapshot()).toEqual(before);
        expect(bucket.objects.size).toBe(3);
    });
    it('rejects simultaneous replacement attempts without changing published bytes', async () => {
        await approve();
        const before = await publicationSnapshot();
        const inputs = await Promise.all([replacement(64), replacement(128)]);
        const responses = await Promise.all(inputs.map(input => reconcile(input)));
        expect(responses.map(r => r.status)).toEqual([503, 503]);
        expect(await publicationSnapshot()).toEqual(before);
        expect(db.db.prepare("SELECT COUNT(*) AS n FROM gallery_review_events WHERE action='reconcile'").get()!.n).toBe(0);
    });
    for (const failure of ['put', 'head', 'audit'] as const) {
        it(`preserves published metadata and bytes when reconciliation ${failure} fails`, async () => {
            await approve();
            const before = await publicationSnapshot();
            if (failure === 'put') bucket.failPut = true;
            if (failure === 'head') bucket.head = async () => null;
            if (failure === 'audit') db.db.exec("CREATE TRIGGER fail_reconcile_audit BEFORE INSERT ON gallery_review_events WHEN NEW.action='reconcile' BEGIN SELECT RAISE(ABORT,'injected'); END");
            expect((await reconcile(await replacement())).status).not.toBe(200);
            expect(await publicationSnapshot()).toEqual(before);
            expect(db.db.prepare("SELECT COUNT(*) AS n FROM gallery_review_events WHERE action='reconcile'").get()!.n).toBe(0);
        });
        it(`preserves published identity and pack when refresh ${failure} fails`, async () => {
            const published = await approve();
            const before = await publicationSnapshot();
            db.db.exec("UPDATE gallery_tobaccos SET blend='Corrected' WHERE id='test-blend'");
            if (failure === 'put') bucket.failPut = true;
            if (failure === 'head') bucket.head = async () => null;
            if (failure === 'audit') db.db.exec("CREATE TRIGGER fail_refresh_audit BEFORE INSERT ON gallery_review_events WHEN NEW.action='refresh' BEGIN SELECT RAISE(ABORT,'injected'); END");
            expect((await call(`/admin/publications/${draft.submissionId}/refresh`, 'POST', { expectedVersion: published.version }, { 'X-Test-Admin': 'yes' })).status).not.toBe(200);
            expect(await publicationSnapshot()).toEqual(before);
        });
    }
    for (const action of ['shutdown', 'unpublish'] as const) {
        it(`does not begin ${action} interruption hooks while replacements are closed`, async () => {
            const published = await approve();
            const before = await publicationSnapshot();
            const put = bucket.put.bind(bucket);
            let interrupted = false;
            bucket.put = async (k, bytes) => {
                await put(k, bytes);
                if (!interrupted) {
                    interrupted = true;
                    if (action === 'shutdown') db.db.exec('UPDATE gallery_settings SET publication=0');
                    else expect((await call(`/admin/submissions/${draft.submissionId}/unpublish`, 'POST', { expectedVersion: published.version }, { 'X-Test-Admin': 'yes' })).status).toBe(200);
                }
            };
            expect((await reconcile(await replacement())).status).not.toBe(200);
            expect(interrupted).toBe(false);
            expect(await publicationSnapshot()).toEqual(before);
        });
    }
    it('keeps the old publication visible while staging a refreshed pack', async () => {
        const published = await approve();
        const before = await publicationSnapshot();
        db.db.exec("UPDATE gallery_tobaccos SET blend='Corrected' WHERE id='test-blend'");
        const put = bucket.put.bind(bucket);
        bucket.put = async (k, bytes) => {
            expect(await publicationSnapshot()).toEqual(before);
            await put(k, bytes);
        };
        expect((await call(`/admin/publications/${draft.submissionId}/refresh`, 'POST', { expectedVersion: published.version }, { 'X-Test-Admin': 'yes' })).status).toBe(200);
    });
});

describe('curated streaming limits and refresh interruptions', () => {
    it('cancels oversized multipart streams before replacement lookup', async () => {
        await approve();
        const before = await publicationSnapshot();
        let chunks = 0;
        let cancelled = false;
        const stream = new ReadableStream<Uint8Array>({
            pull(controller) {
                chunks++;
                controller.enqueue(new Uint8Array(1024 * 1024));
                if (chunks === 32) controller.close();
            },
            cancel() { cancelled = true; },
        });
        const init = { method: 'POST', headers: { Origin: 'https://site.example', 'X-Test-Admin': 'yes', 'Content-Type': 'multipart/form-data; boundary=fixture' }, body: stream, duplex: 'half' };
        const response = await galleryResponse(new Request('https://site.example/api/gallery/v1/admin/reconcile', init), env, deps);
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
        expect(cancelled).toBe(true);
        expect(chunks).toBeLessThan(32);
        expect(await publicationSnapshot()).toEqual(before);
        expect(bucket.objects.size).toBe(3);
    });
    for (const action of ['shutdown', 'unpublish'] as const) {
        it(`does not publish refreshed bytes after ${action} during staging`, async () => {
            const published = await approve();
            const before = await publicationSnapshot();
            db.db.exec("UPDATE gallery_tobaccos SET blend='Corrected' WHERE id='test-blend'");
            const put = bucket.put.bind(bucket);
            let interrupted = false;
            bucket.put = async (k, bytes) => {
                await put(k, bytes);
                if (!interrupted) {
                    interrupted = true;
                    if (action === 'shutdown') db.db.exec('UPDATE gallery_settings SET publication=0');
                    else expect((await call(`/admin/submissions/${draft.submissionId}/unpublish`, 'POST', { expectedVersion: published.version }, { 'X-Test-Admin': 'yes' })).status).toBe(200);
                }
            };
            expect((await call(`/admin/publications/${draft.submissionId}/refresh`, 'POST', { expectedVersion: published.version }, { 'X-Test-Admin': 'yes' })).status).not.toBe(200);
            expect(db.db.prepare('SELECT * FROM gallery_assets WHERE submission_id=? ORDER BY kind').all(draft.submissionId)).toEqual(before.assets);
            if (action === 'shutdown') expect(await publicationSnapshot()).toEqual(before);
            else {
                expect(db.db.prepare('SELECT state FROM gallery_submissions WHERE id=?').get(draft.submissionId)!.state).toBe('unpublished');
                expect((await call(`/labels/${draft.submissionId}/pack`)).status).toBe(404);
            }
        });
    }
});

it('retains migration backup packs while owned and removes their metadata and bytes at content deletion', async () => {
  await approve();
  const previousKey = `gallery/${draft.submissionId}/previous-pack.zip`;
  bucket.objects.set(previousKey, new Uint8Array([1, 2, 3]));
  db.db.prepare('INSERT INTO gallery_label_metadata_backups VALUES(?,?,?,?)').run(draft.submissionId, JSON.stringify({ metadata_json: 'private original metadata' }), JSON.stringify({ r2_key: previousKey }), now.toISOString());
  await cleanGallery(env, now);
  expect(bucket.objects.has(previousKey)).toBe(true);
  db.db.prepare("UPDATE gallery_submissions SET state='unpublished',deletion_due='2026-09-05T00:00:00Z' WHERE id=?").run(draft.submissionId);
  await cleanGallery(env, now);
  expect(bucket.objects.has(previousKey)).toBe(false);
  expect(db.db.prepare('SELECT COUNT(*) AS n FROM gallery_label_metadata_backups').get()!.n).toBe(0);
});

it('counts retained pack storage across refresh and republish without double-counting a live backup', async () => {
  const published = await approve();
  const original = db.db.prepare("SELECT * FROM gallery_assets WHERE submission_id=? AND kind='pack'").get(draft.submissionId)!;
  db.db.prepare('INSERT INTO gallery_label_metadata_backups VALUES(?,?,?,?)').run(draft.submissionId, '{}', JSON.stringify({r2_key:original.r2_key,bytes:original.bytes}), now.toISOString());
  const currentBytes = Number(db.db.prepare('SELECT SUM(bytes) AS n FROM gallery_assets WHERE submission_id=?').get(draft.submissionId)!.n);
  expect(Number(db.db.prepare('SELECT SUM(bytes) AS n FROM gallery_owned_storage WHERE submission_id=?').get(draft.submissionId)!.n)).toBe(currentBytes);
  const refreshed = await call(`/admin/submissions/${draft.submissionId}/refresh`, 'POST', {expectedVersion:published.version}, {'X-Test-Admin':'yes'});
  expect(refreshed.status).toBe(200);
  const refreshedRecord = await refreshed.json();
  const expected = Number(db.db.prepare('SELECT SUM(bytes) AS n FROM gallery_assets WHERE submission_id=?').get(draft.submissionId)!.n) + Number(original.bytes);
  expect(Number(db.db.prepare('SELECT reserved_bytes FROM gallery_submissions WHERE id=?').get(draft.submissionId)!.reserved_bytes)).toBe(expected);
  const unpublished = await (await call(`/admin/submissions/${draft.submissionId}/unpublish`, 'POST', {expectedVersion:refreshedRecord.version}, {'X-Test-Admin':'yes'})).json();
  const republished = await call(`/admin/submissions/${draft.submissionId}/republish`, 'POST', {expectedVersion:unpublished.version}, {'X-Test-Admin':'yes'});
  expect(republished.status).toBe(200);
  expect(Number(db.db.prepare('SELECT reserved_bytes FROM gallery_submissions WHERE id=?').get(draft.submissionId)!.reserved_bytes)).toBe(expected);
});
