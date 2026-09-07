-- Attempts survive failed uploads and lease expiry; existing submissions start with three remaining attempts.
ALTER TABLE gallery_submissions ADD COLUMN upload_attempts INTEGER NOT NULL DEFAULT 0 CHECK(upload_attempts BETWEEN 0 AND 3);
