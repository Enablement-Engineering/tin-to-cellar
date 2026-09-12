# Beta implementation status

September 12, 2026. Implementation branch `codex/beta-readiness`, isolated checkout `/private/tmp/tin-beta-readiness`, based on freshly fetched `origin/main` at `f73760b`.

The beta implementation is local. No production deployment, remote migration, account notification change, analytics activation or artwork operation occurred. An active artwork publication slot was acknowledged; remote migration/deployment must wait for release coordination and authorization.

## Scope and ownership

| Tickets | Status |
| --- | --- |
| P0-1 cache, P0-2 limiter split, P0-3 D1 reads, P0-4 streams | Implemented and independently reviewed; local tests passed. Hosted verification pending. |
| P0-5 pagination | Implemented; manual pagination/retry and narrow-viewport browser checks passed. |
| P0-6 static bypass | **Deferred by explicit beta scope exception**, approved by Dylan. Not complete. Worker-first stays true; no separate admin deployment. |
| P0-7 operations | Sanitized logging configuration, route summaries, release checks and runbook implemented. Hosted logs/retention and account notifications unverified. |
| COPY-1, COPY-2 | Implemented, preserving consumer steps and describing what the protocol asks the AI to do. |
| ANALYTICS-1 | Implemented and locally verified. Production configuration remains disabled. |
| TEST-1 | Local synthetic load and browser scenarios implemented; controlled hosted load/cache evidence pending. |
| P1-1, P1-2, ANALYTICS-2, RESEARCH-1/2/3 | Queued after beta. No search rewrite, priority dashboard, scout schedule or generation runner was added. |

The gallery owner implemented the shared read pipeline. The website owner implemented copy, pagination and explicit intent callbacks. The analytics owner implemented bounded rollups and then independently tested the gallery. The coordinator integrated shared configuration, privacy-safe operational records, release checks and final validation. The gallery owner independently reviewed analytics and coordinator changes.

## Implementation contract

- Classic Cache API only, after Worker/auth dispatch, using full-origin keys. Front-of-Worker caching is explicitly disabled in production and generated configurations.
- Config/list/image deadlines are at most 15/30/60 seconds from request start. Browsers revalidate. Public control/readiness success can be reused for five seconds; expired refresh failure closes serving. Mutation controls remain authoritative. Admin/authenticated/cookie variants stay no-store.
- Images at most 2 MiB can be cached within a 16 MiB concurrent tee allowance. Packs and larger images stream uncached. Delayed fills cannot extend absolute freshness deadlines.
- Metadata/image/pack limits are separate, configured at 120/2,400/60 requests per minute. These are approximate location-local Cloudflare controls, not global cost caps.
- Analytics accepts only strict canonical batches, at most 16 KiB, 100 IDs and 450 quantity. A separate approximate 30/IP/minute limiter precedes body/database work. Atomic global UTC daily admission is capped at 1,000 batches, including failed downstream reservations. Blend/job counters commit atomically; no raw event or user identifier store exists.
- Explicit adds, ready-print transitions and print-button actions have separate meanings. Import/restore, artwork replacement, alignment and browser print events do not manufacture demand. Collection never blocks printing and has no retry/outbox. Privacy supplies a local opt-out.
- Offline continuation concerns an already-loaded app and available resources. Offline startup/reload is excluded. Physical printing was not performed.

## Evidence

The baseline had 562 passing unit tests, lint and build. Final integrated checks passed **623 tests across 82 files**, lint, TypeScript/build and whitespace checks. The pinned immutable protocol remains `0.0.29`; no prompt or CellarPack contract was changed. Wrangler dry-run accepted the final bindings/configuration without deploying.

Four dedicated browser scenarios passed for pagination/retry, 320px About/How It Works/Privacy with Axe and keyboard opt-out, canonical intent/429/opt-out/already-loaded offline printing, and static request inventory. The separate real-origin browser framing test passed.

All five gallery browser scenarios passed across the final suite run and a focused rerun. They cover machine-grant revocation, curated intake, narrow-screen navigation, cache removal within the 90-second window, and private submission through reviewer publication, public import and printing. The focused rerun used a fresh server after correcting a stale reviewer-checkbox selector. These are local Worker tests with synthetic authentication, not hosted Access or physical-printer evidence.

The local load fixture uses real SQLite plus memory R2 and Cache API adapters. It does not measure Cloudflare billed rows, production latency or Worker invocation savings.

| Scenario | Observed result |
| --- | --- |
| Cold config/list/24 thumbnails | 26 requests, 27 SQL statements, 24 R2 reads. |
| Warm repeat | 26 cache hits, zero SQL statements and zero R2 reads. |
| Delayed cache writes, 410 KB thumbnails | First warm repeat still has 26 hits and zero SQL/R2 work. |
| 20 sessions behind one simulated IP | 520 requests, no unexpected 429 or 5xx. |
| Ten intentional pages | 240 distinct thumbnails reachable through cursors. |
| 130 metadata requests | Ten expected limiter rejections; image and pack buckets remain independent. |
| 20 disconnected pack downloads | All 20 underlying stream cancellations observed. |
| Public/admin cache isolation | Actual root dispatch plus shared cache fixture rejects unauthorized admin reads; authenticated/private responses remain no-store. Human verifier is mocked locally. |

The query-plan comparison justified migration `0007`: unfiltered browse stops using a temporary sort while filtered browse retains its existing index. Migration `0006` adds anonymous rollups and an admission counter; both migrations are additive and have been exercised locally.

Independent testing found and corrected a cache-write cap that left thumbnails uncached under delayed I/O. Review also corrected effective config-intake comparison, duplicate add-event paths and generated staging-host analytics dispatch. Existing gallery test fixtures were updated for v2 `writingArea`, current navigation text and exact intake identity; pixel comparisons retain exact decoded-byte equality through hashes without enormous failure diffs.

Ignored evidence lives in `output/beta-readiness/local-load.json`, `output/beta-ui-final/`, `output/gallery/` and `output/beta-readiness/worker-bundle/` within the isolated checkout. Generated bundles and browser artifacts are not committed.

## Remaining release gates

Keep hosted admin authentication, human/machine separation, private-response caching and security-header checks required. Only static-bypass-specific criteria are deferred.

The release owner must verify actual hosted cache behavior and the 90-second composed removal target across locations, real Access authentication, platform metrics and logging privacy/retention, supported account notifications, migrations and the deployed commit. Preserve health capabilities and the protected diagnostic-budget 403. Enable analytics only after the privacy/abuse/browser gates are accepted for release.

Use the current-main workflow after the artwork publication slot is released and deployment is authorized. Do not describe the local candidate as deployed or beta-ready until those hosted gates are recorded. See [operations](beta-operations.md) and the [execution plan](beta-readiness-execution-plan.md).
