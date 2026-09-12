# Local beta acceptance evidence

Recorded September 12, 2026. Status: **locally verified beta candidate; P0-6 explicitly deferred; hosted release gates outstanding; production unchanged by this work.**

## Candidate identity

- Tested implementation commit: `740c38f05348495eace5d760113c4b995d4b97ea`, branch `codex/beta-readiness`.
- Base: `f73760b88fc8071b80c2682a95876bd2eb809049`. A fresh `git fetch origin main` during release preparation returned this same SHA. No reconciliation or product change was needed.
- The implementation commit was created after the checks. The final gallery test selector was corrected and its affected browser flow rerun before committing. Later evidence/package documentation does not change the tested application.
- Configuration identity is the candidate commit plus SHA-256 of `wrangler.jsonc`: `dc44b5dd738cc09b97161d71c4221db63b1d5a41eb5ea2d41f1ffc13d33c3456`. Compatibility date: `2026-09-05`. Worker-first true, front-of-Worker cache false, analytics false.
- Lockfile SHA-256: `da1c22c18af24c4e1d8189e6b32921c708a031c495baf12ddcba8c667521213f`. Pinned tooling includes Wrangler 4.129.0 and Playwright 1.62.1. Local host: macOS Darwin 25.5.0 arm64; npm 10.9.8 observed during preservation.
- Isolated execution directory: `/private/tmp/tin-beta-readiness`. Browser tests used Chrome and fresh local Wrangler servers. No hosted Access credentials were exercised by these tests.

## Commands and results

These results were recorded in the implementation session. This index is a reconstructed acceptance record, not a preserved raw console transcript. No tests were rerun merely to recreate logs during preservation.

| Command, run from isolated checkout | Recorded result |
| --- | --- |
| `npm test` | 623 tests across 82 files passed, including nine local load tests. |
| `npm run lint` | Passed. |
| `npm run build` | TypeScript and build passed. |
| `PROTOCOL_BASE_SHA=f73760b88fc8071b80c2682a95876bd2eb809049 npm run protocol:history` | 29 immutable historical releases unchanged; current protocol 0.0.29. |
| `git diff --check` and `git diff --cached --check` | Passed before implementation commit. |
| `npm exec -- wrangler deploy --dry-run --outdir output/beta-readiness/worker-bundle` | Local bundle/configuration accepted; no deployment. Wrangler log path was redirected to temporary output. |
| `WRANGLER_LOG_PATH=/private/tmp/tin-beta-wrangler-logs npm exec -- playwright test --config /private/tmp/tin-beta-ui.playwright.config.ts --output output/beta-ui-final` | Four beta UI scenarios passed on port 43937. API interception is used where specified by the test. Successful traces were not retained. |
| `npm exec -- playwright test --config playwright.security.config.ts` | One local framing scenario passed on port 43929. |
| `WRANGLER_LOG_PATH=/private/tmp/tin-beta-readiness/output/wrangler-logs npm exec -- playwright test --config playwright.gallery.config.ts` | Four gallery scenarios passed in the final full run; final browser flow required the focused rerun below. |
| `WRANGLER_LOG_PATH=/private/tmp/tin-beta-readiness/output/wrangler-logs npm exec -- playwright test --config playwright.gallery.config.ts --grep 'browser selects artwork'` | Final private submission/publication/import/print flow passed on fresh port 43928 after correcting a stale checkbox selector. Five distinct gallery scenarios passed across these runs. |

## Retained evidence and limits

Durable local directory: `/Users/dylanisaac/Projects/tin-to-cellar/output/beta-acceptance/740c38f/`. This is outside temporary storage and ignored by Git. It is a local retained copy, not an off-device backup. `SHA256SUMS` verifies its contents. Evidence/package documents are also committed on the implementation branch. No credentials, browser profiles, database snapshots, private artwork, unsanitized logs, traces or generated bundles are included.

| Retained item | Purpose |
| --- | --- |
| `local-load.json` | Original sanitized report recorded at 2026-09-12T19:55:14.096Z; real local SQLite plus memory R2/Cache adapters. |
| `beta-load.test.ts` | Exact load scenario definitions from the tested candidate. |
| `beta-readiness.pw.ts` and `beta-ui.playwright.config.ts` | Exact beta UI scenario source and temporary execution configuration. The copied configuration retains original paths; adjust them before rerunning elsewhere. |
| `beta-readiness-status.md`, `beta-acceptance-evidence.md`, `beta-release-package.md` | Candidate status, evidence provenance and finite release requirements. |
| `0006_print_intent.sql`, `0007_public_browse_index.sql` | Reviewed additive migrations, also versioned with the candidate. |

Cold landing: 26 requests, 27 SQL statements, 24 R2 reads. Warm landing: 26 requests, 26 hits, zero SQL/R2. These are fixture operations, not billed rows or saved Worker invocations.

The 100-request same-image scenarios exist and passed. Cold: 100 requests, three SQL statements, one R2 read, 99 hits. Warm: 100 requests, zero SQL/R2, 100 hits. `Promise.all` starts 100 handlers, but the immediate four-byte memory object and lack of an overlap barrier do not prove 100 simultaneous hosted downloads. The separate delayed-I/O test covers 24 thumbnails. The 20-session fixture advances a simulated clock; it does not run a real 60-second hosted traffic profile.

The report contains p95 handler time only, excluding response-body consumption. Cold/warm 100-request p95 values are 12.057/12.662 ms. No p50, p99, maximum, raw timing distribution or agreed numeric latency ceiling was retained. Hosted latency acceptance is outstanding and must not be inferred from these local numbers. The hosted package requires a frozen ceiling before candidate measurement.

Browser print preparation and a generated PDF are local evidence. Physical printing and offline startup/reload are not proven. P1 and research automation remain outside beta.

Before release, refresh main again, record the actual integrated release SHA/config hash, and rerun the required checks if product/configuration changes. Attach hosted evidence to that SHA rather than transferring acceptance silently from this candidate.
