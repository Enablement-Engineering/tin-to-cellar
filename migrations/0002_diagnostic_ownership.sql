-- Existing reports deliberately remain unowned; knowing a manifest hash cannot claim them.
ALTER TABLE diagnostic_reports ADD COLUMN capability_hash TEXT;
