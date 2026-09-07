import type { Statement } from '../diagnostics';
export interface GalleryDatabase {
    prepare(sql: string): Statement;
    batch(statements: Statement[]): Promise<unknown[]>;
    withSession?(constraint: string): GalleryDatabase;
}
export interface GalleryBucket {
    put(key: string, value: Uint8Array, options?: unknown): Promise<unknown>;
    get(key: string): Promise<{
        arrayBuffer(): Promise<ArrayBuffer>;
    } | null>;
    head(key: string): Promise<unknown | null>;
    delete(key: string): Promise<void>;
    list(options?: {
        prefix?: string;
        cursor?: string;
        limit?: number;
    }): Promise<{
        objects: {
            key: string;
            uploaded: Date;
        }[];
        truncated: boolean;
        cursor?: string;
    }>;
}
export interface GalleryRateLimiter {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}
export interface GalleryEnv {
    GALLERY_READ_RATE_LIMITER?: GalleryRateLimiter;
    GALLERY_UPLOAD_RATE_LIMITER?: GalleryRateLimiter;
    GALLERY_MUTATION_RATE_LIMITER?: GalleryRateLimiter;
    GALLERY_AGENT_ACCESS_AUD?: string;
    GALLERY_AGENT_ENABLED?: string;
    GALLERY?: GalleryDatabase;
    GALLERY_ART?: GalleryBucket;
    GALLERY_INTAKE?: string;
    GALLERY_SERVING?: string;
    GALLERY_PUBLICATION?: string;
    GALLERY_IP_SALT?: string;
    GALLERY_TURNSTILE_SECRET?: string;
    GALLERY_TURNSTILE_SITE_KEY?: string;
    GALLERY_ACCESS_ISSUER?: string;
    GALLERY_ACCESS_AUD?: string;
    GALLERY_ADMIN_SUBJECT?: string;
    GALLERY_RATE_LIMITER?: {
        limit(options: {
            key: string;
        }): Promise<{
            success: boolean;
        }>;
    };
}
export function database(env: GalleryEnv): GalleryDatabase { if (!env.GALLERY)
    throw new Error('storage_unavailable'); return env.GALLERY.withSession?.('first-primary') ?? env.GALLERY; }
export async function sha256(bytes: Uint8Array | string): Promise<string> { const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes; return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource))].map(b => b.toString(16).padStart(2, '0')).join(''); }
export async function boundedBody(request: Request, max: number): Promise<Uint8Array> {
    const declared = request.headers.get('Content-Length');
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > max)) {
        await request.body?.cancel();
        throw new Error('limit_exceeded');
    }
    const reader = request.body?.getReader();
    if (!reader)
        return new Uint8Array();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { void reader.cancel(); reject(new Error('limit_exceeded')); }, 10000); });
    try {
        return await Promise.race([timeout, (async () => { const chunks: Uint8Array[] = []; let size = 0; for (;;) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                size += value.byteLength;
                if (size > max) {
                    await reader.cancel();
                    throw new Error('limit_exceeded');
                }
                chunks.push(value);
            } const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) {
                output.set(chunk, offset);
                offset += chunk.length;
            } return output; })()]);
    }
    finally {
        clearTimeout(timer);
    }
}
export const addDays = (now: Date, days: number) => new Date(now.getTime() + days * 86400000).toISOString();
export const responseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
