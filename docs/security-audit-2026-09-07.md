# Security audit, September 7, 2026

Remediation is implemented locally on `codex/security-hardening-20260907`. See [the remediation record](security-remediation-2026-09-07.md) for changes, validation, and release prerequisites. The findings below describe the original audited behavior, not the patched candidate.

The resumed audit confirmed five issues worth addressing before public launch. Two expose gallery processing and storage to repeated work, two affect diagnostic integrity and availability, and one permits framing of the public interface. No account takeover, private-data disclosure, or arbitrary code execution was demonstrated.

## Scope and evidence

Audited source: `eed00d21a562264a51a32d85fc5e2df85a247704`, fetched from origin/main on September 7. The original audit used `5b6765f`; the resumed checkout includes the newer archive JSON trust-boundary fixes. Work is isolated at `/private/tmp/tin-security-audit-20260907`. Application code has not been patched, committed, pushed, or deployed by this audit.

Storage and submission reproductions use in-memory SQLite, synthetic PNGs, fake storage, and controlled rate-limit responses. Production checks were limited to page rendering, response headers, health, and unauthenticated export/budget access. No production submission, quota exhaustion, or load test was performed. Cloudflare dashboard rules were not inspected, so application-level gaps do not establish the absence of every edge protection.

The original audit tests intentionally asserted the vulnerable behavior. During remediation, those tests were converted to rejection and bounded-work expectations. The results recorded below are historical audit evidence.

## 1. Gallery asset requests have no application rate limit

Priority: address before launch. Impact: repeated database and object-storage reads and response buffering.

`worker/gallery/routes.ts`, public `/labels/:id/artwork`, `/thumbnail`, and `/pack` routes call `assetResponse`. It reads D1 metadata and R2 and buffers the object with `arrayBuffer()`. Responses have `Cache-Control: no-store`. The gallery limiter currently applies to new submission admission only.

Local evidence: after publishing a fixture, eight anonymous pack requests returned 200 and caused eight bucket reads even when the configured limiter rejected every call. The route never consulted it. This proves repeated origin work, not a measured bill increase or production outage.

Recommended patch: introduce a separate public-read limiter before database/storage work, with a browsing-appropriate allowance. Do not share the five-per-minute submission allowance with gallery thumbnails. Consider streaming assets and deliberate cache policy, while preserving immediate withdrawal/unpublication behavior. Test blocked reads without any bucket access, normal gallery scrolling, and withdrawn asset denial.

## 2. Artwork retries bypass upload-attempt accounting

Priority: address before launch. Impact: repeated body hashing, PNG validation, and database state updates against one reservation.

`worker/gallery/routes.ts` handles artwork PUT without consulting an attempt limiter. A processing failure resets the submission to `reserved`. Admission counters in `worker/gallery/admission.ts` and the database trigger count the initial reservation, not each retry.

Local evidence: one admitted PNG with an invalid final CRC was retried eight times. Every response was `400 unsupported_image`, the limiter was never called, the row version reached 17, and site admissions remained 1. This particular fixture fails before decompression; it proves repeated parsing/CRC checks, not repeated full image decoding. It requires a valid reservation/capability, and production reservation creation requires Turnstile. Expiration, image-size limits, and the Worker CPU ceiling remain protections.

Recommended patch: bound attempts per submission and apply an upload-specific rate limit before reading/hashing the body. Make attempt accounting atomic with the upload lease. Distinguish permanent invalid artwork from transient storage failures and permit a bounded recovery path. Test repeated malformed input, concurrent retries, storage failure recovery, and successful-upload idempotency.

## 3. Diagnostic notes accept a known report ID as authority

Priority: medium. Impact: false process notes enter the private diagnostic export and prevent later legitimate notes.

`worker/diagnostics.ts:shareNotes` verifies the report exists and its protocol revision matches. It does not require an ownership capability. `INSERT OR IGNORE` gives the first note precedence, and different later notes receive 409. A same-origin header is a browser request boundary, not authentication for arbitrary HTTP clients.

Local evidence: an unauthenticated request using a known synthetic report ID inserted a note; the legitimate note then received 409; the private export contained the inserted text. Report IDs are 64-character hashes and were not shown to be publicly enumerable. However, the client derives an ID from manifest JSON, so it should not be treated as an independent secret by anyone possessing that manifest.

Recommended patch: define explicit authority for attaching notes. Issue a scoped receipt capability when the report is accepted, store its hash, and require it for note writes; wire that receipt through the intended browser/agent workflow. If notes are intentionally open contributions, preserve them as separately attributed untrusted observations rather than allowing one writer to occupy the report's only note slot. Test missing/wrong capabilities, receipt recovery, duplicates, and conflicting notes.

## 4. Duplicate diagnostics consume the shared daily allowance

Priority: medium. Impact: diagnostic collection can pause despite almost no new stored data.

`worker/contributions.ts:contributionsResponse` and `worker/diagnostics.ts:shareNotes` call `admitDiagnostics` before deduplication. The budget deliberately charges attempts, including duplicates and failed persistence. Production configuration sets a shared daily allowance of 1,000 and a contribution limiter of three requests per minute. Anonymous submissions do not require a challenge. The allowance limits writes but does not guarantee fair access to collection.

Local evidence: with the real `budgetResponse` implementation configured to three admissions, one report followed by two identical anonymous submissions exhausted the counter. Only one report was stored. A different valid report then received 429. A separate note test reproduced duplicate charging. The admission tests allow requests through the mocked per-IP limiter; they do not demonstrate bypassing Cloudflare's limiter or exhausting production's quota.

Recommended patch: retain a request/work allowance for cost protection, but separate it from a unique-record allowance. Return exact duplicates without consuming a new unique-record slot. Consider per-client daily allocation or a challenge for new anonymous writes. Keep accounting atomic and ensure failure handling cannot refund uncertain writes twice. Test duplicates, unique reports from different clients, reset boundaries, concurrent admission, and exhausted-budget behavior.

## 5. The public create page can be framed by another origin

Priority: medium hardening. Impact: a third-party page can place the interface inside an iframe, enabling potential UI deception.

On September 7 at approximately 20:42 UTC, `/labels/create` returned 200 without Content-Security-Policy or X-Frame-Options. Chrome rendered the live page's main element inside a synthetic `https://audit.invalid/` page. See `tests/security/framing.pw.ts` and `output/security-frame.png`. No deceptive click or state-changing action was performed. This does not prove administrative framing or cross-origin access to local files.

Recommended patch: set CSP `frame-ancestors 'none'` if embedding is unsupported and use `X-Frame-Options: DENY` for older clients. Apply the response policy consistently to public and authenticated HTML. A broader CSP should be tested against Turnstile, local blob image previews, PDF/OCR workers, and optional video embedding before enforcement. Test that a foreign iframe cannot render the page while direct navigation and those workflows still work.

## Checks completed

- Full unit suite: 65 files, 434 tests passed on the updated checkout.
- After adding the real-budget reproduction and correcting the PNG test wording: both audit files passed all six tests. The full suite was not rerun after that test-only addition.
- Production framing browser test: one passed, confirming frameability.
- Production build including TypeScript: passed. Vite reported existing large-chunk warnings.
- Lint and a final TypeScript check after the test addition: passed.
- Live health returned `status: ok` with `diagnostic-budget-v1`, `curated-intake-v1`, and `curated-reconcile-v1` capabilities.
- Unauthenticated diagnostic export and protected budget requests both returned 403. Authorized budget contents were not read.

Existing archive rejection and gallery authentication tests also passed in the full suite. These results support those tested boundaries, not a claim that every vulnerability has been ruled out. The live health response does not identify an exact deployed commit.

## Reproduction commands

Run from the isolated audit checkout:

```sh
npm test -- worker/security-diagnostics.test.ts worker/gallery/security-audit.test.ts
npx playwright test --config playwright.security.config.ts
npm run build
npm run lint
```

The browser test now checks the local patched Worker and requires a build first. The two unit files use local fixtures only. Release fixes through current origin/main and verify health plus protected budget access after deployment.
