import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { GalleryEnv } from './storage';
const keysets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function verifyGalleryAdmin(request: Request, env: GalleryEnv): Promise<string | null> {
    if (!env.GALLERY_ACCESS_ISSUER || !env.GALLERY_ACCESS_AUD || !env.GALLERY_ADMIN_SUBJECT)
        return null;
    try {
        const issuer = new URL(env.GALLERY_ACCESS_ISSUER);
        if (issuer.protocol !== 'https:' || !issuer.hostname.endsWith('.cloudflareaccess.com') || issuer.pathname !== '/')
            return null;
        const token = request.headers.get('Cf-Access-Jwt-Assertion');
        if (!token)
            return null;
        let keys = keysets.get(issuer.origin);
        if (!keys) {
            keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
            keysets.set(issuer.origin, keys);
        }
        const { payload } = await jwtVerify(token, keys, { issuer: issuer.origin, audience: env.GALLERY_ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp', 'sub'] });
        return payload.sub === env.GALLERY_ADMIN_SUBJECT ? payload.sub : null;
    }
    catch {
        return null;
    }
}
export async function verifyGalleryTurnstile(request: Request, env: GalleryEnv): Promise<boolean> {
    if (!env.GALLERY_TURNSTILE_SECRET)
        return false;
    const token = request.headers.get('X-Turnstile-Token');
    if (!token || token.length > 2048)
        return false;
    try {
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: new URLSearchParams({ secret: env.GALLERY_TURNSTILE_SECRET, response: token }), signal: AbortSignal.timeout(10000) });
        const v = await r.json() as {
            success?: boolean;
            hostname?: string;
            action?: string;
            challenge_ts?: string;
        };
        const age = Date.now() - Date.parse(v.challenge_ts ?? '');
        return v.success === true && v.hostname === new URL(request.url).hostname && v.action === 'gallery-submit' && age >= -30000 && age < 300000;
    }
    catch {
        return false;
    }
}

/** Machine assertions are separate from the human subject/audience boundary. */
export async function verifyGalleryAgent(request: Request, env: GalleryEnv): Promise<string | null> {
    if(env.GALLERY_AGENT_ENABLED!=='true'||!env.GALLERY_ACCESS_ISSUER||!env.GALLERY_AGENT_ACCESS_AUD||env.GALLERY_AGENT_ACCESS_AUD===env.GALLERY_ACCESS_AUD)return null;
    try {
        const issuer=new URL(env.GALLERY_ACCESS_ISSUER);
        if(issuer.protocol!=='https:'||!issuer.hostname.endsWith('.cloudflareaccess.com')||issuer.pathname!=='/')return null;
        const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token)return null;
        let keys=keysets.get(issuer.origin);if(!keys){keys=createRemoteJWKSet(new URL('/cdn-cgi/access/certs',issuer));keysets.set(issuer.origin,keys)}
        const {payload}=await jwtVerify(token,keys,{issuer:issuer.origin,audience:env.GALLERY_AGENT_ACCESS_AUD,algorithms:['RS256'],requiredClaims:['exp','sub','type','common_name']});
        return payload.type==='app'&&payload.sub===''&&typeof payload.common_name==='string'&&/^[A-Za-z0-9._-]{1,200}$/.test(payload.common_name)?payload.common_name:null;
    }catch{return null}
}
