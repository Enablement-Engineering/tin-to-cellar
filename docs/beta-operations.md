# Beta operations

This describes the beta implementation candidate. Hosted checks, account notifications and production acceptance are separate evidence; the dated account notification record below identifies the settings actually configured. No production outage test is implied by this runbook.

## Routing and cache

Keep `assets.run_worker_first: true`. The same Worker serves public and admin hostnames, and `/assets/*` requires application authentication on the admin host. Selective path patterns alone cannot retain that host-dependent boundary. Dylan approved P0-6 as **deferred by explicit beta scope exception** on September 12, 2026; it is not complete. Hosted auth, human/machine separation, private no-store and security-header checks remain required. The exception is not deployment authorization. There is one Worker invocation for each request that reaches static-asset dispatch; browser caching can prevent a request entirely. The local browser requested four static paths on cold landing and warm reload. These are request observations, not Cloudflare billing measurements. No new admin deployment is part of beta.

The classic Cache API runs after Worker dispatch/authentication and uses the full URL, including hostname. Do not enable the different front-of-Worker Workers Cache feature on this release. Its default key excludes hostname and could bypass application branches. Test public-warm to admin-unauthenticated and reverse/authenticated variants before release, using actual hosted Access as well as local tests.

`X-Gallery-Cache` reports HIT or MISS for public successful responses. Private responses and errors stay no-store. Image caching is limited to 2 MiB to bound stream tee buffering; packs and larger images stream directly. Metadata/list responses use short cache lifetimes. The cache is local to each Cloudflare location and does not reduce Worker invocation count. Cache eviction/failure falls back to normal bounded storage access.

Each stored response has an absolute request-start deadline. Repeated reads and delayed writes cannot extend it. Serving/readiness validation is reused for up to five seconds, never beyond failed refresh. Unpublish visibility uses the original image cache deadline of at most 60 seconds. The composed release target remains at most 90 seconds for new requests, with no stale-on-error extension. Cache deletion at one location is not global invalidation. Do not promise recall of prior downloads or already-started streams.

## Limits

| Control | Limit | Scope and failure |
| --- | --- | --- |
| Gallery metadata | 120 requests/minute | Cloudflare approximate location-local IP bucket; 429 before D1/R2. |
| Gallery images | 2,400 requests/minute | Separate approximate bucket, including cache hits. |
| Gallery packs | 60 requests/minute | Separate approximate bucket; streaming does not remove admission control. |
| Analytics body | 16 KiB | Enforced while reading, before D1. |
| Analytics batch | 100 canonical IDs, 450 total quantity | Strict validation, 400 for invalid input. |
| Analytics requests | 30 requests/IP/minute | Approximate location-local abuse filter; 429. |
| Analytics daily admissions | At most 1,000/UTC day | Atomic global D1 reservation; 429 when exhausted. Invalid override or zero closes admission. Failed downstream requests consume their reservation. |

The daily allowance bounds accepted aggregate writes, not all requests or hosting costs. Its maximum is 100,000 blend-counter mutations plus 1,000 job-total and 1,000 successful admission mutations per day. Failed admission attempts, catalog reads and index maintenance add D1 work. See [analytics implementation](../worker/analytics/README.md). `ANALYTICS_ENABLED` remains false in the release candidate until privacy, browser and abuse gates are accepted. Missing bindings fail private. The client never waits for collection before printing, retries automatically or retains an offline event queue.

## Visibility

`OPERATIONAL_METRICS_ENABLED=true` emits one sanitized request summary. Fields are fixed event name, bounded route class, HTTP status, rounded duration and an allowlisted cache outcome. It does not include full URL/path/query, IP, headers, body, canonical blend demand or credentials. Private routes share one class. Unexpected request failures return a generic no-store 503 without logging the original exception text. When operational metrics are enabled, these failures receive a fresh random `X-Incident-ID` response header, also recorded as `incidentId` in the existing summary, together with an allowlisted `exceptionClass`. The ID identifies one failed request; it is not stored in a cookie or reused across requests. Exception messages, stacks, arbitrary names and dependency codes are not logged. Handled 5xx responses retain status-only summaries.

Wrangler enables Workers Logs with 10% head sampling and disables invocation logs. Do not enable automatic invocation logs without reviewing their URL/network fields. Sampling means these records are estimates, not exact totals. A response incident ID may have no retained log record because of sampling. This change adds no unsampled counter or alert delivery. Use provider aggregate response-status metrics for 5xx monitoring where available; a handled 503 may not count as an uncaught Worker exception. Verify the selected signal with a controlled authorized check before relying on an alert. Use native Workers metrics for total requests/CPU/errors, D1 metrics for rows read/written, and R2 metrics for Class B operations. Check actual provider retention and access controls during release; this code does not set account retention.

Save a view grouped by route, status and cache outcome. Compare cold/warm image requests, 429s and 5xxs. A rising image MISS share plus R2 reads suggests eviction or uncached large assets; a healthy HIT share does not prove that rights removal or authentication works. Those have separate tests.

The diagnostic allowance is independent of analytics and account billing; neither allowance is an account-wide spending cap. Before release, review the configured policies below and check dashboard metrics for signals without a supported notification type.

### Account notification record — September 18, 2026

The Cloudflare dashboard showed eight enabled policies after configuration. All use the user-selected recipient `dylan@enablement.engineering`. The seven Usage Based Billing policies cover account-wide usage across all projects, rather than Tin to Cellar alone:

| Enabled policy | Configured threshold |
| --- | --- |
| Usage warning - Workers requests | 8,000,000 Standard requests |
| Usage warning - Workers CPU | 24,000,000 Standard CPU milliseconds |
| Usage warning - D1 rows read | 20,000,000,000 rows |
| Usage warning - D1 rows written | 40,000,000 rows |
| Usage warning - R2 Class A operations | 800,000 operations |
| Usage warning - R2 Class B operations | 8,000,000 operations |
| Usage warning - R2 storage | 8,000,000,000 bytes (8 GB) |

The request, CPU, row and operation thresholds represent 80% of the published monthly included allowances. The storage warning is 8 GB against the published 10 GB storage allowance. Review them when plans or pricing change: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), and [usage-based billing notifications](https://developers.cloudflare.com/billing/understand/usage-based-billing/).

The existing `Default budget alert (auto-created)` policy remains enabled at $10 with the same recipient. It was preserved. These eight notifications are warnings, not spending caps or automatic service shutoffs.

The available notification Product list did not offer a Workers, D1 or R2 error category. Cloudflare documents Advanced Error Rate and Origin Error Rate alerts as [Enterprise traffic-monitoring notifications](https://developers.cloudflare.com/notifications/notification-available/#traffic-monitoring); that does not establish their availability for this account or Workers-specific coverage. No HTTP 5xx or runtime-error notification coverage was established. Continue manual dashboard checks of Workers request/CPU/error metrics, response-status metrics where available, D1 reads/writes/storage, and R2 operations/storage. Usage warnings do not replace these checks or a verified incident alert.

The Workers requests policy's Test and Confirm controls were activated once. Although no explicit success toast appeared, the user confirmed receipt on September 18 and supplied a screenshot of Cloudflare's sample email (`fake-product`, 1,500 seconds). This verifies test-email delivery to the selected recipient only. It does not verify a real threshold crossing, every policy's delivery, or outage detection.

## Incident and recovery

1. Disable gallery serving through the authenticated admin settings if community reads are failing or removal cannot be confirmed. Keep local work, admin access and maintenance available.
2. Verify config/list/image behavior after the five-second control window, then from another location. For a single unpublish, check old image/detail/pack URLs and conditional requests through the 90-second target. Record timestamps and statuses without saving private response content.
3. Disable intake/publication separately if the incident concerns writes. Do not use cached control state to admit a mutation.
4. For analytics trouble, turn off `ANALYTICS_ENABLED` or set its daily allowance to zero through the controlled release path. Already-loaded clients can still attempt best-effort requests until they refresh; the server stops storage work when disabled. Printing must remain independent.
5. Inspect sanitized route summaries and platform dependency metrics. Keep the existing storage/admission limits, no-store boundaries and protected diagnostic budget route intact.
6. Restore serving only after the failed dependency/control is healthy. Recovery must not restore unpublished labels. Roll back to a compatible tested Worker if necessary; do not reverse production data migrations or make R2 public.

Already-loaded local work surviving API failure is a beta requirement. Offline startup/reload is not implemented by this change. Physical output remains a separate printer check.

## Release record

Record candidate SHA, current main integration, migration results, workflow/version ID, local tests, real hosted Access/cache checks, health capabilities and the unauthenticated diagnostic budget 403 separately. The artwork coordinator's active publication slot must be released before production migration/deployment. No remote change is needed to perform the local tests.

The generation runner is post-beta. Its future activation must name the credential owner and separate image-generation spend/attempt budget. Website allowances do not pay for or cap those calls.

## Browser security policy

The Worker appends a CSP with same-origin defaults, explicit script/frame hosts, blocked object embeds, no base URL overrides, same-origin form submissions and denied framing. An exact hash permits the pre-paint theme bootstrap. Local blob images and workers support pack import, OCR and PDF processing. Inline styles remain necessary for label geometry and React style properties.

CellarPack validators are generated at build time with `npm run cellarpack:validators`. The browser does not compile schemas, and the policy excludes JavaScript `unsafe-eval`. The narrower `wasm-unsafe-eval` permission supports local OCR WebAssembly. Build/dev/test entry points generate the ignored validator module from the checked-in schema and generator; do not hand-edit its output. Security tests verify that dynamic JavaScript compilation is blocked while local OCR and PDF imports still work.

Local security tests exercise theme startup, actual OCR/PDF processing, imported print artwork, injected script rejection and frame denial through the built Worker. Hosted Turnstile, YouTube and Cloudflare Access compatibility still require release checks.
