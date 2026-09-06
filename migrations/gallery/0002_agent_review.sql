-- Use conditional SELECT RAISE guards: avoid nested CASE END in D1 remote migration splitting.
CREATE TABLE gallery_agent_grants (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL UNIQUE, label TEXT NOT NULL, scopes_json TEXT NOT NULL,
 selection TEXT NOT NULL CHECK(selection IN('selected','all-pending')), created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL, revoked_at TEXT, creator TEXT NOT NULL, row_version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE gallery_agent_assignments(grant_id TEXT NOT NULL REFERENCES gallery_agent_grants(id),submission_id TEXT NOT NULL REFERENCES gallery_submissions(id),PRIMARY KEY(grant_id,submission_id));
CREATE TABLE gallery_agent_recommendations(
 id TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES gallery_agent_grants(id),submission_id TEXT NOT NULL REFERENCES gallery_submissions(id),
 row_version INTEGER NOT NULL,digest TEXT NOT NULL,body_json TEXT NOT NULL,body_hash TEXT NOT NULL,idempotency_key TEXT NOT NULL,
 actor_label TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(grant_id,idempotency_key)
);
CREATE INDEX gallery_recommendation_submission ON gallery_agent_recommendations(submission_id,created_at,id);
CREATE INDEX gallery_review_queue ON gallery_submissions(state,created_at,id);
CREATE INDEX gallery_review_history ON gallery_review_events(submission_id,created_at,id);
CREATE TABLE gallery_agent_quota(bucket TEXT PRIMARY KEY,used INTEGER NOT NULL,cap INTEGER NOT NULL,expires_at TEXT NOT NULL);
CREATE TRIGGER gallery_agent_quota_insert BEFORE INSERT ON gallery_agent_quota WHEN NEW.used>NEW.cap BEGIN SELECT RAISE(ABORT,'agent_limit'); END;
CREATE TRIGGER gallery_agent_quota_update BEFORE UPDATE ON gallery_agent_quota WHEN NEW.used>NEW.cap BEGIN SELECT RAISE(ABORT,'agent_limit'); END;
CREATE TABLE gallery_agent_activity(
 id TEXT PRIMARY KEY,grant_id TEXT,submission_id TEXT,action TEXT NOT NULL,result TEXT NOT NULL,
 row_version INTEGER,digest TEXT,created_at TEXT NOT NULL,last_at TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 1,expires_at TEXT NOT NULL
);
CREATE INDEX gallery_agent_activity_submission ON gallery_agent_activity(submission_id,created_at,id);
CREATE TABLE gallery_agent_grant_events(id TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES gallery_agent_grants(id),actor TEXT NOT NULL,action TEXT NOT NULL,row_version INTEGER NOT NULL,created_at TEXT NOT NULL);
ALTER TABLE gallery_maintenance ADD COLUMN last_cleanup_at TEXT;
ALTER TABLE gallery_maintenance ADD COLUMN last_cleanup_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gallery_maintenance ADD COLUMN last_success_at TEXT;
-- Repeat authorization inside the write transaction to defeat revocation and review races.
CREATE TRIGGER gallery_recommendation_guard BEFORE INSERT ON gallery_agent_recommendations BEGIN
 SELECT RAISE(ABORT,'agent_review_changed') WHERE NOT EXISTS(
  SELECT 1 FROM gallery_agent_grants g JOIN gallery_submissions s ON s.id=NEW.submission_id
  WHERE g.id=NEW.grant_id AND g.revoked_at IS NULL AND g.expires_at>NEW.created_at
   AND EXISTS(SELECT 1 FROM json_each(g.scopes_json) WHERE value='recommendation:write')
   AND (g.selection='all-pending' OR EXISTS(SELECT 1 FROM gallery_agent_assignments WHERE grant_id=g.id AND submission_id=s.id))
   AND s.state='pending' AND s.expires_at>NEW.created_at AND s.row_version=NEW.row_version AND s.digest=NEW.digest
 );
 SELECT RAISE(ABORT,'agent_limit') WHERE (SELECT COUNT(*) FROM gallery_agent_recommendations WHERE grant_id=NEW.grant_id AND submission_id=NEW.submission_id AND row_version=NEW.row_version)>=10;
END;
CREATE TRIGGER gallery_grant_limit BEFORE INSERT ON gallery_agent_grants BEGIN
 SELECT RAISE(ABORT,'agent_limit') WHERE (SELECT COUNT(*) FROM gallery_agent_grants WHERE revoked_at IS NULL AND expires_at>NEW.created_at)>=100;
END;
