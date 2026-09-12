# Beta readiness implementation and coordination plan

Prepared September 12, 2026 from the supplied beta-readiness brief, three parallel planning reviews, and the current checkout.

This is the execution plan requested by Dylan. Implementation of the beta work was authorized after review, with the targeted clarifications below. The supplied brief remains design input; it does not itself authorize deployment, account changes or activation of research/generation. Search improvements and research automation remain outside the beta stopping point.

Local `main` and the locally stored `origin/main` both point to `f73760b`. The remote was not refreshed during planning. The checkout has existing artwork/research work and changes to `package.json` and diagnostics findings. Those changes are outside this plan's ownership.

## Decisions that shape the work

1. Keep P0-1 through P0-4 under one gallery owner. Cache, limiter, database and streaming changes converge on `worker/gallery/routes.ts` and `storage.ts`. Separate commits are useful; simultaneous editors are not.
2. Treat minimal print-intent analytics as P0, following the brief's priority table. Its later execution-order placement is contradictory. Implement it alongside hardening, enable it only after privacy and abuse checks pass, and keep the priority report and research automation in P1. Moving telemetry after beta would be an explicit scope change, not an unnoticed omission.
3. Put cache-removal and serving-switch behavior ahead of cache implementation. The current public routes check publication state on every request. A long cache TTL changes that promise. Fingerprinted URLs cannot revoke a response already cached in a browser.
4. P0-6 is **deferred by explicit beta scope exception**, approved by Dylan on September 12, 2026. Retain `run_worker_first: true` in production and configuration generators. Only static-bypass-specific acceptance criteria are deferred. Hosted admin authentication, human/machine separation, private no-store and security-header tests remain release requirements. Do not introduce a separate admin deployment or claim Worker invocation savings. This exception does not authorize deployment.
5. Keep research discovery separate from generation and gallery maintenance. The existing gallery agent client can read scoped submissions and append recommendations. It cannot upload generated artwork or publish it. RESEARCH-2 needs a bounded intake adapter or a maintainer-controlled handoff.
6. Leave the two artwork agents' files, queues, outputs, grants and publication decisions alone. Coordinate only when a shared code change, migration, catalog seed or release affects them.

## Coordination model

Use a coordinator plus up to three implementation subagents. Agent slots are reused between waves. If fewer slots are available, retain the ownership boundaries and queue work rather than mixing responsibilities.

The coordinator owns the integration branch, shared configuration, API contract decisions, migration numbering, acceptance ledger and production release. Implementation begins in an isolated checkout based on freshly fetched `origin/main`, using a `codex/` branch. Do not sweep the current checkout's uncommitted work into it. Follow the existing prompt, CellarPack and website module boundaries; request interfaces from those owners if changes become necessary.

Each assignment starts with its base SHA, exact writable paths, exported interfaces, dependencies and required proof. An agent must request ownership before editing outside those paths. Shared root files are reserved for the coordinator, including `package.json`, lockfile, `wrangler.jsonc`, `worker/index.ts`, release/local configuration generators and `.github/workflows/deploy.yml`.

Each handoff contains changed files, behavior before and after, tests actually run, remaining limitations, migration/configuration needs and a reviewed commit or patch. An agent's report is not acceptance. The coordinator inspects the diff, runs integration checks, and obtains review from an agent who did not author the change.

Track each ticket through queued, active, ready for review, integrated, locally verified, hosted verified and complete. Record blockers against the affected ticket while independent work continues. Keep all source ticket IDs visible until completion or an explicit scope change.

## Wave 0: establish contracts and a reproducible baseline

The coordinator prepares these decisions while the agents inspect their assigned areas.

- Record fresh repository and deployment revisions separately. Identify any active release owner without interrupting routine artwork production.
- Run the existing relevant tests, build and lint in the isolated checkout. Record pre-existing failures separately. Use fresh browser servers and isolated local D1/R2 fixtures.
- Specify cacheable public routes, keys, allowed query parameters, host partitioning, response headers, invalidation, failure handling and limiter order. Never cache private/admin/agent/review/submission/diagnostic responses or error responses by broad default. Warm a public route and request that path on the admin host without authentication; test the reverse direction and authenticated variants too. Admin branch `no-store` alone cannot protect a front-of-Worker cache hit. Workers Cache's default key excludes hostname. For this beta use the classic Cache API inside the authenticated Worker dispatch, with full-origin keys; front-of-Worker caching stays disabled.
- Proposed beta policy: browser revalidation for public images, config TTL no longer than 15 seconds, list TTL no longer than 30 seconds, and edge image TTL no longer than 60 seconds until purge behavior is proven. Set a maximum 90-second composed stale-serving/removal target for new requests, allowing brief control-state staleness and an in-flight cache fill. Bound fill duration and prevent late fills from extending that deadline. Validate the full composition rather than assuming the largest single TTL is the bound. No stale-on-error extension for removed or disabled content. Previously downloaded bytes are outside revocation guarantees.
- Use the classic Cache API with its explicit region-local limitation for this beta. Do not call a cache hit a saved Worker invocation when the Worker still runs.
- Prove the v2 label metadata backfill is complete before retiring readiness scans. Migration `0005` alone does not transform legacy metadata. Preserve failure behavior and backup/rollback evidence.
- Freeze print-event semantics and the strict request schema before frontend/backend work diverges. Set request/quantity/counter limits and the analytics disable switch.
- Build a route matrix covering all three hosts, API successes/errors, admin and machine authentication, `/gallery/status`, legacy admin redirects, SPA navigation, direct JS/CSS requests, HEAD requests and security headers.
- Choose a staging test envelope before measuring success. Proposed normal profile: 20 browser-equivalent sessions behind one IP over 60 seconds, plus 100 concurrent same-image requests. Add a deliberate overload profile and run it only against isolated local or staging resources.

These are proposed implementation defaults, not claims of current performance or deployed behavior. A stronger immediate-revocation requirement would require preserving an authoritative check or proving reliable invalidation before caching is enabled.

## Wave 1: implement the beta requirements in parallel

| Owner | Tickets | Writable areas | Deliverable and acceptance |
| --- | --- | --- | --- |
| Agent A, gallery backend | P0-1, P0-2, P0-3, P0-4 | `worker/gallery/routes.ts`, `storage.ts`, new gallery cache/read helpers, related gallery unit tests; gallery index migration after coordinator assigns its number | Cache public reads, separate metadata/image/pack limits, reduce D1 work, stream R2, and prove shutdown/unpublish behavior. |
| Agent B, website | P0-5, COPY-1, COPY-2, analytics browser integration | `GalleryBrowse.tsx` and its tests, `About.tsx`, `HowItWorks.tsx`, `Privacy.tsx`, `src/PublicApp.tsx`, `PrintStudio.tsx`, a new client telemetry module and matching browser/component tests | Manual pagination, grounded copy, nonblocking canonical print-intent events and an accessible opt-out. Own all shared website integration edits. |
| Agent C, analytics backend | ANALYTICS-1 server/schema | New `worker/analytics/**`, new shared analytics schema/types, new analytics tests; rollup migration after number assignment | Bounded anonymous aggregate ingestion, canonical ID validation, atomic counters, explicit abuse limits and private aggregate reads. Provide integration changes for the coordinator. |
| Coordinator | P0-7, integration; P0-6 deferred | Shared root files listed above, operations/release docs | Preserve protected Worker-first routing and security headers; add sanitized operational visibility and release checks. |

Agent A implements database/stream foundations, then limiter/cache behavior, with reviewable checkpoints. Existing private asset previews share helpers with public downloads, so public caching must not accidentally change private response headers. Cache fills, conditional requests and R2 stream cancellation must be tested together.

Use a single published-submission/asset lookup on public cache misses and select only public projection fields for list pages. Compare query plans for filtered and unfiltered browsing before adding an index. Cache serving state only for the agreed short interval; mutation, publication and intake decisions must still use authoritative controls. ETags describe the returned representation. Test private/removed-label requests with `If-None-Match` so a conditional response cannot bypass visibility checks.

Agent B removes automatic pagination for beta and retains the existing button, cancellation and single-load guard. The copy keeps the enthusiast lede and three user steps. Describe the research, generation, proof and repair process as what the protocol asks the chosen AI to do; do not promise that website validation establishes packaging fidelity or rights. The invitation to brands stays below the personal-cellaring story.

Agent C and B use the following minimum analytics contract:

- Count `selected-for-print` at an explicit user transition into printing, not during rendering or every selection toggle. Include only canonical entries with printable artwork and positive quantity. Restoration or automatic post-import navigation must not create an intent. Reopening intentionally is another intent. Collapse duplicate canonical IDs within a batch.
- Count print-job requests and snapshot requested quantities at the explicit print action, excluding alignment sheets and blocked or empty jobs. This measures a requested job, not successful physical output. Per-blend job participation is distinct from a global job total; do not sum blend rows to infer unique jobs. A separate daily total can count one job once without storing its contents.
- Record added-to-labels only for an explicit supported add action. Do not emit demand telemetry merely because a local ZIP or order was imported or restored. Keep that metric distinct from print selection.
- Accept only known canonical IDs and bounded integer quantities. Reject unknown keys, custom text, URLs, artwork, arbitrary dates and invalid IDs. The server sets the time bucket.
- Aggregate immediately. Store no raw event stream, persistent user ID, IP, fingerprint or account identifier. Use transient IP-based limiting only for abuse protection. The implementation contract sets a 16 KiB request body maximum, at most 100 canonical IDs and 450 labels per batch. A separate 30 requests/IP/minute Cloudflare limiter is approximate and location-local. An atomic D1 admission reservation enforces a site-wide UTC daily allowance of at most 1,000 batches, including reservations whose later write fails. This caps per-blend aggregate updates at 100,000/day, with separately documented admission, catalog-read and daily-total overhead; it is not a cap on all attempted requests, D1 operations or hosting spend. Body/shape limits reject before D1; allowance exhaustion returns 429 and cannot affect printing. Do not reuse the diagnostics allowance.
- For the minimum version, send best effort with no automatic retry. Deduplicate duplicate handlers in local memory for the explicit action. This accepts undercounting and avoids a server event-ID store. Do not claim exactly-once counting; repeated intentional actions and forged requests remain possible. Add bounded idempotency retention only if a later requirement justifies it.
- Keep telemetry off until the endpoint, opt-out and privacy disclosure ship together. An opted-out browser sends no events. Collection failure, offline operation, timeout or 429 must never delay printing. Do not silently flush old events later.

For operational visibility, use route classes, status classes, durations and bounded dependency/cache counters. Exclude request bodies, raw URLs/query strings, credentials, capabilities, custom text and canonical blend selections from operational logs. Do not enable default invocation logging blindly. Front-of-Worker hits need cache/platform metrics because application logs cannot observe requests that bypass execution. Specify sampling and retention and validate the resulting hosted records.

Account-level billing notifications require checking actual account capabilities and current pricing. Set supported alerts and document manual checks for unsupported metrics. Notifications do not impose a hard spending cap. Keep the application storage/admission limits and diagnostic protection intact.

## Wave 2: independent review and beta validation

After integration, reassign the agents. Agent A reviews telemetry abuse/privacy. Agent B owns TEST-1 browser and load scenarios against the integrated build. Agent C reviews gallery cache, auth and routing changes. The coordinator resolves findings and owns final gates.

| Gate | Required evidence |
| --- | --- |
| Deterministic checks | Focused tests, full `npm test`, `npm run lint`, `npm run build`, and `git diff --check`. Build includes TypeScript checks. Preserve protocol-history and immutable-release checks. |
| Cache amplification | Cold and warm config/list/24-thumbnail profiles with request, D1 and R2 counters. A sequential warm reload within TTL must add zero R2 image reads. Proposed controlled warm-hit target is at least 95%; report evictions and cold-fill behavior separately. |
| Database improvement | Before/after query plans and counted operations. No repeated metadata-wide readiness scan per thumbnail; at most one published-asset lookup per asset miss, excluding the separately bounded control-state refresh. |
| Normal and overload traffic | Under the agreed normal shared-IP profile, zero unexpected 429s and zero application 5xxs. Overload should produce bounded intentional 429s without breaking local flows. Report p50/p95/p99 and maximum latency; establish a numeric latency ceiling from the staging baseline before accepting results. |
| Streaming | Concurrent artwork/ZIP downloads, byte/hash/header parity, early disconnects, bounded memory observation and later successful downloads. Demonstrate public downloads avoid full-object `arrayBuffer()`. Account for stream cloning/cache fill behavior. |
| Removal and shutdown | Unpublish/serving-disable under traffic, cache primed in multiple regions, stale lists, old copied URLs, conditional GETs, failed purges and delayed fills. New requests stop returning removed/disabled content within the documented composed bound. Recovery cannot resurrect unpublished bytes. |
| UI/local-first | Keyboard/manual pagination, status/focus, narrow viewport, screen-reader checks and fresh-server accessibility tests. Test gallery and telemetry failures separately from connectivity loss. An already-loaded app preserves local work and supports local ZIP import and saved-artwork print preparation when APIs fail or connectivity is lost, for resources already loaded. Online reload restores saved work. Offline reload/startup is a separate capability, excluded from beta; do not add a service worker or claim reliable offline startup. New gallery-add fails gracefully when its download is unavailable and preserves existing selections. No new import-triggered upload or provenance fetch. |
| Privacy | Browser network inspection proves opt-out silence and canonical-only payloads. Raw records/log inspection proves direct rollups without user/event profiles. Test invalid quantities, forged IDs, duplicate action handlers and limits before expensive work. |
| Hosted routing | Actual Access enforcement on admin HTML and assets, human/machine separation, private no-store, security headers on Worker-served HTML/assets, API errors remaining JSON, and SPA/status/redirect behavior. Static-bypass-specific checks are deferred with P0-6. Synthetic auth tests alone do not pass this gate. |

TEST-1 also includes ten-page manual browsing, popular-label traffic, search storms with cancellation, and a popular-pack disconnect scenario. Use synthetic counters for repeatable local assertions and real platform measurements for hosted claims. Do not load-test or disable the production gallery merely to collect proof.

## Beta release procedure

Prepare the release candidate, migration order, rollback procedure and validation evidence before requesting any missing deployment authorization. This planning request does not deploy, schedule agents, enable data collection or change account settings.

1. Reconcile against freshly fetched `origin/main`. Review only owned changes and freeze the tested candidate SHA.
2. Check the artwork coordination boundary. The current main workflow applies gallery migrations and reseeds `gallery_tobaccos` and aliases on every deployment. Confirm compatibility with ongoing artwork inserts and canonical IDs. A brief publication pause is needed only if the concrete migration cannot coexist safely; do not stop the artwork campaign by default.
3. Update both real and generated configuration paths. `prepare-release.mjs` and `start-local.mjs` currently force Worker-first routing; the release generator also supplies limiter bindings and staging observability settings. Test configuration parity so helpers cannot restore obsolete controls.
4. Apply additive migrations before consumers, with compatibility for the previous Worker during rollout. Roll back application code to a compatible release; do not delete production data to reverse a migration.
5. Use the current `origin/main` GitHub release workflow. Its main push deploys automatically, so pushing the release commit is part of deployment authorization. Do not deploy stale generated configurations or the mixed local checkout.
6. Verify the deployed SHA/version, public domains, health capabilities, and unauthenticated `403` from `/api/labels/diagnostics/budget`. Verify the authorized budget read separately when credentials are available, without disclosing them.
7. Complete hosted cache/routing checks and one real browser create/import/print-preview flow. Record physical printing separately; browser preview does not prove printer alignment.
8. Capture an operator-readable runbook with serving-disable, cache invalidation, telemetry-disable, recovery and rollback steps. Correct stale statements in `docs/gallery-operations.md` using current evidence.

Beta is complete only when the in-scope P0 and copy tickets have accepted proof and the release gates pass. P0-6 remains deferred by explicit beta scope exception, not complete. A local browser inventory requested four static paths on cold landing and warm reload; this is not a measurement of billed invocations. Requests that reach the Worker still invoke it. The exception does not relax hosted auth, private caching or security-header requirements. Catalog completeness is not a beta blocker under the supplied brief.

## Wave 3: search, asset versions and catalog priorities

| Assignment | Tickets | Ownership and dependency |
| --- | --- | --- |
| Gallery backend owner | P1-1 backend, P1-2 | Gallery backend paths, projection types and related tests after Wave 2 releases ownership. Add one query for at most eight unique canonical IDs; define stable deduplication/order/cursors bound to the filter set. Add representation-specific hash URLs and scoped invalidation, retaining the proven removal policy. |
| Website owner | P1-1 client, ANALYTICS-2 admin UI | `search-labels.ts`, gallery client/tests and private priority-report UI. Replace fan-out while preserving abort/stale-result guards. Wire the report after its backend contract is frozen. |
| Analytics/research owner | ANALYTICS-2 backend, RESEARCH-1 queue foundations | New analytics/research modules and tests. Compute configurable blend/maker rankings from 7/30-day demand, quantities, design coverage and verified-release recency. State sample size, collection window and opt-out/abuse bias; avoid public popularity claims. |

Expand TEST-1 to prove one bounded search request, stable pagination and edition filtering. Only increase asset TTLs after multi-region invalidation and failure recovery pass. Versioning is cache identity, not authorization or rights proof. The priority report must expose score components, data freshness and coverage bias: blends without artwork cannot generate normal print selections, so zero prints do not establish zero interest. Use explicit add demand as a complementary signal and distinguish unavailable data from zero.

## Wave 4: release scout and verified preparation

The research owner implements RESEARCH-1; a second agent owns RESEARCH-2's adapter; a third owns RESEARCH-3 and independent failure review. The coordinator owns runner configuration and any shared gallery integration.

- Put discovery code in new `scripts/release-intelligence/**` and queue contracts in a dedicated module. Use a durable candidate store separate from existing artwork coordination state. Do not turn nightly discoveries directly into generated catalog-file edits.
- Store maker/blend/edition identity, source provenance, announcement date versus first-seen date, confidence and verification state. Normalize through existing catalog identities and aliases. Distinguish restocks, package sizes, packaging changes and genuine named releases. Retailer-only or ambiguous findings remain unresolved pending corroboration.
- Select a persistent scheduled runner after confirming its existing environment, credentials and budget. Name whose provider credentials fund generation and its separate per-run/daily image-spend allowance; website hosting limits do not fund or cap generation. Do not attach research/image generation to the Worker's maintenance cron. Prepare the schedule and dry-run output before activation; the attached brief is not an instruction to activate an automation today.
- Give each candidate a stable identity and each work attempt a lease, attempt limit, backoff and terminal review state. Resume after crashes without duplicate generation or submissions. Freeze source references and protocol revision/hash for generation; invalidate stale proof if either changes.
- The generation adapter consumes verified candidates and produces review-ready CellarPacks through the existing protocol and validation interfaces. Cap work per run and total retry/image spend. Provider/model unavailability pauses generation while discovery and maintenance continue.
- Start with a maintainer-controlled curated-intake handoff. If automated staging is later required, add a narrowly scoped submission capability; never give the existing recommendation client publication authority. Human rights/fidelity review remains required. Mark a candidate published only after reconciling an actual approved gallery publication.
- Integrate with the current artwork work through a stable handoff record containing candidate identity, canonical ID/edition, provenance, protocol revision and artifact hashes. Check current publication/active-work state before leasing or submitting. Do not adopt, clear or replay the artwork agents' existing queues by assumption.
- RESEARCH-3 covers idempotent reruns, duplicate announcements, renames/reissues, competing workers, expired leases, lost acknowledgments, source disappearance, blocked pages, model failure, proof failure, changed protocol, repeated submission and maintenance independence. Never bypass source challenges.

The full program is complete when every ticket in the source brief has accepted evidence, the scheduled scout has a verified live run if activation is authorized, and generation failure/recovery plus human intake have been demonstrated. A plan, a green unit suite or a generated image alone does not establish that result.

## Verified technical references

Cloudflare's current documentation distinguishes front-of-Worker [Workers Cache](https://developers.cloudflare.com/workers/cache/) from the [classic Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/). [Workers Cache purging](https://developers.cloudflare.com/workers/cache/purge/) is scoped to the owning Worker/entrypoint; a zone-level purge does not clear it.

[Selective Worker routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) uses path patterns. [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) documents request-URL invocation messages and the option to disable invocation logs. Verify account/runtime behavior in staging before choosing final settings.
