-- Use conditional SELECT RAISE guards: avoid nested CASE END in D1 remote migration splitting.
PRAGMA foreign_keys=ON;
CREATE TABLE gallery_tobaccos(id TEXT PRIMARY KEY,maker TEXT NOT NULL,blend TEXT NOT NULL,aliases_json TEXT NOT NULL DEFAULT '[]',active INTEGER NOT NULL DEFAULT 1,catalog_revision TEXT NOT NULL);
CREATE TABLE gallery_catalog_aliases(alias_id TEXT PRIMARY KEY,catalog_id TEXT NOT NULL REFERENCES gallery_tobaccos(id));
CREATE TABLE gallery_settings(id INTEGER PRIMARY KEY CHECK(id=1),intake INTEGER NOT NULL DEFAULT 0,publication INTEGER NOT NULL DEFAULT 0,serving INTEGER NOT NULL DEFAULT 0);
INSERT INTO gallery_settings(id) VALUES(1);
CREATE TABLE gallery_submissions(
id TEXT PRIMARY KEY,capability_hash TEXT NOT NULL,request_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN('reserved','uploading','pending','preparing-publication','published','unpublished','rejected','withdrawn','expired','deleting','deleted')),row_version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,lease_until TEXT,metadata_json TEXT,metadata_hash TEXT,artwork_hash TEXT,digest TEXT,catalog_id TEXT REFERENCES gallery_tobaccos(id),reserved_bytes INTEGER NOT NULL DEFAULT 41943040,input_bytes INTEGER NOT NULL,quota_key TEXT NOT NULL,deletion_due TEXT,receipt_until TEXT,reason TEXT,reviewer TEXT,published_at TEXT,publication_id TEXT,approval_digest TEXT,published_maker TEXT,published_blend TEXT,dedupe_hash TEXT);
CREATE INDEX gallery_state_expiry ON gallery_submissions(state,expires_at);
CREATE INDEX gallery_public_filter ON gallery_submissions(state,catalog_id,id);
CREATE UNIQUE INDEX gallery_published_duplicate ON gallery_submissions(dedupe_hash) WHERE state='published';
CREATE INDEX gallery_dedupe ON gallery_submissions(artwork_hash,catalog_id,state);
CREATE INDEX gallery_deletion ON gallery_submissions(deletion_due);
CREATE TABLE gallery_assets(id TEXT PRIMARY KEY,submission_id TEXT NOT NULL REFERENCES gallery_submissions(id),kind TEXT NOT NULL CHECK(kind IN('artwork','thumbnail','pack')),r2_key TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,UNIQUE(submission_id,kind));
CREATE TABLE gallery_admission(bucket TEXT PRIMARY KEY,admissions INTEGER NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE gallery_review_events(id TEXT PRIMARY KEY,submission_id TEXT NOT NULL REFERENCES gallery_submissions(id),actor TEXT NOT NULL,action TEXT NOT NULL,row_version INTEGER NOT NULL,digest TEXT,created_at TEXT NOT NULL);
CREATE TABLE gallery_maintenance(id INTEGER PRIMARY KEY CHECK(id=1),orphan_cursor TEXT);
INSERT INTO gallery_maintenance(id) VALUES(1);
-- Trigger execution is part of the insertion transaction: every cap and both counters
-- commit atomically with the reservation, even across concurrent Worker instances.
CREATE TRIGGER gallery_admit BEFORE INSERT ON gallery_submissions BEGIN
 SELECT RAISE(ABORT,'gallery_capacity') WHERE (SELECT COALESCE(SUM(reserved_bytes),0) FROM gallery_submissions)>8589934592-41943040;
 SELECT RAISE(ABORT,'gallery_capacity') WHERE (SELECT COUNT(*) FROM gallery_submissions WHERE state IN('reserved','uploading','pending','preparing-publication'))>=500;
 SELECT RAISE(ABORT,'gallery_capacity') WHERE (SELECT COALESCE(SUM(input_bytes),0) FROM gallery_submissions WHERE state IN('reserved','uploading','pending','preparing-publication'))>1073741824-NEW.input_bytes;
 SELECT RAISE(ABORT,'gallery_capacity') WHERE COALESCE((SELECT admissions FROM gallery_admission WHERE bucket=NEW.quota_key),0)>=20;
 SELECT RAISE(ABORT,'gallery_capacity') WHERE COALESCE((SELECT admissions FROM gallery_admission WHERE bucket='site:'||substr(NEW.created_at,1,10)),0)>=100;
 INSERT INTO gallery_admission VALUES(NEW.quota_key,1,datetime(NEW.created_at,'+2 days')) ON CONFLICT(bucket) DO UPDATE SET admissions=admissions+1;
 INSERT INTO gallery_admission VALUES('site:'||substr(NEW.created_at,1,10),1,datetime(NEW.created_at,'+2 days')) ON CONFLICT(bucket) DO UPDATE SET admissions=admissions+1;
END;
-- Daily hashes live only in the expiring admission counters, never long-lived submissions.
CREATE TRIGGER gallery_clear_quota AFTER INSERT ON gallery_submissions BEGIN
 UPDATE gallery_submissions SET quota_key='' WHERE id=NEW.id;
END;
