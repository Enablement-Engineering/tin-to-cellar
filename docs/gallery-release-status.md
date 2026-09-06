# Gallery release status

In progress, September 6, 2026. User has authorized implementing and deploying the admin and advisory-agent workflow, including dedicated gallery resources, Access, Turnstile, subdomains, migrations and a scoped repository release. This supersedes the earlier approval-pending language in the preparation packet. Workers Paid was already activated by the user and remains active.

## Resource record

Account: `97e5d454f1ad2daae1c6d42a5d4c09dd`.

| Environment | Worker / bucket / database name | Database ID | Public host | Admin host |
| --- | --- | --- | --- | --- |
| Staging | `tin-to-cellar-gallery-staging` | `9c01083d-9cba-4263-bd4e-7f21a2b93fef` | `gallery-staging.tintocellar.com` | `admin-staging.tintocellar.com` |
| Production | Worker `tin-to-cellar`; bucket/database `tin-to-cellar-gallery` | `37bebdd3-76f1-44cf-839a-c8a980113d87` | `tintocellar.com`, `www.tintocellar.com` | `admin.tintocellar.com` |

Both D1 databases and R2 buckets have been created. Both buckets have `r2.dev` access disabled and no bucket custom domains. Separate managed gallery Turnstile widgets are created; private widget secrets are held only in protected ignored local setup files. Neither the existing diagnostics database nor Scribely Access applications were modified.

The CLI OAuth credential could not manage Access; setup proceeded through a temporary account-scoped credential. Human and machine Access applications are now configured with separate audiences, recorded in the ignored resources.json setup record. Service credentials are securely saved outside source and chat, and Worker secrets are installed in both environments. The temporary setup token was deleted through the UI; a follow-up API request returned 401 Invalid API Token, confirming revocation. Temporary setup-secret copies were removed; protected ongoing agent credential files remain. Never paste credentials into tasks or source.

## Migration compatibility

Hosted migration initially failed with D1 `incomplete input` although local SQLite and Wrangler parsing accepted the files. Rewriting trigger guards from nested `CASE ... END` to equivalent `SELECT RAISE(...) WHERE ...` resolved the server parser issue without weakening limits or atomicity. Both environments successfully applied `0001_gallery.sql`, `0002_agent_review.sql` and `0003_audit_context.sql`, and each loaded the 1,482-entry catalog seed. Production database switches remain off; staging is enabled for the controlled checks described below. A new regression runs all migrations through the installed Wrangler splitter and verifies trigger execution and atomic counter rollback.

## Current verification

The enabled staging deployment completed the hosted human/agent moderation proof below. The simplified contributor flow is deployed as staging Worker version `f15e9fdc-6004-4abd-ab5a-f8eaa6b7067d`. A fresh synthetic 1024px browser import/selection/Turnstile submission completed with “Submitted for review.” and zero private/status links. Retired contributor GET status, GET preview and POST withdrawal routes all returned 404 on staging.

- Current simplified-flow suite: **260 tests in 42 files passed**, lint passed, build passed (448 modules), and all 20 historical protocol versions passed.
- All three updated local Wrangler/D1/R2 end-to-end flows passed: scoped machine grants/version/audit/revocation; changed-byte rejection and revocable downloads; browser selection/private submission/human publication/public reimport/printing.
- Fresh hosted OTP human login succeeded; the staging queue, submission detail and full-resolution 2048px synthetic artwork loaded.
- A selected machine grant permitted its scoped queue and artwork read. Downloaded artwork matched the canonical SHA-256. Recommendation plus identical replay returned one recommendation ID.
- Human metadata correction made the old advice stale; a request using the old version/digest was denied. Human approval then published the exact reviewed version.
- Public CellarPack artwork matched the canonical byte hash. Actual browser “Use label” imported one label for one print sheet. The single visible `LIMITED_RESEARCH` warning is expected because reconstructed gallery packs omit original private research; it is not a hash, geometry or printing failure.
- Human unpublishing made all four public detail/thumbnail/artwork/pack routes return 404 with `no-store`. Revoking the machine grant made the real client return `access_denied`.
- The test publication is removed from public access. Its submission remains unpublished and private under retention. Personal Downloads artwork stayed local; hosted checks used original geometric synthetic artwork.
- Earlier denial checks also passed: wrong-host private APIs returned 404, unauthenticated human access redirected to Access, and unauthenticated machine access returned 401. Temporary setup-token revocation and temporary-copy cleanup remain complete.

## Remaining release work

The simplified staging redeploy and its submission/retired-route smoke checks passed. The production root configuration now contains the actual bindings and enabled Worker environment flags, but all three production D1 switches remain 0. There has been no production gallery feature deployment, commit or push; editing the configuration does not enable the live feature. Complete the scoped production release and equivalent hosted checks before claiming production availability.

Fresh human login and selected-agent staging proof are complete; there is no pending OTP step. Keep the tested publication unpublished. Physical printer alignment and artwork rights are not established by software tests. The original mixed checkout remains untouched; implementation is isolated in `/private/tmp/tin-to-cellar-gallery`.

## Submission experience update

At the user’s direction, successful contribution now ends with “Submitted for review.” Contributor status links, private preview and withdrawal controls are removed; an internal same-tab nonce remains only for safe reservation/upload retries. Admin rejection/unpublishing and retention remain. The earlier status/withdrawal test evidence describes the retired flow, not a supported feature. Production has not been released.
