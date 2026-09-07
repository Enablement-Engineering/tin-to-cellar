# Diagnostics operations

The print page provides only collection status, retry, and a compact inspection dialog. Fixed diagnostics, recognized website validation codes, and eligible reference links submit with ZIP import. Optional process retrospectives remain local until the user explicitly shares them. A standalone failure JSON is opened locally and requires a separate share action. ZIPs, image bytes, raw manifests, and validator messages are not submitted.

## Storage rollout

1. Authenticate Wrangler with access to the site's Cloudflare account and D1. Provision `tin-to-cellar-diagnostics` using `npm exec -- wrangler d1 create tin-to-cellar-diagnostics`. Record the returned database ID in the `DIAGNOSTICS` entry in `wrangler.jsonc` before production rollout. The name-only binding supports local development; do not rely on deployment to create production tables.
2. Run `npm run diagnostics:migrate:local`, then `npm run diagnostics:migrate:remote` once the remote database exists. The GitHub deployment token needs D1 access as well as Worker deployment access. CI applies migrations before deploying code that needs them.
3. Legacy copying runs independently of new collection and read-only exports. The daily scheduled job retries it; an operator can also POST `/api/labels/diagnostics/migrate` with the existing `CONTRIBUTION_ADMIN_TOKEN` in the Authorization bearer header. The diagnostics read token cannot invoke migration. The migration preserves original receipt dates and 90-day expiry and marks completion only after every write succeeds. Interrupted migrations safely retry. Original records remain under their original expiry. Retain this recovery path for environments whose migration has not been verified. The admin-token `npm run diagnostics:backfill` script is an alternative recovery route; it deletes its temporary SQL after execution.
4. Set a separate random read-only `DIAGNOSTICS_READ_TOKEN` as a Worker secret with `npm exec -- wrangler secret put DIAGNOSTICS_READ_TOKEN`. Supply the same value privately to the local review environment. It grants only the protected diagnostics GET route; the review does not need deployment credentials. Never place tokens in Git, command arguments, task prompts, URLs, or report output.
5. After reviewed release, verify `/api/labels/diagnostics` rejects unauthenticated reads, import a fixture, verify one stored record and duplicate-safe reimport, explicitly share fixture notes, and confirm receipt. Check the deployed revision separately from local results.

After refreshing Cloudflare login, database `10c1a5a7-9884-46ad-86d0-2eedf5d8426a` was created and migration 0001 was applied remotely. A dedicated DIAGNOSTICS_READ_TOKEN is configured in Cloudflare and in ignored, mode-600 `.env.diagnostics`; `diagnostics:fetch` loads that local file automatically. The new Worker/application code has not yet been deployed, so live collection/backfill and the first live review remain pending. Local migration and fixture tests are separate evidence.

Release coordination: published reference-confirmation commit `14ed1b8cda610bfb917f32b20a23ea7ccf9416f9` has been incorporated into these working files, including its protocol source, reference-review test, and immutable 0.0.18 release. Diagnostics is now generated as 0.0.19. All 169 tests, canonical build/typecheck, and lint passed after integration. The local Git branch still needs reconciliation with origin/main before a diagnostics commit or push; do not deploy the mixed shared working tree. The retrospective schema remains 0.1.0 and structured feedback remains 0.2.0.

## Retention and collection behavior

New structured reports and website checks expire one calendar year after receipt. Optional notes expire 90 days after their own receipt. The daily Worker cron removes expired notes and reports; exports exclude expired records immediately. Duplicates do not extend expiry. Existing reports backfilled from the legacy store retain 90-day expiry. The existing Durable Object continues managing public source suggestions, including its 90-day freshness and capacity limits. A source write failure yields partial collection status without losing the D1 diagnostic record.

The frontend sends contribution version 2; older version 1 clients are still accepted. If D1 is absent, new contributions return unavailable rather than claiming durable receipt. Older clients retain the legacy collection path. Standalone reports have random IDs reused for retry within the tab, not reliable deduplication across separately opened copies. Reports are not user counts.

## Manual weekly review

Read [the review skill](../../.agents/skills/review-tin-to-cellar-diagnostics/SKILL.md), then run:

```sh
npm run diagnostics:fetch
npm run diagnostics:analyze
```

Use a supported Node 24 runtime, matching CI. Scripts write only under ignored `output/diagnostics`, with private file permissions. Retrieval errors fail the run without advancing the review cursor. Pagination uses a fixed receipt cutoff. The review fetches retained history so missed schedules can catch up; summaries distinguish seven-day and 28-day samples. Finalized monthly aggregates carry no report IDs or narrative. They describe retained submitted data, not total attempted runs.

Inspect the summary and selected private notes. Update `docs/diagnostics/findings.json` with sanitized conclusions, evidence IDs, denominators, reproduction steps, and status. Never copy raw notes into Git or issues. Create `output/diagnostics/review-result.json` matching the current snapshot ID, with outcome `findings` or `no-material-change` and an array of finding IDs. Then:

```sh
npm run diagnostics:complete
```

Completion advances the cursor and deletes the raw snapshot. If a review is interrupted, the next analysis strips expired data before use. Delete leftover `snapshot.json` when disabling reviews. Do not back up raw snapshots or upload them as Actions artifacts. Monthly aggregates and sanitized findings have separate long-term retention; protected exports do not enforce retention of manually copied files.

## Scheduling and release boundaries

After the remote endpoint and a manual live review succeed, create a weekly task in the current Codex conversation. Use the review skill, the subscription-backed local session, and this repository. Keep the computer on and the app running. Notify only on material findings, regressions, failures, or decisions. The initial schedule is report-only and must not modify prompts/tools, create PRs, merge, deploy, or spend on image providers.

Suggested schedule: Monday at 9 AM America/New_York. The schedule is not enabled while remote storage/credentials or the first live review are missing. Tests with fixtures do not satisfy the live-review gate.

For a selected finding, reproduce the issue, implement one candidate in an isolated worktree, add meaningful tests, and compare with the current release. Run fresh-agent and visual trials when the claim depends on them. Release a new immutable protocol version through a reviewed PR. GitHub runs deterministic tests/build and deploys successful main revisions. Running AI analysis inside GitHub Actions would require separately billed API authentication; the initial local schedule uses the Codex subscription.

## Code-quality release verification, September 7, 2026

The production protected export returned HTTP 200 with 16 reports and no next page. That deployed version ran its idempotent migration before export, confirming the production migration returned successfully. This does not establish migration state in other environments. This release moves copying off collection and export requests and preserves the authenticated operator action and daily fallback. New D1 submissions can proceed independently; exports in an unmigrated environment may omit legacy records until its operator action or scheduled migration succeeds.

Both contribution and notes endpoints bound streaming JSON reads to five seconds. Contributions allow 65,536 bytes; notes allow 16,384 bytes. Missing, malformed, invalid UTF-8, or unreadable bodies return 400, deadlines return 408, and oversized bodies return 413 before diagnostic allowance reservation.

## Note ownership and duplicate accounting, September 7, 2026

Apply migration `0002_diagnostic_ownership.sql` before deploying the ownership code. It adds a nullable capability hash to reports and preserves all records. Existing records deliberately remain unowned; neither an ID nor the original manifest can recover ownership. Version 1/2 contribution bodies and retrospective schemas remain unchanged. New browsers send `X-Diagnostic-Capability`; older clients can still collect reports but cannot attach new notes. Previously stored notes retain their expiry and export behavior. No AI protocol release is needed: notes still require explicit browser sharing.

The existing `diagnostic-budget-v1` counter survives this release, preserving any allowance already consumed today. New atomic resource reservations make concurrent retries count once. The protected budget response shape remains unchanged; `used` now includes unique resource reservations and any attempts counted before this deployment. Per-IP request limits still apply to every request. Reservation keys contain only resource IDs and UTC day and are removed by the Durable Object alarm after the day ends. At most the configured daily allowance of new keys can be created each day. No uncertain write is refunded.

Validate with local migrations and synthetic reports: the same receipt must permit retry and explicitly shared notes; a different receipt and missing receipt must fail; duplicate imports must not issue ownership; existing unowned reports must stay unowned. Verify a concurrent duplicate batch reserves one slot, a different resource still consumes one, and UTC rollover plus alarm cleanup removes old reservation keys. Production migration and application deployment remain separate release steps.
