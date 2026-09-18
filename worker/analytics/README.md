# Optional usage collection

The public app uses explicit opt-in and version-2 endpoints. Version-1 config is
always false and version-1 ingestion never writes. All production flags remain
false. Cloudflare Web Analytics is deferred; no beacon is included.

`ANALYTICS_ENABLED` gates all collection. `WORKFLOW_ANALYTICS_ENABLED` and
`PROGRESS_ANALYTICS_ENABLED` independently gate generic events and locally
matched progress. GALLERY D1 and ANALYTICS_RATE_LIMITER are required. Configure
that limiter for 30/IP/minute. It is approximate and location-local. IPs are not
stored in these tables. Request bodies, ordinary network details, and errors
must not be logged by this module.

`ANALYTICS_DAILY_ALLOWANCE` defaults to 1,000 shared admissions, cannot exceed
1,000, and fails closed for invalid values or zero. Reservation is atomic and
nonrefundable. A demand batch can mutate at most 100 canonical blend counters
plus a job total. Each workflow/progress request increments one aggregate.
Admission triggers and successful-recording updates add bounded bookkeeping.
This allowance does not cap rejected-request work, admin reads, or Cloudflare
billing. Multiple events from one action can consume multiple admissions.

Apply migration 0009 before releasing this implementation. It adds daily workflow
counters, weekly progress counters, admission history triggers, and expiry status.
No raw event log, visitor identifier, or local request identifier is stored.
Progress payloads contain only version, starting week, milestone, and elapsed
bucket. Catalog demand retains canonical IDs and print quantity. The browser's
matching metadata stays local and expires after 30 days; no retries or offline
queue are used. Repeated malicious requests can still affect counts.

The public UI loads collection through `src/lib/optional-usage.ts` only after
opt-in. Its dynamic `analytics/runtime.ts` dependency may fail without stopping
the application. Local choices and record cleanup live outside that dependency.
Actions before readiness are dropped. Failed imports, failed configuration, and
blocked or uncertain deliveries stop collection for the current document; there
is no fallback URL or retry queue. A normal page reload may try again. Opt-out
invalidates pending initialization and aborts outstanding requests where possible.
An already accepted server write cannot be recalled.

GET `/api/analytics/v2/admin/summary` and `/blends` are dispatched only inside the
root Worker's human-authenticated, exact admin-host branch. Reports remain
readable with ingestion off. Public-host reads are denied. Parameter enums,
periods, page size, and numeric cursors are bounded. A failed read is unavailable,
not zero. The private interface is `/usage` on the configured admin host.

Scheduled cleanup runs even when collection is disabled. It removes aggregate
rows older than the 365-calendar-day cutoff, using the cohort week for progress.
Deletion is bounded to 5,000 rows per table per run. Cleanup status exposes a
remaining backlog or failure; rerun the scheduled handler locally for testing,
and use the existing controlled Worker operations in production. Do not disable
cleanup as part of an ingestion shutdown or drop historical tables on rollback.

Verification commands:

- `npm test`
- `npm run build`
- `npm run lint`
- `npm exec -- playwright test --config playwright.usage.config.ts`
- `npm run test:usage-resilience`

The browser suite starts an isolated local Wrangler/D1 instance on port 43931.
It uses synthetic admin UI responses, not real Access credentials. Root Worker
tests cover denial boundaries; deployed human Access needs a separate check.

The resilience suite uses separate development and built-asset servers on ports
43942 and 43943. It mocks API responses and blocks optional scripts and requests.
The isolated build checks that analytics modules are absent from the initial
static dependency graph, then reports the actual chunk URLs to the tests. Its
build and report stay in ignored `output/usage-resilience/`.

For release and activation boundaries, field contracts, action units, known
coverage limits, and all changed locations, see
[the implementation plan](../../docs/usage-analytics-implementation-plan.md).
