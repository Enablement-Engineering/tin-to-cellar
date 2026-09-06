# Gallery release preparation

Current execution and resource facts are recorded in [gallery release status](gallery-release-status.md). User has since authorized the scoped implementation and deployment; approval-pending statements below describe the earlier preparation checkpoint. The current admin design uses dedicated `admin.tintocellar.com` and `admin-staging.tintocellar.com` hosts with separate human and machine Access applications.

Prepared September 6, 2026. Source checkout `/private/tmp/tin-to-cellar-gallery`, branch `codex/community-gallery`, base `919aa50f461dd63413f6f5d1d99ac611e4a8675c`. Application changes and release preparation are local. This file records the next reviewable actions; commands that create resources, set secrets, migrate remote data or deploy have not been run.

## Confirmed account and release state

| Item | Current evidence |
| --- | --- |
| Cloudflare account | Enablement Engineering, `97e5d454f1ad2daae1c6d42a5d4c09dd`, confirmed against GitHub's deployment variable and signed-in dashboard. |
| Workers subscription | Dylan approved and personally activated Workers Paid. Dashboard now verifies **Workers Paid: Active**, renewing September 23, 2026. No duplicate purchase was made. The approved plan is $5/month minimum plus standard metered overages. |
| R2 subscription | R2 Paid active already. Dashboard's observed September R2 usage is within its included allowance. Only the unrelated recipe-upload bucket exists; no gallery bucket. |
| D1 | Only `tin-to-cellar-diagnostics`, ID `10c1a5a7-9884-46ad-86d0-2eedf5d8426a`, exists in this account's D1 list. Do not use it for gallery data. |
| Zero Trust | Teams Free Base active, 2 of 50 seats in use. Dashboard shows six unrelated Scribely Access applications and no Tin to Cellar application. The OAuth API returned an incomplete empty view, so dashboard evidence takes precedence. |
| Access team | `https://winter-king-937f.cloudflareaccess.com`. Dylan's existing user record matches `dylan@enablement.engineering`; its user UUID is available from the dashboard. Verify a fresh signed session after creating the gallery application. |
| Turnstile | Existing widget “Tin to Cellar hosted image checks” permits the apex hostname. Do not alter or rotate it for the gallery. Create separate staging/production gallery widgets to keep their secrets and lifecycle independent. |
| Worker secrets | Only the name `DIAGNOSTICS_READ_TOKEN` is bound currently. No secret values were retrieved or printed. |
| Production identity | Latest Worker version `ae34bcc8-b0b4-43e8-a213-481032fcdf5c`; GitHub main and successful deployment run `34055974313` point to the base SHA above. |
| CI approval boundary | Main pushes deploy automatically. The GitHub production environment currently has no protection rules. Do not push or merge the implementation to main as a preparation step. |
| Contact | User confirmed `dylan@enablement.engineering` for reviewer access and public artwork concerns. Local About, Privacy and gallery copy now link directly to it. |

The zone's “Free Website” plan and a Worker's `usage_model: standard` do not establish Workers Paid status. The subscription screen is the evidence used here. Existing account credentials were used only for GET/list discovery; no gallery provisioning occurred.

## Cost proposal

Workers Paid starts at $5 per account per month, with 10 million requests and 30 million CPU milliseconds included. Overages are $0.30 per million requests and $0.02 per million CPU milliseconds. Free has only 10ms CPU per invocation; the current PNG normalization path needs a paid hosted test. The prepared config adds a proposed 2,000ms per-invocation limit only with `--paid-workers-confirmed`. Measure real hosted worst-case input before accepting that ceiling. This is a per-request limit, not a monthly spending cap. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

R2 Standard includes 10 GB-month, 1 million Class A and 10 million Class B operations shared across the account. Above those allowances, current prices are $0.015/GB-month, $4.50/million Class A and $0.36/million Class B; egress is free. Roughly 1,000 labels averaging 3MB canonical PNG plus a similarly sized ZIP would consume around 6GB before thumbnails, pending files and other apps. Do not promise zero storage charges or confuse the gallery's 8GiB application accounting ceiling with R2's shared allowance. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

D1 Paid includes 25 billion rows read, 50 million rows written and 5GB storage; its dedicated pricing page lists overages of $0.001/million reads, $1/million writes and $0.75/GB-month. Queries and indexes count toward usage. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

The Workers plan upgrade is complete. New gallery resources and deployment still need approval of the staging scope below. A proposed $10/month account usage alert would notify, not enforce a hard cap; do not create or change budget alerts without that choice being included in authorization.

## Proposed staging scope for approval

Create only these new gallery resources in the confirmed account:

- Worker `tin-to-cellar-gallery-staging` at proposed hostname `gallery-staging.tintocellar.com`.
- D1 `tin-to-cellar-gallery-staging`, with only `migrations/gallery/0001_gallery.sql` and the prepared catalog seed.
- Private R2 Standard bucket `tin-to-cellar-gallery-staging`, no public `r2.dev` access or bucket custom domain.
- One Access application for the staging admin shell and admin API, allowing only `dylan@enablement.engineering`, using the existing Access team and a new application audience.
- One managed Turnstile widget named `Tin to Cellar gallery staging` for the staging hostname, plus its private Worker secret and a new random IP salt.

Staging does not bind production diagnostics, source Durable Objects or service bindings. Its ordinary diagnostics endpoints will be unavailable; gallery testing is isolated. Keep `workers_dev` and preview URLs disabled. Initially keep all gallery environment and database switches off. The controlled staging test may enable gallery features temporarily using synthetic artwork only, then reject pending test submissions or unpublish test publications. This is an Internet-hosted test site with protected reviewer routes; its approval does not launch the production gallery.

## Exact preparation and execution order

The following creation, secret, remote migration and deployment commands are pending authorization. Run from the implementation checkout. The account selection is explicit:

```sh
export CLOUDFLARE_ACCOUNT_ID=97e5d454f1ad2daae1c6d42a5d4c09dd
npm exec -- wrangler d1 create tin-to-cellar-gallery-staging
npm exec -- wrangler r2 bucket create tin-to-cellar-gallery-staging
npm exec -- wrangler r2 bucket dev-url get tin-to-cellar-gallery-staging
npm exec -- wrangler r2 bucket domain list tin-to-cellar-gallery-staging
```

Record the returned D1 ID, then verify both R2 public-access mechanisms are disabled. If necessary, disable `r2.dev` during the authorized setup; never add a bucket public domain. Create the Access application and policy using the destinations in [authentication release configuration](gallery-auth-release.md). Record its actual audience tag. Create the new Turnstile widget with managed mode and `no_clearance`; retain its secret securely without echoing raw widget creation responses into logs.

Set local variables from the actual resource metadata. `GALLERY_REVIEWER_SUBJECT` is Dylan's existing Access user UUID, not the email. `GALLERY_STAGE_AUD` and `GALLERY_STAGE_SITE_KEY` come from the newly created application/widget. The generator refuses missing, placeholder, test or mixed-environment values:

```sh
: "${GALLERY_STAGE_DB_ID:?Actual staging database ID required}"
: "${GALLERY_STAGE_AUD:?Actual staging Access audience required}"
: "${GALLERY_REVIEWER_SUBJECT:?Actual reviewer user UUID required}"
: "${GALLERY_STAGE_SITE_KEY:?Actual staging Turnstile sitekey required}"
npm run gallery:prepare-release -- --target staging \
  --database-id "$GALLERY_STAGE_DB_ID" \
  --bucket tin-to-cellar-gallery-staging \
  --host gallery-staging.tintocellar.com \
  --admin-host admin-staging.tintocellar.com \
  --access-issuer https://winter-king-937f.cloudflareaccess.com \
  --access-aud "$GALLERY_STAGE_AUD" \
  --admin-subject "$GALLERY_REVIEWER_SUBJECT" \
  --turnstile-site-key "$GALLERY_STAGE_SITE_KEY" \
  --paid-workers-confirmed
npm run gallery:seed -- output/gallery-release/catalog.sql
npm run build
npm exec -- wrangler deploy --dry-run \
  --config output/gallery-release/staging/wrangler.json
```

Use `--paid-workers-confirmed` only after the subscription screen confirms activation. The generator writes an absolute-path local configuration plus a portable root configuration, without touching `wrangler.jsonc`. Inspect the generated binding names, IDs, hostname, false flags and CPU setting. Do not deploy `wrangler.root.json` from the output directory: its relative paths are intended for an explicitly approved copy to the repository root.

Apply gallery schema before seed, then deploy the flags-off Worker so it exists before setting its secrets:

```sh
npm exec -- wrangler d1 migrations apply GALLERY --remote \
  --config output/gallery-release/staging/wrangler.json
npm exec -- wrangler d1 execute GALLERY --remote \
  --config output/gallery-release/staging/wrangler.json \
  --file output/gallery-release/catalog.sql
npm exec -- wrangler deploy --config output/gallery-release/staging/wrangler.json
npm exec -- wrangler secret put GALLERY_TURNSTILE_SECRET \
  --config output/gallery-release/staging/wrangler.json
npm exec -- wrangler secret put GALLERY_IP_SALT \
  --config output/gallery-release/staging/wrangler.json
```

Use the secret prompts or secure stdin; never put secret values in shell arguments, chat, CI logs, source or frontend variables. Confirm actual secret **names** afterward. Verify unauthenticated admin denial and Dylan's fresh Access login before any controlled publication. Confirm the signed Worker admin request accepts the configured reviewer UUID. Review and enable environment flags through the generated staging configuration, deploy it, and then explicitly enable the matching database switches only for the authorized test window:

```sh
npm exec -- wrangler d1 execute GALLERY --remote \
  --config output/gallery-release/staging/wrangler.json \
  --command 'UPDATE gallery_settings SET intake=1,publication=1,serving=1 WHERE id=1'
```

Record source revision, deployed Worker version, schema/seed identity and test timestamps. Exercise real Access and Turnstile without fixture headers, explicit upload, private preview, approval, exact downloaded bytes, reimport, admin unpublish and old direct URLs. Verify cleanup including a scheduled invocation and eventual object deletion, and measure 2048px input CPU. Local tests cannot replace these checks. Keep personal Downloads artwork out of staging unless separately approved for that external upload.

## Later production adoption

Production requires its own D1/bucket `tin-to-cellar-gallery`, new production gallery widget and one Access application covering four admin destinations across apex and www. Generate `--target production` using those actual values and no `--host`. The output preserves diagnostics, source Durable Object bindings/migration history and current routes. Review the portable `wrangler.root.json` before copying it to root `wrangler.jsonc` in a release commit.

The current CI workflow migrates **only diagnostics**. Before a production push, apply the separately authorized gallery migration and catalog seed with the prepared production config; add an explicit gallery migration step for future automated releases once the actual binding is in the reviewed root config. Do not rely on a main push to create storage or run an unconfigured gallery migration. CI would otherwise deploy immediately because the production environment has no reviewer gate. Use a draft branch/PR for review, and obtain release approval before pushing/merging a main change. Keep initial production feature flags false until both hostname checks pass.

## Rollback

Disable database `intake` to stop new submissions, `publication` to pause approvals, or `serving` to stop public downloads. These settings take effect without a deployment and supplement environment flags. Keep admin review and cleanup available. Contributor uploads end with “Submitted for review”; status links and contributor withdrawal are not supported. Do not drop gallery tables, reverse migrations, make the bucket public or revert to pre-gallery code that abandons retention work. Retain the previous gallery-capable Worker version for later rollback; the currently deployed pre-gallery version is not a complete operational rollback once gallery data exists.

## Local preparation evidence

The production-source `wrangler deploy --dry-run` completed with no upload: 885.10KiB uncompressed Worker, 137.19KiB gzip, existing production bindings and false gallery flags. The catalog seed prepared 1,482 rows, revision `a0ab853a7240b088b830a2d6bffe22379af08406ce2f2cfe76a85c6b79d17a85`. Release-generator tests cover staging isolation, preservation of production resources, portable paths, required configuration and placeholder rejection. The real target config cannot be generated until its real database/application/widget IDs exist; no fake deployable IDs were written.
