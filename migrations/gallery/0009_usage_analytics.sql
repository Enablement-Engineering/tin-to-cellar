-- Aggregates only. The per-request matching record never leaves the browser.
CREATE TABLE usage_event_daily (
  period_start TEXT NOT NULL, event TEXT NOT NULL, outcome TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  PRIMARY KEY(period_start,event,outcome)
);
CREATE TABLE usage_progress (
  cohort TEXT NOT NULL, milestone TEXT NOT NULL, elapsed TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  PRIMARY KEY(cohort,milestone,elapsed)
);
CREATE TABLE usage_collection_daily (
  period_start TEXT PRIMARY KEY, admitted INTEGER NOT NULL DEFAULT 0,
  recorded INTEGER NOT NULL DEFAULT 0, allowance INTEGER NOT NULL,
  allowance_reached INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE print_intent_admission ADD COLUMN allowance INTEGER NOT NULL DEFAULT 1000;
-- These triggers run in the reservation statement's transaction, including when
-- subsequent catalog validation or counter writes fail. Rollover preserves history.
CREATE TRIGGER usage_admission_insert AFTER INSERT ON print_intent_admission BEGIN
  INSERT INTO usage_collection_daily(period_start,admitted,allowance,allowance_reached)
    VALUES(NEW.period_start,NEW.admissions,NEW.allowance,NEW.admissions>=NEW.allowance)
    ON CONFLICT(period_start) DO UPDATE SET admitted=excluded.admitted,allowance=excluded.allowance,
      allowance_reached=MAX(usage_collection_daily.allowance_reached,excluded.allowance_reached);
END;
CREATE TRIGGER usage_admission_update AFTER UPDATE ON print_intent_admission BEGIN
  INSERT INTO usage_collection_daily(period_start,admitted,allowance,allowance_reached)
    VALUES(NEW.period_start,NEW.admissions,NEW.allowance,NEW.admissions>=NEW.allowance)
    ON CONFLICT(period_start) DO UPDATE SET admitted=excluded.admitted,allowance=excluded.allowance,
      allowance_reached=MAX(usage_collection_daily.allowance_reached,excluded.allowance_reached);
END;
CREATE TABLE usage_cleanup (
  id INTEGER PRIMARY KEY CHECK(id=1), last_attempt TEXT, last_success TEXT, failed INTEGER NOT NULL DEFAULT 0
);
