# Gallery image previews

Gallery responses include an optional 12 × 12 PNG data URL, at most 1,200 characters per label. New uploads generate it from decoded thumbnail pixels. Listings read it from D1 alongside public metadata, without R2 reads or another browser request. Artwork and printable packs are unchanged.

Cards crossfade to the decoded thumbnail over 200 milliseconds. The artwork dialog uses the existing thumbnail until its original image decodes. Reduced motion disables transitions. Missing previews use the neutral background, and failed image loads show “Image unavailable”.

Deploy through the current main release workflow, which applies `0010_image_previews.sql` before the Worker. Existing publications remain usable before the optional backfill.

To prepare previews for existing public artwork, run:

```sh
npm run gallery:prepare-previews -- --origin https://tintocellar.com --out output/gallery-previews
```

This only reads anonymous public images and writes local `previews.sql` and `summary.json`. It never writes to production. After deployment and authorization for the backfill, apply the SQL with the current production Wrangler configuration. Every update requires the same thumbnail SHA-256, a currently published submission, and an empty preview. Re-running preparation skips labels that already have previews. Publication decisions, asset bytes, hashes, and packs are not modified.

Verify `/api/gallery/v1/browse` includes previews after its 30-second cache expires, then check the gallery with delayed images and reduced motion. Also complete the release workflow's health and protected-budget checks. This change alone does not deploy or run the production backfill.
