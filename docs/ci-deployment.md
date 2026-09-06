# Deployment from GitHub

`.github/workflows/deploy.yml` runs tests, lint, and the production build for pull requests and pushes to `main`. Successful checks on `main` deploy the checked commit's Worker and static assets to Cloudflare. Pull requests cannot deploy or access deployment credentials. The workflow can also be run manually on `main`.

## One-time credentials

In the repository's Actions settings, configure:

- Repository variable `CLOUDFLARE_ACCOUNT_ID`: the account containing the existing `tin-to-cellar` Worker.
- Repository secret `CLOUDFLARE_API_TOKEN`: a dedicated Cloudflare deployment API token restricted to that account. Start with Cloudflare's Edit Cloudflare Workers template and restrict zone access to `tintocellar.com` for its custom domains. Keep the token out of source files and chat.

Follow [Cloudflare's GitHub Actions setup](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) for creating the deployment token. A developer's local Wrangler OAuth session is not a CI credential. Existing Worker runtime secrets, including Turnstile, remain configured in Cloudflare; do not copy them into GitHub.

## Releases

The deploy job uses the `production` GitHub environment and serializes runs on `main` so deployments do not overlap. It uses the Wrangler version in the npm lockfile, preserves the bindings and migrations in `wrangler.jsonc`, and checks both production domains and the health endpoint after deployment. HTTP checks do not establish full hosted image-proof behavior.

If credentials are missing, checks still run and deployment fails with a specific setup message. After adding credentials, rerun the failed workflow or dispatch it from the Actions tab. Inspect the deployment log for the Cloudflare version ID and the run's commit SHA.

Only committed files are deployed by this workflow. Local edits and ignored output are not included. `npm run deploy` remains available for an explicitly authorized manual release and publishes the local working tree.
