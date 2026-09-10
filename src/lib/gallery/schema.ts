import { isWriteAreaInsideSurface, isWriteAreaInsideSafeArea } from '../cellarpack/geometry'
import type { LabelSurface, NormalizedWriteAreaGeometry, WriteInArea } from '../cellarpack/types'
import { GALLERY_NOTICE_VERSION, GALLERY_ARTWORK_PROFILE, type GalleryLabelDraft } from './types';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_METADATA_BYTES = 16 * 1024;
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const exact = (o: unknown, keys: string[]): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).sort().join() === keys.sort().join();
const bounded = (s: unknown, n: number, nonempty = false): s is string => typeof s === 'string' && s.length <= n && (!nonempty || s.trim().length > 0) && ![...s].some(c => c.charCodeAt(0) < 32 || c === '<' || c === '>');
export function publicReference(value: unknown): boolean {
    if (!bounded(value, 1500, true))
        return false;
    try {
        const u = new URL(value);
        const decoded = decodeURIComponent(u.pathname);
        return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.search && !u.hash && !/%|@|token|secret|password|session|auth|\.\./i.test(decoded) && !/^(localhost|.*\.local|.*\.internal|\d[\d.]*|\[.*\])$/i.test(u.hostname) && u.hostname.includes('.');
    }
    catch {
        return false;
    }
}
const allowed = (value: unknown, required: string[], optional: string[] = []): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
export function galleryCatalogId(draft: GalleryLabelDraft): string | null { return 'catalogId' in draft.tobacco ? draft.tobacco.catalogId : null }
export function galleryIdentity(draft: GalleryLabelDraft): { maker: string; blend: string } | null { return 'catalogId' in draft.tobacco ? null : draft.tobacco }
export function gallerySurface(): LabelSurface {
    return { shape: 'circle', finishedSize: { width: 2.5, height: 2.5, unit: 'in' }, bleed: { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' }, safeInset: { top: .125, right: .125, bottom: .125, left: .125, unit: 'in' } }
}
export function galleryWriteInArea(draft: GalleryLabelDraft): WriteInArea {
    return { id: 'jarred-date', purpose: 'jarred-date', geometry: { ...draft.writingArea }, background: { integratedInArtwork: true }, overlay: { mode: 'blank' } }
}
export function galleryAltText(draft: GalleryLabelDraft, maker: string, blend: string): string { return draft.altText?.trim() || `${maker} ${blend} jar label` }
export function parseGalleryDraft(value: unknown): GalleryLabelDraft {
    const fail = (): never => { throw new Error('invalid_metadata'); };
    if (!allowed(value, ['version', 'submissionId', 'tobacco', 'artworkProfileId', 'writingArea', 'image', 'acknowledgement'], ['edition', 'altText', 'evidence'])) return fail();
    if (value.version !== 2 || !uuid(value.submissionId) || value.artworkProfileId !== GALLERY_ARTWORK_PROFILE) return fail();
    if ('edition' in value && !bounded(value.edition, 120, true) || 'altText' in value && !bounded(value.altText, 320, true)) return fail();
    const tobacco = value.tobacco;
    if (!(exact(tobacco, ['catalogId']) && bounded(tobacco.catalogId, 200, true) && /^[a-z0-9][a-z0-9-]*$/.test(tobacco.catalogId)) && !(exact(tobacco, ['maker', 'blend']) && bounded(tobacco.maker, 160, true) && bounded(tobacco.blend, 160, true))) return fail();
    if (!exact(value.acknowledgement, ['version', 'accepted']) || (value.acknowledgement.version !== GALLERY_NOTICE_VERSION && value.acknowledgement.version !== '2026-09-06-v1') || value.acknowledgement.accepted !== true) return fail();
    if (!exact(value.image, ['sha256', 'bytes', 'width', 'height']) || typeof value.image.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.image.sha256) || !Number.isInteger(value.image.bytes) || Number(value.image.bytes) < 1 || Number(value.image.bytes) > MAX_IMAGE_BYTES || !Number.isInteger(value.image.width) || Number(value.image.width) < 825 || Number(value.image.width) > 2048 || value.image.height !== value.image.width) return fail();
    const geo = value.writingArea;
    if (!allowed(geo, ['shape', 'x', 'y', 'width', 'height'], ['cornerRadius']) || !['rectangle', 'rounded-rectangle', 'oval'].includes(String(geo.shape)) || ['x', 'y', 'width', 'height'].some(k => typeof geo[k] !== 'number' || !Number.isFinite(geo[k])) || Number(geo.width) <= 0 || Number(geo.height) <= 0 || ('cornerRadius' in geo && (typeof geo.cornerRadius !== 'number' || !Number.isFinite(geo.cornerRadius) || geo.cornerRadius < 0 || geo.cornerRadius > 0.5))) return fail();
    if (!isWriteAreaInsideSurface(geo as unknown as NormalizedWriteAreaGeometry, gallerySurface()) || !isWriteAreaInsideSafeArea(geo as unknown as NormalizedWriteAreaGeometry, gallerySurface())) return fail();
    if ('evidence' in value) {
        const e = value.evidence;
        if (!allowed(e, [], ['references', 'package', 'variant'])) return fail();
        if ('package' in e && !['tin', 'pouch', 'box', 'bulk', 'other', 'unknown'].includes(String(e.package)) || 'variant' in e && !['current', 'historical', 'special', 'unknown'].includes(String(e.variant))) return fail();
        if ('references' in e && (!Array.isArray(e.references) || e.references.length > 3 || e.references.some(r => !exact(r, ['url', 'role']) || !publicReference(r.url) || !['package-appearance', 'variant-identification'].includes(String(r.role))))) return fail();
    }
    return value as unknown as GalleryLabelDraft;
}
export function canonicalJson(value: unknown): string { if (Array.isArray(value))
    return '[' + value.map(canonicalJson).join(',') + ']'; if (value && typeof value === 'object')
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonicalJson(v)).join(',') + '}'; return JSON.stringify(value); }
