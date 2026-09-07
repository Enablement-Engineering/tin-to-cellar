# Security remediation, September 7, 2026

This candidate addresses all five findings in [the audit](security-audit-2026-09-07.md). It is not a production deployment.

## Changes

- Gallery reads require an independent per-IP allowance of 120 requests per minute before D1/R2 access. Uploads require a separate five-per-minute allowance before the request body is consumed. Missing bindings fail closed. Throttled requests return 429 with `Retry-After: 60`.
- Each public artwork reservation permits three processing attempts. A database update consumes the attempt atomically with the upload lease. Malformed input, hash mismatch, storage failure, and abandoned leases cannot refund the attempt. Successful uploads remain idempotent. The UI distinguishes temporary throttling from exhausted attempts and invalid artwork.
- New diagnostic reports can carry a random 256-bit browser capability. Only its hash is stored on the report. Attaching notes requires the matching capability, and a duplicate report cannot transfer ownership. The browser retains up to 100 receipts in tab session storage, with an in-memory fallback. Receipts never enter the pack or diagnostic export. Existing reports without a capability remain unclaimable; the UI explains when notes cannot be attached from this tab.
- Exact report and note duplicates no longer spend another daily allowance slot. Atomic resource reservations also prevent concurrent duplicates from double-charging. Failed or uncertain writes retain their reservation for retry. Reservations expire by day and an alarm cleans them up. The existing per-IP request limit remains in front of these checks.
- Every Worker response includes `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`. Existing CSP policies remain intact. The policy does not restrict Turnstile, blob previews, OCR/PDF workers, or video sources.

## Release prerequisites

Use the current origin/main release workflow. The original research checkout remains on `preserve/local-main-2026-09-07` and must not be used for release. The other code-quality task owns the clean main checkout at `/Users/dylanisaac/Projects/tin-to-cellar-quality` and was notified of these changes.

The current `.github/workflows/deploy.yml` already applies both database migration directories before uploading the Worker. These additive migrations must succeed in that release procedure:

- `migrations/0002_diagnostic_ownership.sql` for DIAGNOSTICS.
- `migrations/gallery/0004_upload_attempts.sql` for GALLERY.

Deploy the new `GALLERY_READ_RATE_LIMITER` and `GALLERY_UPLOAD_RATE_LIMITER` bindings with the code. Production namespaces are 1007 and 1008. Release preparation uses distinct staging namespaces 2005/2007/2008 and preserves production diagnostic controls. No new secret is required; gallery throttles reuse the existing salt.

Do not remove the new columns when rolling application code back. The old code can ignore additive columns but would reopen the original security gaps. After deployment verify direct browsing, blocked framing, gallery browsing and submission recovery, diagnostic report/optional-note sharing, health, and unauthenticated denial plus authorized access to the protected diagnostic budget endpoint. No production migration, write, or deployment was performed by this task.

## Remaining boundaries

These limits bound application work; they are not a global bot-abuse guarantee. Many clients can still submit distinct valid reports and consume the finite diagnostic allowance. Ownership means possession of the receipt established at first report insertion, not proof of the identity of an anonymous report's author. A known existing report ID cannot attach notes or take ownership. Closing the original tab or clearing its session storage can lose the receipt, so those notes remain local.

Gallery read responses remain uncached to preserve prompt withdrawal/unpublication. The request limits mitigate repeated origin work without adding a cache invalidation contract. Production Cloudflare limits and delivery still require post-deployment verification.

## Validation

The candidate includes origin/main through `6b7748cc93a251e55e1074cdad29ab7eba0f5dce`, including the other task's enum-contract follow-up.

- Full unit suite: 67 files, 466 tests passed.
- Production build with TypeScript and lint: passed. Existing Vite large-chunk warnings remain.
- Gallery browser suite: all five tests passed against local workerd, D1, and R2, including public submit/review/publish/import/print, curated intake, machine grants, revocation, and withdrawal.
- Frame browser check: passed. The test uses two real local HTTP origins and checks Chrome's frame-ancestors violation, avoiding false positives from local-network blocking. Direct create-page navigation remains usable.
- `npm run diagnostics:smoke`: passed against disposable local workerd/D1/DO state. Missing/wrong capabilities returned 403; report and note duplicates preserved the allowance; manual pause/resume, finite unique-resource admission, protected budget access, private export, and restart persistence passed.
- Both new migrations applied successfully to local D1. Diagnostic tests cover parent replacement and expiry during budget admission; the note INSERT now checks ownership and expiry atomically.
- Independent agent review covered framing/configuration and diagnostic ownership/concurrency. The identified note-write race was fixed and reproduced in regression tests.

Application changes remain isolated from community-resource research work. No production results are claimed for this candidate.
