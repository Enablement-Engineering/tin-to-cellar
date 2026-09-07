# Gallery request admission

Public gallery requests are classified before database access. Unknown routes,
invalid resource IDs, and unsupported methods return 404. Non-GET requests also
retain the same-origin requirement.

Supported requests have separate per-IP allowances, using the existing salted
daily IP hash:

| Request | Binding | Allowance |
| --- | --- | --- |
| Public reads | `GALLERY_READ_RATE_LIMITER` | 120 per minute |
| Submission POST, including failed challenges and reservation replays | `GALLERY_MUTATION_RATE_LIMITER` | 20 per minute |
| Artwork PUT | `GALLERY_UPLOAD_RATE_LIMITER` | 5 per minute |

These checks run before body reads, D1 queries, R2 access, and Turnstile
verification. Missing bindings or salt fail closed. An exhausted allowance
returns 429 with `Retry-After: 60`.

Request admission does not replace reservation quotas. A new reservation still
uses `GALLERY_RATE_LIMITER` (5 per minute) and the database capacity limits.
Artwork upload still has a durable three-attempt cap. Successful reservation
replays do not spend another reservation quota, but do consume request admission.
Human and machine review keep their existing authentication and quota boundaries.

The mutation limiter uses namespace 1009 in production, 2009 in generated staging
configuration, and 9004 in the disposable local gallery harness. Deploy the Worker
and its configuration together; no new database migration is required. The public
configuration reports intake closed when the mutation limiter is missing.

Regression coverage in `worker/gallery/security-audit.test.ts` exercises denied,
missing, and failed admission; unsupported routes and methods; failed challenges;
and reservation replays. `tests/accessibility/feedback.pw.ts` uses the diagnostic
ownership capability and verifies that a different capability cannot attach notes.
