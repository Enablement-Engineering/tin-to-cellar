import { isWriteAreaInsideSurface, isWriteAreaInsideSafeArea } from '../cellarpack/geometry'
import type { LabelSurface, NormalizedWriteAreaGeometry } from '../cellarpack/types'
import { GALLERY_NOTICE_VERSION, type GalleryLabelDraftV1 } from './types';
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
export function parseGalleryDraft(value: unknown): GalleryLabelDraftV1 {
    const fail = (): never => { throw new Error('invalid_metadata'); };
    if (!exact(value, ['version', 'submissionId', 'catalogId', 'proposedIdentity', 'package', 'variant', 'edition', 'description', 'surface', 'writeInArea', 'references', 'image', 'acknowledgement']))
        return fail();
    if (value.version !== 1 || !uuid(value.submissionId) || !bounded(value.edition, 120) || !bounded(value.description, 320, true))
        return fail();
    if (value.catalogId !== null && (!bounded(value.catalogId, 200, true) || !/^[a-z0-9][a-z0-9-]*$/.test(value.catalogId)))
        return fail();
    if (value.catalogId === null ? !exact(value.proposedIdentity, ['maker', 'blend']) || !bounded(value.proposedIdentity.maker, 160, true) || !bounded(value.proposedIdentity.blend, 160, true) : value.proposedIdentity !== null)
        return fail();
    if (!['tin', 'pouch', 'box', 'bulk', 'other', 'unknown'].includes(String(value.package)) || !['current', 'historical', 'special', 'unknown'].includes(String(value.variant)))
        return fail();
    if (!exact(value.acknowledgement, ['version', 'accepted']) || (value.acknowledgement.version !== GALLERY_NOTICE_VERSION && value.acknowledgement.version !== '2026-09-06-v1') || value.acknowledgement.accepted !== true)
        return fail();
    if (!exact(value.image, ['sha256', 'bytes', 'width', 'height']) || typeof value.image.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.image.sha256) || !Number.isInteger(value.image.bytes) || Number(value.image.bytes) < 1 || Number(value.image.bytes) > MAX_IMAGE_BYTES || !Number.isInteger(value.image.width) || Number(value.image.width) < 825 || Number(value.image.width) > 2048 || value.image.height !== value.image.width)
        return fail();
    const s = value.surface;
    if (!exact(s, ['shape', 'finishedSize', 'bleed', 'safeInset']) || s.shape !== 'circle' || !exact(s.finishedSize, ['width', 'height', 'unit']) || s.finishedSize.width !== 2.5 || s.finishedSize.height !== 2.5 || s.finishedSize.unit !== 'in')
        return fail();
    for (const inset of [s.bleed, s.safeInset])
        if (!exact(inset, ['top', 'right', 'bottom', 'left', 'unit']) || inset.unit !== 'in' || ['top', 'right', 'bottom', 'left'].some(k => inset[k] !== 0.125))
            return fail();
    const w = value.writeInArea;
    if (!exact(w, ['id', 'purpose', 'geometry', 'background', 'overlay']) || !bounded(w.id, 80, true) || w.purpose !== 'jarred-date' || !exact(w.background, ['integratedInArtwork']) || w.background.integratedInArtwork !== true || !exact(w.overlay, ['mode']) || w.overlay.mode !== 'blank')
        return fail();
    const g = w.geometry;
    if (!g || typeof g !== 'object' || Array.isArray(g))
        return fail();
    const geo = g as Record<string, unknown>;
    if (!exact(geo, ['shape', 'x', 'y', 'width', 'height', ...('cornerRadius' in geo ? ['cornerRadius'] : []), ...('rotationDegrees' in geo ? ['rotationDegrees'] : [])]))
        return fail();
    if (!['rectangle', 'rounded-rectangle', 'oval'].includes(String(geo.shape)) || ['x', 'y', 'width', 'height'].some(k => typeof geo[k] !== 'number' || !Number.isFinite(geo[k])) || Number(geo.width) <= 0 || Number(geo.height) <= 0 || ('rotationDegrees' in geo && geo.rotationDegrees !== 0) || ('cornerRadius' in geo && (typeof geo.cornerRadius !== 'number' || !Number.isFinite(geo.cornerRadius) || geo.cornerRadius < 0 || geo.cornerRadius > 0.5)))
        return fail();
    // CellarPack geometry is normalized to the finished trim box, not the bleed canvas.
    // Reuse its shape-aware perimeter checks so valid ovals retain their original geometry.
    if (!isWriteAreaInsideSurface(geo as unknown as NormalizedWriteAreaGeometry, s as unknown as LabelSurface) ||
        !isWriteAreaInsideSafeArea(geo as unknown as NormalizedWriteAreaGeometry, s as unknown as LabelSurface))
        return fail();
    if (!Array.isArray(value.references) || value.references.length > 3 || value.references.some(r => !exact(r, ['url', 'role']) || !publicReference(r.url) || !['package-appearance', 'variant-identification'].includes(String(r.role))))
        return fail();
    return value as unknown as GalleryLabelDraftV1;
}
export function canonicalJson(value: unknown): string { if (Array.isArray(value))
    return '[' + value.map(canonicalJson).join(',') + ']'; if (value && typeof value === 'object')
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonicalJson(v)).join(',') + '}'; return JSON.stringify(value); }
