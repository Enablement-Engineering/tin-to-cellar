# Usage analytics and private reporting

September 16, 2026. Implementation authorized by the user's request to plan and implement browser-local matching with aggregate-only reporting. Collection remains disabled in production configuration. No deployment, remote migration, account changes, or activation are part of this implementation.

## Questions answered

- Which actions are received: instruction copies, ZIP checks, artwork saves, print preparation, print requests, and labels downloads?
- How many measured saved requests subsequently have all requested artwork imported locally, then printing requested, within 30 days?
- Which workflow stages fail?
- Which recognized blends have demand and no currently published artwork?
- Are collection flags off, admissions exhausted, deliveries failing after admission, or expiry cleanup incomplete?

These are received actions and locally matched requests. They do not measure unique people, cross-device retention, confirmed abandonment, successful physical printing, or representative adoption. Opt-in choices, offline use, delivery loss, bots, and repeated deliberate actions affect the totals. A matched pack is not proof that it came from a particular AI chat.

## Architecture and collection boundaries

The public app sends optional fixed-schema events to its own Cloudflare Worker. The Worker validates them and increments aggregate rows in the existing GALLERY D1 database. The protected admin host reads bounded reports at `/usage`. No Cloudflare Web Analytics beacon is included.

One explicit browser choice covers app actions, local request progress, and catalog demand. It defaults off. A local consent-generation marker prevents stale writes from being reused after off/on; that marker never leaves the browser. The old demand preference does not confer permission. The choice is per origin, browser, and device.

Both browser consent and server capabilities must permit sending. `ANALYTICS_ENABLED` is the master ingestion switch. `WORKFLOW_ANALYTICS_ENABLED` and `PROGRESS_ANALYTICS_ENABLED` independently gate their streams. Missing flags fail closed. Release generation explicitly keeps all three false.

The version-1 configuration always reports false, and version-1 ingestion is a no-write compatibility response, even for an old loaded client. New clients use strict version-2 envelopes. This prevents older implicit-permission clients from being awakened when the new collection is activated. Contract version is not proof of consent from a malicious sender.

There are no visitor IDs, cookies for analytics, session replay, server-side request matching, raw error messages, search terms, URLs, filenames, prompts, custom blend names, or file contents in usage payloads. IP addresses are used transiently for rate limiting, not written to these aggregate tables. Hosting and security processing remain separate. Existing automatic diagnostics and eligible public-source observations continue under their existing controls and are disclosed beside the optional choice.

## Events and exact timing

| Event | Explicit boundary | Fixed outcomes or unit |
| --- | --- | --- |
| Instruction copy | Preparation or clipboard result in `PromptHandoff` | copied, preparation-failed, clipboard-failed |
| Local ZIP check | Import orchestration receives a validation result or cannot read/load it | ready, partial, rejected, read-failed, module-unavailable |
| Local pack save | A successful collection commit actually applies incoming artwork | One save, which may apply several labels |
| Gallery design save | The equivalent successful gallery-origin commit | One save, usually one design |
| Print preparation | Explicit attempt to open printing | ready, preview-unavailable, loading, needs-artwork, empty |
| Print request | Normal label-print callback before invoking browser printing | One requested print action, excludes alignment sheets |
| Labels download | ZIP prepared and browser download initiated | One requested download, not confirmed disk save |
| Workflow failure | Import-save, gallery-add, or labels-export failure | Stage only; no claim to diagnose capacity/conflict/network causes |
| Catalog demand | Recognized blend added, selected for printing, or included in requested printing | Existing canonical blend participation and print quantity semantics |

Optional observer callbacks cannot throw through the user's operation. Rendering, restoration, automatic retries, example packs, and pending import review do not count as artwork saves. Pure prompt, CellarPack validation, and sheet geometry modules do not perform analytics networking. Delivery is best effort with a 2.5-second timeout, no retry, no batching, and no offline queue. One action may send multiple different counters and consume multiple admissions.

## Local request matching

On successfully copying and saving a request, an opted-in browser can retain local handoff/collection/row identifiers and target revisions. It sends only starting Monday in UTC, milestone, and elapsed bucket. No local identifier is sent.

A local pack import must use the same saved request and unambiguously match each requested row. The original target revision must match at fulfillment. Partial imports can accumulate, but already matched rows must retain both the matched artwork and fulfilled revision. Gallery imports are excluded. A print milestone requires all matched target rows to be included with those same revisions and artwork.

Only a confirmed server receipt for the preceding milestone permits the next one. Lost receipts suppress later milestones rather than causing retries. Browser Web Locks exclude concurrent writers; unavailable or busy locks mean no progress measurement for that action. Local records are bounded to 20 requests, at most 100 targets each, and expire after 30 days on the next check. Opt-out disables sending immediately and removes records, including cleanup behind an in-flight writer. Consent generations invalidate any stale write across tabs.

Server storage contains counters grouped only by starting week, milestone, and elapsed bucket: less than 24 hours, 1–7 days, 8–14 days, and 15–30 days. A starting week's window remains open for 37 days so its last possible start can have 30 days. Missing outcomes remain unknown. Whole intersecting starting weeks are shown separately from the daily activity range.

## Storage and report contract

Migration `0009_usage_analytics.sql` adds workflow totals, weekly progress totals, daily admissions/recording evidence, and cleanup status. Admission triggers preserve daily history atomically before downstream work. Failed canonical checks and failed writes do not refund admission. Successfully recorded counts commit with the corresponding aggregate increments.

All three streams share the existing maximum 1,000 admissions per UTC day and 30/IP/minute approximate abuse limiter. This is not a Cloudflare billing cap. Reports distinguish historically observed allowance exhaustion from blocking under today's current allowance, including a same-day reduction to zero. Current flags cannot establish historical availability; the report explicitly says history is unknown.

Daily cleanup runs independently of ingestion flags and other scheduled jobs. Aggregates expire outside the latest 365 UTC calendar days; progress retention uses the starting week. Cleanup deletes bounded batches and reports incomplete backlogs. Provider backup expiry is separate. The old blanket retention exception does not apply to these totals.

Private GET endpoints:

- `/api/analytics/v2/admin/summary?days=7|30|90|365`: daily events, whole starting-week progress, collection evidence, current flags/allowance, and cleanup status.
- `/api/analytics/v2/admin/blends?days=...&metric=added|selected|jobs|quantity&availability=all|missing&cursor=...`: fixed rankings, 50 rows per page, validated numeric offset capped at 10,000, and current published design counts. Published designs count even if their catalog entry was later retired. Global gallery serving is reported separately.

Both endpoints require the exact configured admin host and existing human Access authentication. Public/unknown hosts are denied, including when configuration is missing. Machine-agent access does not grant report access. Queries are allowlisted and responses use no-store/no-referrer. Storage errors show unavailable rather than invented zeros.

## Changed places

| Area | Implementation |
| --- | --- |
| Strict contracts | `src/lib/analytics/events.ts`, `report-types.ts`; existing demand schema retained |
| Choice and delivery | `preferences.ts`, `client.ts` |
| Device-local matching | `progress.ts` |
| Action observation | `PublicApp.tsx`, `PromptHandoff.tsx`, `usePackImport.ts`, typed outcome in `import-workflow/prepare.ts` |
| Ingestion, reports, expiry | `worker/analytics/index.ts`, `usage.ts`, `admin.ts`, root Worker dispatch/scheduled hook |
| Database | `migrations/gallery/0009_usage_analytics.sql` |
| Admin interface | `App.tsx`, `AdminUsage.tsx`, `admin-usage.css`; GalleryAdmin reports dirty/busy navigation state |
| Public disclosure | `Privacy.tsx`, `DemandPreference.tsx`, `SiteFooter.tsx`, `Landing.tsx`, `HowItWorks.tsx`, `PackImporter.tsx` |
| Historical assumptions | `docs/website-product-plan.md` explicitly supersedes old analytics-free assumptions |
| Operations | `wrangler.jsonc`, release generator, local test configuration, deployment smoke checks, analytics README |
| Verification | Client/progress/Worker/SQLite/migration tests, preference/app regression tests, dedicated Playwright usage checks |

The admin page loads independently of gallery review. Switching away from dirty review invokes the browser leave guard; active mutations block navigation links. Reporting includes tables and fixed filters, no source-share percentages, trend arrows, user counts, CSV export, or automatic publication decisions.

## Critic dispositions and remaining scope

The technical, privacy, and data-usefulness critics reviewed both the plan and implementation. See [review dispositions](usage-analytics-critic-review.md).

Cloudflare traffic analytics is deferred because its independent script lifecycle needs a verified, accurately described revocation mechanism. This implementation does not create a second traffic preference or imply that the custom-event switch stops a third-party beacon. Failure reasons are deliberately limited to workflow stage and known ZIP outcomes in this release. Underlying storage/network/conflict categorization is deferred rather than inferred from arbitrary messages.

No artwork, R2 publication, geometry, prompt protocol, or source-upload behavior changes are needed. The existing diagnostics CLI remains the source for submitted protocol/tool problem analysis; its denominator is separate.

## Release and activation

Integrate onto current main and preserve concurrent app-recovery changes. Run the full local suite, build/typecheck, lint, local D1 migration/ingestion checks, and Chrome UI/accessibility checks. These prove local behavior only.

A later authorized release must apply migration 0009 through the current main workflow, initially with collection off. Verify both public domains, health, protected diagnostic-budget denial, legacy no-write/config false, v2 false capabilities, and authenticated/unauthenticated admin behavior. Verify Cloudflare logging and account-level beacon injection settings directly. Local tests do not prove deployed Access configuration, provider retention, legal sufficiency, or physical printing.

Activation is separate from deployment. After reviewing staging privacy, abuse-budget, and reporting evidence, enable only authorized streams. Emergency shutdown turns the master flag off while retaining legacy no-write responses, report reads, and cleanup. Never roll back to the old implicit-permission ingestion while collection is enabled.
