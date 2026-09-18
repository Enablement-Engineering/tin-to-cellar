-- Optional display-only data. Existing artwork, hashes, and publication decisions stay intact.
ALTER TABLE gallery_assets ADD COLUMN preview_data_url TEXT
  CHECK(preview_data_url IS NULL OR (kind='thumbnail' AND length(preview_data_url)<=1200));
