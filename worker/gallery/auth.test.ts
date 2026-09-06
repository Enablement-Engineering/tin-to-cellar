// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { verifyGalleryAdmin, verifyGalleryTurnstile } from './auth';
afterEach(() => vi.unstubAllGlobals());
it('validates real signed Access JWT issuer, audience, subject and expiry', async () => {
    const keys = await generateKeyPair('RS256');
    const jwk = await exportJWK(keys.publicKey);
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ keys: [{ ...jwk, kid: 'fixture', use: 'sig', alg: 'RS256' }] })));
    const env = { GALLERY_ACCESS_ISSUER: 'https://gallery-auth-test.cloudflareaccess.com', GALLERY_ACCESS_AUD: 'gallery', GALLERY_ADMIN_SUBJECT: 'dylan-fixture' };
    async function request(issuer = env.GALLERY_ACCESS_ISSUER, aud = env.GALLERY_ACCESS_AUD, subject = env.GALLERY_ADMIN_SUBJECT, expiration = Math.floor(Date.now() / 1000) + 300) { const token = await new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'fixture' }).setIssuer(issuer).setAudience(aud).setSubject(subject).setExpirationTime(expiration).sign(keys.privateKey); return new Request('https://site.example/admin/gallery', { headers: { 'Cf-Access-Jwt-Assertion': token } }); }
    expect(await verifyGalleryAdmin(await request(), env)).toBe('dylan-fixture');
    expect(await verifyGalleryAdmin(await request('https://wrong.cloudflareaccess.com'), env)).toBeNull();
    expect(await verifyGalleryAdmin(await request(undefined, 'wrong'), env)).toBeNull();
    expect(await verifyGalleryAdmin(await request(undefined, undefined, 'other'), env)).toBeNull();
    expect(await verifyGalleryAdmin(await request(undefined, undefined, undefined, 1), env)).toBeNull();
    expect(await verifyGalleryAdmin(new Request('https://site.example'), env)).toBeNull();
});
it('binds Turnstile to hostname, action and freshness', async () => {
    const result = { success: true, hostname: 'site.example', action: 'gallery-submit', challenge_ts: new Date().toISOString() };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(result)));
    const request = new Request('https://site.example/api/gallery/v1/submissions', { headers: { 'X-Turnstile-Token': 'fixture' } });
    expect(await verifyGalleryTurnstile(request, { GALLERY_TURNSTILE_SECRET: 'fixture' })).toBe(true);
    result.action = 'different';
    expect(await verifyGalleryTurnstile(request, { GALLERY_TURNSTILE_SECRET: 'fixture' })).toBe(false);
    result.action = 'gallery-submit';
    result.hostname = 'other.example';
    expect(await verifyGalleryTurnstile(request, { GALLERY_TURNSTILE_SECRET: 'fixture' })).toBe(false);
    result.hostname = 'site.example';
    result.challenge_ts = '2000-01-01T00:00:00Z';
    expect(await verifyGalleryTurnstile(request, { GALLERY_TURNSTILE_SECRET: 'fixture' })).toBe(false);
});

it('separates machine application assertions from human identity and audience',async()=>{
 const {verifyGalleryAgent}=await import('./auth');const keys=await generateKeyPair('RS256');const jwk=await exportJWK(keys.publicKey);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({keys:[{...jwk,kid:'machine-fixture',use:'sig',alg:'RS256'}]})));
 const env={GALLERY_AGENT_ENABLED:'true',GALLERY_ACCESS_ISSUER:'https://machine-auth-test.cloudflareaccess.com',GALLERY_ACCESS_AUD:'human-audience',GALLERY_AGENT_ACCESS_AUD:'machine-audience',GALLERY_ADMIN_SUBJECT:'human-subject'};
 const request=async(options:{aud?:string;sub?:string;type?:string;expires?:number;issuer?:string;client?:string}={})=>{const token=await new SignJWT({type:options.type??'app',common_name:options.client??'fixture.access'}).setProtectedHeader({alg:'RS256',kid:'machine-fixture'}).setIssuer(options.issuer??env.GALLERY_ACCESS_ISSUER).setAudience(options.aud??'machine-audience').setSubject(options.sub??'').setExpirationTime(options.expires??Math.floor(Date.now()/1000)+300).sign(keys.privateKey);return new Request('https://admin.tintocellar.com/api/gallery/v1/agent/submissions',{headers:{'Cf-Access-Jwt-Assertion':token}})};
 expect(await verifyGalleryAgent(await request(),env)).toBe('fixture.access');
 for(const options of [{aud:'human-audience'},{sub:'human-subject'},{type:'org'},{expires:1},{issuer:'https://wrong.cloudflareaccess.com'}])expect(await verifyGalleryAgent(await request(options),env)).toBeNull();
 expect(await verifyGalleryAgent(new Request('https://admin.tintocellar.com',{headers:{'CF-Access-Client-Id':'fixture.access','CF-Access-Client-Secret':'raw-secret'}}),env)).toBeNull();
 expect(await verifyGalleryAgent(await request(),{...env,GALLERY_AGENT_ENABLED:'false'})).toBeNull();
 expect(await verifyGalleryAgent(await request({aud:'human-audience'}),{...env,GALLERY_AGENT_ACCESS_AUD:'human-audience'})).toBeNull();
 expect(await verifyGalleryAdmin(await request(),env)).toBeNull();
});
