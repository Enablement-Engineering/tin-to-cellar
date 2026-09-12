# Beta operations

This describes the local beta implementation candidate. Hosted checks and account notifications remain separate release evidence. No production outage test or account setting change is implied by this runbook.

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

`OPERATIONAL_METRICS_ENABLED=true` emits one sanitized request summary. Fields are fixed event name, bounded route class, HTTP status, rounded duration and an allowlisted cache outcome. It does not include full URL/path/query, IP, headers, body, canonical blend demand or credentials. Private routes share one class. Unexpected request failures return a generic no-store 503 without logging the original exception text.

Wrangler enables Workers Logs with 10% head sampling and disables invocation logs. Do not enable automatic invocation logs without reviewing their URL/network fields. Sampling means these records are estimates, not exact totals. Use native Workers metrics for total requests/CPU/errors, D1 metrics for rows read/written, and R2 metrics for Class B operations. Check actual provider retention and access controls during release; this code does not set account retention.

Save a view grouped by route, status and cache outcome. Compare cold/warm image requests, 429s and 5xxs. A rising image MISS share plus R2 reads suggests eviction or uncached large assets; a healthy HIT share does not prove that rights removal or authentication works. Those have separate tests.

Before enabling the beta, the release owner must inspect the account's supported billing/usage notifications and configure authorized recipients and thresholds. Record which Workers, D1 and R2 alerts are actually supported/enabled, and a dashboard check for anything unavailable. Do not claim notifications exist because this file describes them. The diagnostic allowance is independent of analytics and account billing; neither allowance is an account-wide spending cap.

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
