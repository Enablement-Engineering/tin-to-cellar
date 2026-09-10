# Gallery label metadata migration

The v2 application requires v2 saved metadata. This is a one-time representation migration, not a legacy runtime adapter. Migration 0005 creates a backup table; it does not transform records automatically.

The planner preserves submission/publication IDs, state, artwork, thumbnails, consent, and identity. It creates replacement ZIPs containing top-level edition and alternative text, removes research placeholders, and updates the pack pointer. It recalculates metadata, approval, and duplicate hashes; increments the review version; and records the previous digest in history. Review recommendations for the old version become stale.

Prepare from the intended checkout and current production configuration:

```sh
npm run gallery:migrate-labels -- --prepare output/gallery-label-migration --remote tin-to-cellar-gallery wrangler.jsonc
```

This reads D1 and downloads existing pack files into a local snapshot. It does not upload, change the database, or deploy. Review `output/gallery-label-migration/plan/uploads.json`, `migration.sql`, and regenerated ZIPs. Published duplicate collisions, altered pack bytes, unexpected geometry, and in-flight operations stop planning. Do not publish the snapshot or SQL: both contain private submission metadata.

For a release, use a maintenance window. Close gallery intake, publication, and serving. Deploy the matching v2 application through the main release workflow, which applies SQL migration 0005. The v2 application returns gallery maintenance responses and skips gallery cleanup while any saved metadata remains v1. After verifying that gate, prepare a fresh plan and run:

```sh
npm run gallery:migrate-labels -- --apply output/gallery-label-migration/plan --remote tin-to-cellar-gallery wrangler.jsonc
```

The apply command requires intake/publication to be closed. It exports a database backup, verifies the generated plan, uploads ZIPs to immutable content-addressed keys, downloads and verifies each uploaded SHA-256, and applies the entire guarded SQL file through Wrangler. It verifies saved metadata and approval digests afterward. It does not deploy or reopen intake/publication. The maintenance gate clears automatically when the atomic migration finishes; keep the database switches closed until verification completes. Replace `--remote` with `--local` and use a local config/bucket for rehearsal.

Concurrent metadata/version/state changes stop SQL application. The same plan can be replayed immediately without duplicate history or extra version increments. A fresh plan skips already migrated records. Original database snapshots and source ZIPs remain on disk. Original R2 pack pointers are retained in the migration backup table until normal submission content deletion; cleanup then deletes the backup bytes and private metadata too.

After deployment verify the review queue, public browse, downloading and importing a migrated edition, print geometry, health, and the protected budget endpoint. Reopen the gallery only after the matching application is healthy. Remote execution and deployment require the authorized release owner.

## Transaction rehearsal

Run the synthetic rehearsal with `npm exec -- node scripts/gallery/migration-local-rehearsal.mjs`. It creates isolated temporary D1/R2 storage, disables Wrangler telemetry, and uses `--local` for every storage call. It exercises the real `--prepare` and `--apply` commands, verifies stale-plan rejection, appends a failing guard after all migration writes to prove complete rollback through the actual Wrangler CLI, then verifies successful application and idempotent replay. Source and migrated ZIP artwork hashes must match, and the edition must survive.

This rehearsal passed with installed Wrangler 4.129.0. Its local SQL-file implementation sends all statements through D1 `batch`; its remote SQL-file path uses D1 import and reports restoration of the original database on import failure. Explicit `BEGIN`/`COMMIT` wrappers are therefore intentionally absent. Local execution was tested; remote migration execution has not been performed.
