# Gallery release status

Production deployed, September 6, 2026. PR #3 merged after explicit user approval at commit `30598bb4652f7bdbf561714bd4ff31df039832cf`. GitHub Actions run `34065368814` succeeded, deploying Worker version `1f9c90fb-e097-4197-8774-28620573fdf3`. Human moderation, public download and production advisory-agent checks passed. Workers Paid was already activated by the user and remains active.

## Resource record

Account: `97e5d454f1ad2daae1c6d42a5d4c09dd`.

| Environment | Worker / bucket / database name | Database ID | Public host | Admin host |
| --- | --- | --- | --- | --- |
| Staging | `tin-to-cellar-gallery-staging` | `9c01083d-9cba-4263-bd4e-7f21a2b93fef` | `gallery-staging.tintocellar.com` | `admin-staging.tintocellar.com` |
| Production | Worker `tin-to-cellar`; bucket/database `tin-to-cellar-gallery` | `37bebdd3-76f1-44cf-839a-c8a980113d87` | `tintocellar.com`, `www.tintocellar.com` | `admin.tintocellar.com` |

Both D1 databases and R2 buckets have been created. Both buckets have `r2.dev` access disabled and no bucket custom domains. Separate managed gallery Turnstile widgets are created; private widget secrets are installed in the Workers and their temporary local response copies were removed. Neither the existing diagnostics database nor Scribely Access applications were modified.

The CLI OAuth credential could not manage Access; setup proceeded through a temporary account-scoped credential. Human and machine Access applications are now configured with separate audiences, recorded in the ignored resources.json setup record. Service credentials are securely saved outside source and chat, and Worker secrets are installed in both environments. The temporary setup token was deleted through the UI; a follow-up API request returned 401 Invalid API Token, confirming revocation. Temporary setup-secret copies were removed; protected ongoing agent credential files remain. Never paste credentials into tasks or source.

## Migration compatibility

Hosted migration initially failed with D1 `incomplete input` although local SQLite and Wrangler parsing accepted the files. Rewriting trigger guards from nested `CASE ... END` to equivalent `SELECT RAISE(...) WHERE ...` resolved the server parser issue without weakening limits or atomicity. Both environments successfully applied `0001_gallery.sql`, `0002_agent_review.sql` and `0003_audit_context.sql`, and each loaded the 1,482-entry catalog seed. Both environments now have intake, publication and serving switches set to 1. A new regression runs all migrations through the installed Wrangler splitter and verifies trigger execution and atomic counter rollback.

## Current verification

The enabled staging deployment completed the hosted human/agent moderation proof below. The simplified contributor flow is deployed as staging Worker version `f15e9fdc-6004-4abd-ab5a-f8eaa6b7067d`. A fresh synthetic 1024px browser import/selection/Turnstile submission completed with “Submitted for review.” and zero private/status links. Retired contributor GET status, GET preview and POST withdrawal routes all returned 404 on staging.

- Current simplified-flow suite: **262 tests in 42 files passed**, lint passed, build passed (448 modules), and all 20 historical protocol versions passed.
- All three updated local Wrangler/D1/R2 end-to-end flows passed: scoped machine grants/version/audit/revocation; changed-byte rejection and revocable downloads; browser selection/private submission/human publication/public reimport/printing.
- Fresh hosted OTP human login succeeded; the staging queue, submission detail and full-resolution 2048px synthetic artwork loaded.
- A selected machine grant permitted its scoped queue and artwork read. Downloaded artwork matched the canonical SHA-256. Recommendation plus identical replay returned one recommendation ID.
- Human metadata correction made the old advice stale; a request using the old version/digest was denied. Human approval then published the exact reviewed version.
- Public CellarPack artwork matched the canonical byte hash. Actual browser “Use label” imported one label for one print sheet. The single visible `LIMITED_RESEARCH` warning is expected because reconstructed gallery packs omit original private research; it is not a hash, geometry or printing failure.
- Human unpublishing made all four public detail/thumbnail/artwork/pack routes return 404 with `no-store`. Revoking the machine grant made the real client return `access_denied`.
- The test publication is removed from public access. Its submission remains unpublished and private under retention. Personal Downloads artwork stayed local; hosted checks used original geometric synthetic artwork.
- Earlier denial checks also passed: wrong-host private APIs returned 404, unauthenticated human access redirected to Access, and unauthenticated machine access returned 401. Temporary setup-token revocation and temporary-copy cleanup remain complete.

## Remaining release work

The production release is live. [Pull request #3](https://github.com/Enablement-Engineering/tin-to-cellar/pull/3) merged after the user's explicit yes; CI checks, migrations, catalog seed, deployment and response checks passed. All three production D1 switches were enabled and read back as 1 after deployment.

Production browser checks passed: existing human Access login opened the admin UI; two synthetic packs imported and submitted through Turnstile with v2 consent and compact success receipts. Automatic diagnostics collection succeeded. Admin corrections and full-resolution 2048px artwork loaded. The synthetic release-check submission `33c39bb0-2223-4122-b2a8-eead76fa037f` was approved, downloaded and reimported as one printable label on one sheet, then unpublished. Its public artwork SHA-256 matched `f437caa8e021ca65ba4f7d6a934831586be689331bbbf356c7aa8a8446ab7e00`. All four public detail/thumbnail/artwork/pack endpoints subsequently returned 404 with `no-store`, and the public listing was empty. A separate synthetic private feedback example remains pending.

Unauthenticated production admin returned an Access redirect, the public-host admin API returned 404, and unauthenticated agent access returned 401. The securely stored production machine credential without an application grant returned `access_denied`. After direct user authorization, the selected-only production grant was registered successfully as `89190d2c-319d-44c4-8c20-d383536eb007`, expiring October 5, 2026 at 23:27 UTC. The client queue returned only synthetic pending submission `ad595ec2-c4b3-4846-b561-a83f8558e6c9`. Downloaded artwork matched canonical SHA-256 `b3dd632a59e36ef01bc46911e91c91b35f504994fd605e22c1a1b8c6ca2e52ae`. Recommendation `24daad22-cf36-4a0f-b609-c41155b0a69e` appeared in the human admin UI for version 4. The separate unpublished submission was denied to the client. Agent credentials could not reach human approval (Access redirect), and no agent approval route exists (404). The synthetic example remains private and pending with sample advice for feedback. The grant permits reads and recommendations only, with no future-arrival access. Temporary local artwork and recommendation files were removed; protected ongoing credentials remain outside the repository. New searchable-blend and footer refinements from the UI feedback task remain local follow-up changes and are not included in this production version.

Fresh human login and selected-agent staging proof are complete; there is no pending OTP step. Keep the tested publication unpublished. Physical printer alignment and artwork rights are not established by software tests. The original mixed checkout remains untouched; implementation is isolated in `/private/tmp/tin-to-cellar-gallery`.

## Submission experience update

At the user’s direction, successful contribution now ends with “Submitted for review.” Contributor status links, private preview and withdrawal controls are removed; an internal same-tab nonce remains only for safe reservation/upload retries. Admin rejection/unpublishing and retention remain. The earlier status/withdrawal test evidence describes the retired flow, not a supported feature. This simplified experience is now deployed in production.

## Consent and completion refinement

The sharing agreement now says: “I created or generated these labels and agree to share them through Tin to Cellar for personal cellaring.” New submissions use notice version `2026-09-06-v2`; existing v1 consent remains unchanged and reviewable. Retention details are collapsed, and completion appears in a compact result card. Expired upload reservations cannot produce a false success; a deliberate new submission is required. The full 262-test suite, lint and build pass.

The final consent/status build is deployed on staging as `818fd726-ae7a-4018-b849-093bbae20292`. A fresh synthetic 1024px browser submission passed v2 consent and Turnstile, displayed the compact confirmation with no private links, and remained private. The rendered confirmation was visually inspected. All three final local integration workflows passed.

## Staging collection availability

Staging intentionally has no diagnostics/source-collection bindings. It now returns a distinct `collection_unconfigured` code, and the UI explains that automatic collection is unavailable without offering an ineffective retry or claiming the diagnostics were shared. Gallery submissions are separate and remain available. This clarification is deployed in staging version `68808dea-3967-4640-b39c-050ca6b70475`; a fresh browser import confirmed the new message and absence of the retry button. Current full suite: 266 tests in 42 files pass; lint and build pass.

## Responsive header

The header now wraps and uses two columns on narrow screens; How it works remains accessible in the footer. A real local browser test passed at 320, 375, 600, 768, 1024 and 1440px, checking link bounds, 44px targets, and footer navigation. Mobile and desktop screenshots were inspected. Final full unit suite remains 266 passing tests, with lint/build passing. Staging version `421d6b7c-e818-4506-904f-4c2eaf14b7fd` includes this change; all four deployed workflow links fit the browser viewport and the footer help link is present.
