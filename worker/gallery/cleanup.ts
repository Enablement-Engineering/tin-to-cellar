import { addDays, database, labelMetadataReady, type GalleryEnv } from './storage';
export async function cleanGallery(env: GalleryEnv, now = new Date()) {
    if (!env.GALLERY || !env.GALLERY_ART)
        return { deleted: 0, failures: 0, orphans: 0 };
    if (!await labelMetadataReady(env)) return { deleted: 0, failures: 0, orphans: 0 };
    const db = database(env);
    let deleted = 0, failures = 0, orphans = 0;
    // Recommendation text is private review content: expire it even if R2 deletion retries.
    await db.prepare("DELETE FROM gallery_agent_recommendations WHERE submission_id IN(SELECT id FROM gallery_submissions WHERE (deletion_due IS NOT NULL AND deletion_due<=?) OR(state NOT IN('published','withdrawn','rejected') AND expires_at<=?))").bind(now.toISOString(),now.toISOString()).run();

    await db.prepare("UPDATE gallery_submissions SET state='pending',lease_until=NULL,row_version=row_version+1 WHERE state='preparing-publication' AND lease_until<=?").bind(now.toISOString()).run();
    await db.prepare("UPDATE gallery_submissions SET state='reserved',lease_until=NULL,row_version=row_version+1 WHERE state='uploading' AND lease_until<=?").bind(now.toISOString()).run();
    await db.prepare("UPDATE gallery_submissions SET state='expired',deletion_due=?,receipt_until=?,row_version=row_version+1 WHERE state IN('reserved','pending','unpublished') AND expires_at<=?").bind(now.toISOString(), addDays(now, 90), now.toISOString()).run();
    const rows = (await db.prepare("SELECT id FROM gallery_submissions WHERE deletion_due<=? AND state IN('expired','rejected','withdrawn','unpublished','deleting') ORDER BY deletion_due LIMIT 50").bind(now.toISOString()).all<{
        id: string;
    }>()).results;
    for (const row of rows) {
        try {
            const claimed = await db.prepare("UPDATE gallery_submissions SET state='deleting',row_version=row_version+1 WHERE id=? AND deletion_due<=? AND state IN('expired','rejected','withdrawn','unpublished','deleting')").bind(row.id, now.toISOString()).run();
            if (!claimed.meta.changes)
                continue;
            const assets = (await db.prepare("SELECT r2_key FROM gallery_assets WHERE submission_id=? UNION SELECT json_extract(pack_asset_json, '$.r2_key') AS r2_key FROM gallery_label_metadata_backups WHERE submission_id=? AND pack_asset_json IS NOT NULL").bind(row.id, row.id).all<{
                r2_key: string;
            }>()).results;
            for (const a of assets) {
                await env.GALLERY_ART.delete(a.r2_key);
                if (await env.GALLERY_ART.head(a.r2_key))
                    throw new Error('delete_failed');
            }
            await db.batch([db.prepare('DELETE FROM gallery_label_metadata_backups WHERE submission_id=?').bind(row.id),db.prepare('DELETE FROM gallery_assets WHERE submission_id=?').bind(row.id), db.prepare("UPDATE gallery_submissions SET state='deleted',metadata_json=NULL,metadata_hash=NULL,artwork_hash=NULL,digest=NULL,catalog_id=NULL,reserved_bytes=0,input_bytes=0,quota_key='',deletion_due=NULL,receipt_until=COALESCE(receipt_until,?),reviewer=NULL,approval_digest=NULL,published_maker=NULL,published_blend=NULL WHERE id=? AND state='deleting'").bind(addDays(now, 90), row.id),db.prepare("INSERT INTO gallery_review_events(id,submission_id,actor,action,row_version,digest,created_at) SELECT ?,id,'system','deleted',row_version,digest,? FROM gallery_submissions WHERE id=? AND changes()=1").bind(crypto.randomUUID(),now.toISOString(),row.id)]);
            deleted++;
        }
        catch {
            failures++;
        }
    }
    await db.batch([db.prepare("DELETE FROM gallery_agent_assignments WHERE submission_id IN(SELECT id FROM gallery_submissions WHERE state='deleted' AND receipt_until<=?)").bind(now.toISOString()),db.prepare("DELETE FROM gallery_review_events WHERE submission_id IN(SELECT id FROM gallery_submissions WHERE state='deleted' AND receipt_until<=?)").bind(now.toISOString()), db.prepare("DELETE FROM gallery_submissions WHERE state='deleted' AND receipt_until<=?").bind(now.toISOString()), db.prepare('DELETE FROM gallery_admission WHERE expires_at<=?').bind(now.toISOString())]);
    // One bounded listing per tick; the persisted cursor advances only after processing.
    const cursor = (await db.prepare('SELECT orphan_cursor FROM gallery_maintenance WHERE id=1').first<{
        orphan_cursor: string | null;
    }>())?.orphan_cursor ?? undefined;
    const page = await env.GALLERY_ART.list({ prefix: 'gallery/', cursor, limit: 100 });
    for (const obj of page.objects) {
        if (obj.uploaded.getTime() > now.getTime() - 86400000)
            continue;
        try {
            const owned = await db.prepare("SELECT id FROM gallery_assets WHERE r2_key=? UNION SELECT submission_id AS id FROM gallery_label_metadata_backups WHERE json_extract(pack_asset_json, '$.r2_key')=?").bind(obj.key,obj.key).first();
            if (owned)
                continue;
            const id = obj.key.split('/')[1];
            const lease = await db.prepare('SELECT lease_until FROM gallery_submissions WHERE id=?').bind(id).first<{
                lease_until: string | null;
            }>();
            if (lease?.lease_until && lease.lease_until > now.toISOString())
                continue;
            await env.GALLERY_ART.delete(obj.key);
            if (await env.GALLERY_ART.head(obj.key))
                throw new Error('delete_failed');
            orphans++;
        }
        catch {
            failures++;
        }
    }
    if (!failures)
        await db.prepare('UPDATE gallery_maintenance SET orphan_cursor=? WHERE id=1').bind(page.truncated ? page.cursor ?? null : null).run();
    await db.batch([
        db.prepare("DELETE FROM gallery_agent_assignments WHERE grant_id IN(SELECT id FROM gallery_agent_grants WHERE COALESCE(revoked_at,expires_at)<=? AND NOT EXISTS(SELECT 1 FROM gallery_agent_recommendations WHERE grant_id=gallery_agent_grants.id))").bind(addDays(now,-90)),
        db.prepare("DELETE FROM gallery_agent_grant_events WHERE grant_id IN(SELECT id FROM gallery_agent_grants WHERE COALESCE(revoked_at,expires_at)<=? AND NOT EXISTS(SELECT 1 FROM gallery_agent_recommendations WHERE grant_id=gallery_agent_grants.id))").bind(addDays(now,-90)),
        db.prepare("DELETE FROM gallery_agent_grants WHERE COALESCE(revoked_at,expires_at)<=? AND NOT EXISTS(SELECT 1 FROM gallery_agent_recommendations WHERE grant_id=gallery_agent_grants.id)").bind(addDays(now,-90)),
        db.prepare('DELETE FROM gallery_agent_quota WHERE expires_at<=?').bind(now.toISOString()),
        db.prepare('DELETE FROM gallery_agent_activity WHERE expires_at<=?').bind(now.toISOString()),
        db.prepare('UPDATE gallery_maintenance SET last_cleanup_at=?,last_cleanup_failures=?,last_success_at=CASE WHEN ?=0 THEN ? ELSE last_success_at END WHERE id=1').bind(now.toISOString(),failures,failures,now.toISOString()),
    ]);
    return { deleted, failures, orphans };
}
