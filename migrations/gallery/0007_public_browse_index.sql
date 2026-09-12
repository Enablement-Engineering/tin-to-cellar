-- The unfiltered cursor query otherwise uses state/expiry then a temporary sort.
-- Keep the separate state/catalog/id index for exact catalog lookups.
CREATE INDEX gallery_public_browse ON gallery_submissions(state,id);
