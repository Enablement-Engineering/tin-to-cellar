# Deployment from GitHub

`.github/workflows/deploy.yml` runs tests, lint, and the production build for pull requests and pushes to `main`. Successful checks on `main` deploy the checked commit's Worker and static assets to Cloudflare. Pull requests cannot deploy or access deployment credentials. The workflow can also be run manually on `main`.

## One-time credentials

In the repository's Actions settings, configure:

- Repository variable `CLOUDFLARE_ACCOUNT_ID`: the account containing the existing `tin-to-cellar` Worker.
- Repository secret `CLOUDFLARE_API_TOKEN`: a dedicated Cloudflare deployment API token restricted to that account. Start with Cloudflare's Edit Cloudflare Workers template and restrict zone access to `tintocellar.com` for its custom domains. Keep the token out of source files and chat.

Follow [Cloudflare's GitHub Actions setup](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) for creating the deployment token. A developer's local Wrangler OAuth session is not a CI credential. Worker runtime secrets remain configured in Cloudflare; do not copy them into GitHub.

## Releases

Follow [the branch and release workflow](release-workflow.md) for PRs, required checks, release ownership and recovery. It specifies zero mandatory human approvals. GitHub settings must enforce the proposed branch and environment restrictions; this documentation alone does not configure them.

The deploy job uses the `production` GitHub environment and serializes runs on `main` so deployments do not overlap. It uses the Wrangler version in the npm lockfile, preserves the bindings and migrations in `wrangler.jsonc`, and checks both production domains and the health endpoint after deployment. HTTP checks establish deployment response behavior, not successful artwork generation, canonical local proof review, ZIP delivery, website import, or printing. Record those workflow checks separately.

If credentials are missing, checks still run and deployment fails with a specific setup message. After adding credentials, coordinate with the release owner. Rerun the failed workflow only if its commit is still current main; otherwise dispatch the workflow on current main. Inspect the deployment log for the Cloudflare version ID and the run's commit SHA.

Only committed files are deployed by this workflow. Local edits and ignored output are not included. `npm run deploy` publishes the local working tree and is not the production release path. Use a PR into current main and its workflow, including for urgent fixes.

## Schema compatibility across releases

D1 migrations run before the new Worker is deployed. Every migration must therefore work with the currently serving Worker as well as the new Worker. Keep already deployed migration files immutable.

Use expand/contract releases:

1. Expand with additive tables, nullable columns, or compatible defaults. Review constraints, indexes and triggers too: additive SQL can still reject old writes or change their meaning.
2. Deploy code that tolerates old and new representations. Backfill separately with bounded, restartable operations and validate the result.
3. Remove old reads/writes only after the compatibility period and rollback plan have been reviewed.
4. Contract in a later release, after confirming that the old Worker and its rollback candidates no longer need the schema. Never combine a destructive schema change with the first code release that stops using it.

For each schema PR, record old-Worker read/write behavior against the expanded schema, new-Worker behavior, backfill requirements and rollback compatibility. Exercise those paths against a local migrated database. Schema application alone is not a compatibility test. Production rollback normally restores compatible code; it must not reverse migrations or discard user data.

Before a GA release, apply repository and environment protections described in [the release workflow](release-workflow.md#github-settings-to-apply). Workflow jobs prevent deployment after failed checks, but repository settings are needed to prevent unchecked direct changes to main.
