CREATE TABLE IF NOT EXISTS diagnostic_reports (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  origin TEXT NOT NULL CHECK(origin IN ('pack','standalone','legacy')),
  feedback TEXT,
  validation TEXT
);
CREATE INDEX IF NOT EXISTS diagnostic_reports_receipt ON diagnostic_reports(received_at, id);
CREATE INDEX IF NOT EXISTS diagnostic_reports_expiry ON diagnostic_reports(expires_at);
CREATE TABLE IF NOT EXISTS diagnostic_notes (
  report_id TEXT PRIMARY KEY REFERENCES diagnostic_reports(id) ON DELETE CASCADE,
  received_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS diagnostic_notes_expiry ON diagnostic_notes(expires_at);
