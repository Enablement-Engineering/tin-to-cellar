-- Original records remain recoverable after the one-time v2 representation migration.
-- Transformation is deliberately performed by the reviewed migration plan, not SQL JSON surgery.
CREATE TABLE gallery_label_metadata_backups(
 submission_id TEXT PRIMARY KEY REFERENCES gallery_submissions(id) ON DELETE CASCADE,
 row_json TEXT NOT NULL,
 pack_asset_json TEXT,
 migrated_at TEXT NOT NULL
);
CREATE TABLE gallery_label_migration_checks(ok INTEGER NOT NULL CHECK(ok=1));

-- Count each retained object once, even when the backup still points at a live pack.
CREATE VIEW gallery_owned_storage AS
SELECT submission_id,r2_key,MAX(bytes) AS bytes FROM (
 SELECT submission_id,r2_key,bytes FROM gallery_assets
 UNION ALL
 SELECT submission_id,json_extract(pack_asset_json,'$.r2_key') AS r2_key,
 CAST(json_extract(pack_asset_json,'$.bytes') AS INTEGER) AS bytes
 FROM gallery_label_metadata_backups WHERE pack_asset_json IS NOT NULL
) GROUP BY submission_id,r2_key;
