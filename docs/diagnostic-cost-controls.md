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

## Performance work remaining

The current-upstream baseline build produced a 3,449.55 kB initial JavaScript bundle (850.99 kB gzip). The archived protocol registry alone occupies 2,096,069 source bytes; both current handoffs and synchronous historical repair prompts import it. Defer historical instructions until a repair needs them, preserving immutable release contents and offline handoff behavior. The build also identifies a static CellarPack import in gallery pack-building that prevents the existing dynamic import from creating a separate chunk. These need a separate loading and focus review across the newer saved-label workflow.

The Durable Object still lists up to 1,000 retained reports to enforce its legacy storage capacity. Replacing that scan needs an initialized count reconciled transactionally with expiry cleanup and migration. The daily allowance reduces new diagnostic writes but does not replace that retained-record limit. Neither performance change is claimed complete in this branch.
