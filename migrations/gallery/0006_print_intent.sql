-- Anonymous aggregates only. No raw events, device IDs, network data, or receipts.
CREATE TABLE print_intent_daily (
  catalog_id TEXT NOT NULL REFERENCES gallery_tobaccos(id),
  period_start TEXT NOT NULL,
  added_count INTEGER NOT NULL DEFAULT 0 CHECK(added_count >= 0),
  selected_count INTEGER NOT NULL DEFAULT 0 CHECK(selected_count >= 0),
  quantity_count INTEGER NOT NULL DEFAULT 0 CHECK(quantity_count >= 0),
  print_job_count INTEGER NOT NULL DEFAULT 0 CHECK(print_job_count >= 0),
  PRIMARY KEY(catalog_id, period_start)
);
CREATE INDEX print_intent_period ON print_intent_daily(period_start, catalog_id);
-- Jobs involving several blends count once here, once per blend above.
CREATE TABLE print_intent_job_totals (
  period_start TEXT PRIMARY KEY,
  print_job_count INTEGER NOT NULL CHECK(print_job_count >= 0)
);
-- A singleton counter bounds global admissions without retaining event receipts.
CREATE TABLE print_intent_admission (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  period_start TEXT NOT NULL,
  admissions INTEGER NOT NULL CHECK(admissions >= 0)
);
