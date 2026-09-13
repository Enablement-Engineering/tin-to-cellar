-- Trusted owner CLI publications are reviewed before insertion and do not use
-- the public intake rate budget. Keep the shared storage and pending-work caps.
-- Public routes insert reserved rows; only a direct, fully formed owner publish
-- row can satisfy every condition of this exemption.
DROP TRIGGER gallery_admit;
CREATE TRIGGER gallery_admit BEFORE INSERT ON gallery_submissions BEGIN
 SELECT RAISE(ABORT,'gallery_capacity') WHERE (SELECT COALESCE(SUM(reserved_bytes),0) FROM gallery_submissions)>8589934592-41943040;
 SELECT RAISE(ABORT,'gallery_capacity') WHERE (SELECT COUNT(*) FROM gallery_submissions WHERE state IN('reserved','uploading','pending','preparing-publication'))>=500;
 SELECT RAISE(ABORT,'gallery_capacity') WHERE (SELECT COALESCE(SUM(input_bytes),0) FROM gallery_submissions WHERE state IN('reserved','uploading','pending','preparing-publication'))>1073741824-NEW.input_bytes;
 SELECT RAISE(ABORT,'gallery_capacity') WHERE NOT (NEW.state='published' AND NEW.reviewer='owner-authorized-cli' AND NEW.publication_id=NEW.id AND NEW.approval_digest=NEW.digest AND NEW.quota_key LIKE 'owner-pilot:%') AND COALESCE((SELECT admissions FROM gallery_admission WHERE bucket=NEW.quota_key),0)>=20;
 SELECT RAISE(ABORT,'gallery_capacity') WHERE NOT (NEW.state='published' AND NEW.reviewer='owner-authorized-cli' AND NEW.publication_id=NEW.id AND NEW.approval_digest=NEW.digest AND NEW.quota_key LIKE 'owner-pilot:%') AND COALESCE((SELECT admissions FROM gallery_admission WHERE bucket='site:'||substr(NEW.created_at,1,10)),0)>=100;
 INSERT INTO gallery_admission SELECT NEW.quota_key,1,datetime(NEW.created_at,'+2 days') WHERE NOT (NEW.state='published' AND NEW.reviewer='owner-authorized-cli' AND NEW.publication_id=NEW.id AND NEW.approval_digest=NEW.digest AND NEW.quota_key LIKE 'owner-pilot:%') ON CONFLICT(bucket) DO UPDATE SET admissions=admissions+1;
 INSERT INTO gallery_admission SELECT 'site:'||substr(NEW.created_at,1,10),1,datetime(NEW.created_at,'+2 days') WHERE NOT (NEW.state='published' AND NEW.reviewer='owner-authorized-cli' AND NEW.publication_id=NEW.id AND NEW.approval_digest=NEW.digest AND NEW.quota_key LIKE 'owner-pilot:%') ON CONFLICT(bucket) DO UPDATE SET admissions=admissions+1;
END;
