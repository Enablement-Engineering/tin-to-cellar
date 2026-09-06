ALTER TABLE gallery_review_events ADD COLUMN before_version INTEGER;
ALTER TABLE gallery_review_events ADD COLUMN before_digest TEXT;
ALTER TABLE gallery_review_events ADD COLUMN request_id TEXT;
ALTER TABLE gallery_review_events ADD COLUMN reason TEXT;
