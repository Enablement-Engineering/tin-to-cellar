# Community gallery operations

Implementation is available in the isolated development checkout. **No hosted gallery deployment or provisioning has occurred.** The production Wrangler configuration keeps gallery switches off and has no gallery D1/R2 bindings. Passing local checks does not establish hosted authentication, storage configuration, or physical printer alignment.

The [implementation plan](gallery-implementation-plan.md) records the design; this guide describes the implemented operational boundaries. Use npm for all project commands. Do not deploy the local test harness.

## Workflow and data boundaries

Opening a ZIP, inspecting a sharing preview, and printing remain local. A contributor explicitly selects up to five labels and submits them sequentially. Each selected PNG and strict metadata record receives its own private reservation and review state. The original ZIP, arbitrary manifest extensions, private research, and diagnostics are not gallery payloads. Ordinary import diagnostics and source observations remain separate; trusted built-in examples and in-app gallery imports suppress those contributions.

Contributors need no account. After successful upload, the website shows “Submitted for review.” There are no contributor status links, private-preview endpoints or withdrawal controls. An internal same-tab nonce authorizes reservation/upload retries only; it is not exposed as a recovery link. Dylan manages submitted labels through private review, rejection and unpublishing.

At `/admin/gallery`, the reviewer checks full-resolution canonical artwork, blank-area geometry, identity, optional edition and alternative text, and any private review evidence. Corrections invalidate the previous review digest. An unknown blend must be mapped to an active repository catalog entry before publication. Approval publishes that exact version; image replacement requires a separate submission. Exact published duplicates link to the existing publication and the duplicate submission is scheduled for removal.

Public browsing at `/gallery` and downloads pass through `/api/gallery/v1/labels`. Every detail, thumbnail, artwork and pack request checks current publication state using a primary-consistent D1 session and returns `Cache-Control: no-store`. There are no public R2 URLs. Unpublish stops subsequent public requests, including previously copied URLs; an in-flight response or an earlier download cannot be recalled.

PNG normalization validates signature, chunk order/CRC, complete bounded inflation, filters, dimensions and color format. It strips ancillary metadata, preserves decoded pixels and supported sRGB intent, and creates an alpha-aware 320px thumbnail. Conflicting profiles are rejected. Untagged RGB is interpreted under the sRGB submission contract. Private text drawn into pixels is still visible and must be reviewed.

Approval binds canonical artwork hash, canonical metadata hash, catalog ID and format version. Downloadable one-label CellarPacks contain the same full-resolution canonical PNG bytes, never a thumbnail or added date overlay. Their research is explicitly limited; contributor reference links do not claim independent retrieval, licensing, or verified original AI research. Hash equality proves byte identity, not authorship or packaging fidelity.

## Local commands

From the implementation checkout:

```sh
npm ci
npm run gallery:dev
```

`gallery:dev` builds the site and starts the actual Worker with local D1/R2 on `http://127.0.0.1:43928`. Each run creates a fresh ignored `.wrangler/gallery-*` configuration/state directory, applies only gallery migrations, seeds 1,482 catalog entries, and enables the local database switches. It does not touch remote resources. Normal mode still requires production authentication configuration; its empty Turnstile site key leaves submission unavailable and admin access fails closed.

For the complete synthetic local workflow:

```sh
npm run test:gallery
```

This builds and runs Playwright against real local Worker/D1/R2 storage. It uses Chrome through Playwright's `chrome` channel and starts its own server. `tests/gallery/test-worker.ts` supplies synthetic admin/challenge verification only for this test entrypoint. The production Worker never imports it. Do not copy test headers, challenge values, local salts, or the test entrypoint into a deployment. Traces are retained on failure.

Optional existing-pack tests require explicit local file paths. Set `GALLERY_TEST_PACKS` to a JSON array of absolute CellarPack ZIP paths before `npm run test:gallery`; the test selects the first usable label from each pack. `GALLERY_TEST_REJECTED_PACK` accepts one otherwise valid PNG pack with an unsupported ICC profile for the rejection case. These tests perform local-only submission, fixture approval, download/reimport and admin unpublishing. They save ignored screenshots/PDFs under `output/gallery/`. They never scan Downloads or use personal files by default. See [local validation](gallery-validation.md) for results and limits.

Focused checks and the repeatable maximum-image measurement:

```sh
npm test -- src/lib/gallery src/lib/tobacco-catalog worker/gallery
npm test -- src/lib/gallery/image.test.ts --silent=false --reporter=verbose
npm run lint
npm run build
```

The PNG test uses original synthetic artwork. Its printed normalization elapsed time is a local measurement, not a hosted CPU guarantee. Also run the repository protocol-history check against the verified implementation base when preparing a release.

Prepare an additive catalog seed without applying it:

```sh
npm run gallery:seed -- /tmp/gallery-catalog.sql
```

The script only writes SQL. Catalog IDs are explicit and preserved by `data/catalog/identities.json`; see [catalog maintenance](../data/catalog/README.md). It never deletes referenced catalog rows. Apply the seed only to the separately configured gallery database under the appropriate release authorization. Do not run gallery SQL against `DIAGNOSTICS`.

## Hosted prerequisites and switches

Before an authorized staging release, supply actual resource/configuration values:

| Binding or setting | Required configuration |
| --- | --- |
| `GALLERY` | Separate D1 database; apply `migrations/gallery/0001_gallery.sql`, then the catalog seed. |
| `GALLERY_ART` | Private R2 bucket; keep public custom domains and `r2.dev` access disabled. |
| `GALLERY_RATE_LIMITER` | Worker rate-limit binding, five new reservations per 60 seconds per daily hashed IP key. |
| `GALLERY_IP_SALT` | Private unpredictable deployment secret, distinct from the local harness value. |
| `GALLERY_TURNSTILE_SITE_KEY` / `GALLERY_TURNSTILE_SECRET` | Actual site key and secret for each permitted hostname. Server checks hostname, `gallery-submit` action and fresh challenge timestamp. |
| `GALLERY_ACCESS_ISSUER` / `GALLERY_ACCESS_AUD` / `GALLERY_ADMIN_SUBJECT` | Actual Cloudflare Access issuer, audience and Dylan's chosen subject. Worker verifies signed RS256 JWTs, expiry and subject; a plain email header is insufficient. |
| `GALLERY_INTAKE` / `GALLERY_PUBLICATION` / `GALLERY_SERVING` | String values `true` only when enabling the corresponding feature. All default to `false`. |
| `gallery_settings` row `id=1` | Corresponding `intake`, `publication`, `serving` integer switches must also equal 1. Missing settings fail closed. |

Protect the entire dedicated admin host with human Access and the more-specific agent namespace with its separate machine application. Keep Worker-first handling enabled for all paths; keep `workers_dev` and preview bypasses disabled. Mutation requests require the same Origin. Verify these properties on the real deployed routes before enabling use.

Confirm the actual Cloudflare account plan, CPU allowance, budget, and private resource configuration before any provisioning or upgrade. The bounded PNG path must be measured in the hosted Worker runtime. No image-generation provider calls are part of this workflow. Dylan approved `dylan@enablement.engineering` as the public artwork-concerns contact and reviewer email. About, Privacy, and the gallery link to this address and ask for the relevant label or page link and a short explanation. Final launch copy and hosted Access configuration remain release checks; the contact route does not claim legal immunity.

## Limits, retention and cleanup

| Item | Implemented default |
| --- | --- |
| Artwork intake | Static, non-interlaced, 8-bit RGB/RGBA PNG; 8 MiB input; square 825–2048px; canonical output at most 18 MiB. |
| Geometry | 2.5-inch circle, 0.125-inch bleed/safe inset, one artwork-owned blank writing area; Avery 94502. |
| Metadata | 16 KiB; up to three selected public references; 1,500 characters per URL; 120-character edition; 320-character alternative text; 160-character unknown maker/blend. URL screening is not a promise that every accepted link is free of private information. |
| Reservation / operation lease | Reservation expires after one hour; upload/publication lease is five minutes. Identical retries are supported; changed input requires a new submission. |
| Admission | 20 labels/day per daily salted IP hash; 100/day site-wide; 500 reserved/uploading/pending/preparing items; 1 GiB active input bytes. |
| Capacity accounting | Reserve 40 MiB per submission against an 8 GiB admission ceiling, reconcile published records to stored asset sizes. This is application accounting, not a provider-enforced spending cap; orphan files await cleanup. |
| Pending / unpublished | Pending expires after 30 days; unpublished copy is retained for 30 days for explicit republication. |
| Rejected | Object deletion becomes due after seven days. Admin unpublishing stops public access immediately and has its separate 30-day retention. |
| Review records | Minimal private review records expire after 90 days from the terminal decision or expiry processing. Full metadata is redacted at its read-time retention deadline even if cleanup fails. |
| Quota hashes / orphans | Daily admission counters expire within 48 hours; submissions do not retain quota hashes. Unreferenced objects have a 24-hour grace period. |

The existing `17 4 * * *` schedule runs gallery and diagnostics cleanup independently. Gallery cleanup recovers expired operation leases, expires due submissions, claims at most 50 deletion records, and deletes objects before releasing accounting and clearing metadata. A failed object deletion keeps the record for retry. The orphan sweep processes one 100-object page per tick with a persisted cursor and respects live leases. Object keys include the operation version so old-orphan cleanup cannot delete a later retry's object.

Deletion dates are due dates, not proof of completed erasure. Daily scheduling, backlog and provider failures can delay physical deletion; read-time visibility rules still apply. Inspect aggregate cleanup results (`deleted`, `failures`, `orphans`) and verify retries during hosted validation. Do not log capabilities, raw IP addresses, private artwork or notes. Provider backup behavior requires separate verification; this implementation makes no immediate backup-erasure promise.

## Rollback and release validation

For an intake incident, disable `intake` in `gallery_settings`; for moderation pause disable `publication`; for immediate public serving shutdown disable `serving`. Matching environment flags provide an additional deployment-level gate. A stale frontend cannot bypass backend switches. Preserve admin access, cleanup, and ordinary local printing while intake is paused. Do not roll back to a Worker that abandons retention jobs, destructively reverse migrations, or make the bucket public.

Before separately authorized hosted release, verify the recorded deployment identity, actual Access/Turnstile behavior, private R2 settings, schema/seed separation, and flags. Use controlled original synthetic artwork to exercise unauthorized denial, explicit upload, admin private preview, stale-digest rejection, approval, download/reimport/print preview, admin unpublish, old direct URLs and conditional requests, cleanup failures and eventual deletion on both domains. Verify the real admin and contributor browser flows, narrow viewport and keyboard access. Remove synthetic staging data afterward.

Local validation, hosted readiness, packaging fidelity and physical print calibration are separate outcomes. Review the PDF and a physical calibration sheet before claiming printer alignment. No hosted deployment is authorized or established by these instructions.

## Saved label format

Gallery submissions use the v2 `GalleryLabelDraft` contract: tobacco identity, artwork profile, writing-area geometry, optional edition and alternative text, optional private evidence, image measurements, and consent acknowledgement. Public records expose identity, artworkProfileId, optional edition, and altText once. Research is optional in CellarPack exports. See [the one-time metadata migration](gallery-label-metadata-migration.md) before deploying this contract over existing records.
