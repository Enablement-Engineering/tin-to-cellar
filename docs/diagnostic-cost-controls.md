# Diagnostic allowance and the $5 target

The operating target is the existing $5/month Workers Paid plan with no additional usage charges. Diagnostic collection pauses at a daily allowance; local label creation, import, and printing remain available. The allowance applies to validated submission attempts, including optional process notes, duplicates, and attempts whose later storage operation fails. Reservations are not refunded.

## Configuration

`DIAGNOSTIC_DAILY_ALLOWANCE` defaults to `1000`. This is a conservative starting operational limit, not a calculation of unused account credit. `DIAGNOSTIC_COLLECTION_ENABLED=false` pauses sharing manually. Invalid configuration or an unavailable allowance store blocks collection. The existing `CatalogContributions` Durable Object holds one atomic counter shared by both submission endpoints. It resets at midnight UTC, with no scheduled reset job or new database required.

The last admitted attempt can succeed while exhausting the allowance. Later attempts return `429`, `code: collection_paused`, `resetAt`, and `Retry-After`. A manual pause returns `503` with the same code and no promised reset time. Browser receipts show the pause without blocking labels or repeatedly retrying. Source lookups have a separate burst limit of 60 requests per minute per IP. This burst limit is not a global spending counter.

The protected `GET /api/labels/diagnostics/budget` endpoint uses `DIAGNOSTICS_READ_TOKEN`. It returns only the UTC day, used attempts, limit, paused state, next reset, and last exhaustion time. The exhaustion time survives daily rollover so a morning check can detect yesterday's pause. It does not export diagnostic reports, URLs, or personal notes.

Run `npm run diagnostics:budget` with the read token in the ignored `.env.diagnostics` file or local environment. Set `DIAGNOSTICS_BASE_URL` for a staging or local server. Remote checks require HTTPS and reject redirects. A missing endpoint or denied request is an error, never reported as zero usage.

## Notification and billing limits

The existing Codex budget monitor checks daily at 9 a.m. and reports a newly observed pause or material billing concern in the originating task. It is a periodic check, so notification may arrive after the pause. The app does not send email or create a new paid alert service. The pause itself happens synchronously at submission admission, independently of the monitor.

Cloudflare's paid plan has included allowances and metered overages. Those allowances are shared across the account. Rejected requests, source reads, the gallery, other projects, storage retention, and existing subscriptions remain outside this diagnostic admission counter. It cannot guarantee a $5 total bill. Verify account-wide usage before release and lower or disable diagnostic intake if the available margin shrinks. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) were checked September 7, 2026.

## Release checks

1. Review and deploy this branch using the normal release process. Local tests do not activate the production pause.
2. Verify the aggregate endpoint with the existing read credential. Check an unauthenticated request is refused.
3. In local or staging configuration, set an allowance of one and submit synthetic diagnostics twice. Verify the second response pauses and printing still works. Restore the intended allowance before production release.
4. Confirm the Codex monitor can read deployed aggregate status and billing. Do not export raw diagnostics for a budget check.

Local verification on September 7: 342 unit/integration tests passed; the 50 passing browser checks from the full run plus the corrected four-test feedback rerun cover all 52 browser cases. The rerun verifies actual local Worker report/note writes as well as paused-state keyboard focus and automated accessibility checks. The browser bootstrap now applies local diagnostic migrations, so a fresh worktree does not depend on an earlier developer database. Build/typecheck and lint passed. These checks use synthetic local data and do not establish production billing or deployment status.

## Performance work completed

The baseline initial JavaScript was 850.99 kB gzip. The completed integration reduces the entry to about 290.78 kB gzip. Lightweight protocol metadata no longer imports historical instruction bodies; prompt, admin and gallery code loads when needed. Browser checks cover initial network size and deliberate reload recovery after a failed instruction download. All 22 historical protocol releases remain unchanged.

The Durable Object now initializes a retained-report count once and updates it transactionally with insertion and expiry. Warm admission performs no report-list scan. The pre-existing 1,000 retained-source-report limit remains distinct from daily diagnostic admission. See the [current release record](codebase-review-work-plan.md) for combined validation and operational status.
