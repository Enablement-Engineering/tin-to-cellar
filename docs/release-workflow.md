# Branch and release workflow

Tin to Cellar uses short-lived branches, pull requests and automated checks. No human PR approval or production environment reviewer is mandatory. A merge into `main` automatically starts the production release, so the release owner handles the merge and follows the workflow through public verification.

## Current enforcement

`.github/workflows/deploy.yml` runs `Check and deploy` for PRs targeting `main`, pushes to `main`, and manual dispatch. Only a non-PR run on `refs/heads/main` can deploy. Its concurrency group serializes runs on the same ref with `cancel-in-progress: false`. PR checks use local resources; deployment credentials belong to the deploy job.

The hardening workflow adds five browser matrix jobs and CodeQL, and makes deployment depend on all of them. On 2026-09-18 UTC, GitHub API readback confirmed main requires PRs, up-to-date checks from the GitHub Actions app, and zero approving reviews. Protection includes administrators and blocks force pushes and deletion. The production environment permits only the `main` branch, with no required reviewers. The separate CodeQL severity rule still needs a main-branch analysis baseline before activation. Recheck live settings when releasing; repository documentation cannot prevent settings drift.

## Work on a branch

1. Inspect status and other active tasks before editing. Fetch `origin` and create a descriptive `codex/` branch from current `origin/main`. Use a separate worktree when others are editing the checkout. Agree on ownership for overlapping files.
2. Preserve existing uncommitted changes. If relevant work already exists in a shared checkout, coordinate its transfer to the branch and inspect the resulting diff; do not move or include another task's files by accident.
3. Run relevant tests, `npm run lint` and `npm run build`. Record browser, hosted, assistive technology and physical print evidence separately. Schema changes also need the compatibility evidence in [deployment requirements](ci-deployment.md#schema-compatibility-across-releases).
4. Stage exact files or hunks and inspect the staged diff. Commit and push within the user's authorized scope, then open a PR into `main` using the repository template. Branch creation alone grants no authority to push, merge, deploy or publish artwork. Reuse authorization already given rather than asking again.
5. Keep the PR current with freshly fetched main. Resolve conflicts in the branch, preserve current privacy and budget controls, and rerun affected checks. Request agent review for consequential changes where useful. It is advisory, with no required human approval count.

## GitHub settings to apply

Apply an active rule to `main` that requires a PR, blocks force pushes and deletion, requires the branch to be up to date, and requires these checks from the GitHub Actions app:

| Check name defined by YAML | Coverage |
| --- | --- |
| `check` | Protocol history, unit tests, lint, build/typecheck, release recovery, selected Safari theme tests, mobile saved-design layout |
| `Browser checks (accessibility)` | Core navigation, keyboard, import, print and instruction recovery fixtures |
| `Browser checks (gallery)` | Gallery integration suite |
| `Browser checks (security)` | Built-Worker security suite |
| `Browser checks (usage)` | Usage suite |
| `Browser checks (usage-resilience)` | Usage resilience suite |
| `CodeQL` | JavaScript/TypeScript security analysis execution |

Confirm the names against a completed run of the expanded workflow before selecting them. Do not require `deploy` on PRs, since it deliberately does not run there. The full legacy accessibility suite is not currently a required check.

Require CodeQL code-scanning results separately to block high-or-greater security alerts and error-level alerts. The `CodeQL` job can succeed while reporting findings. Inspect the initial baseline as described in [security scanning](security-scanning.md).

Set required approving reviews to zero, leave required code-owner reviews disabled, and do not add a human-review requirement through another rule. Avoid routine administrator or automation bypasses. If a bypass is used for an exceptional recovery, record the reason and evidence instead of describing the release as protected by the normal gates.

Restrict the `production` environment to the `main` branch, excluding other branches and tags. Leave required environment reviewers unset. No merge queue or separate release branch is needed for this workflow.

## Merge and verify a release

1. One task claims release ownership before merging. Other tasks may continue code work but must hold merges, workflow dispatches and deployments until the owner reports completion or failure and hands off ownership. GitHub concurrency prevents overlapping runs; this coordination also prevents a later merge from overtaking the verification work.
2. Confirm the existing user authorization includes the production effect of merging. If only code work or a draft PR was authorized, prepare the complete checked PR before requesting release authorization. Do not insert another approval when the user has already authorized release.
3. Verify the current PR revision passes every required check and includes current main. Merge through the PR, using squash merge by default for a single scoped change. Never push directly to main. Observe the resulting main workflow rather than starting a duplicate release.
4. Track the merged commit, Actions run and attempt, and Cloudflare version ID. Build identity is `<commit SHA>-<run ID>-<run attempt>`. The workflow builds with that identity, retains three prior generations of hashed assets, applies migrations and catalog seed, then deploys the Worker and static assets.
5. Inspect the workflow's smoke-check results and independently repeat the following reads after deployment. Allow brief propagation retries, then treat a mismatch as an incomplete release.

| Read | Required result |
| --- | --- |
| `/labels` on `tintocellar.com` and `www.tintocellar.com` | Successful response |
| `/app-version.json` on both hosts | `buildId` equals this run's exact identity |
| `/api/health` on `tintocellar.com` | `status: "ok"`; capabilities include `diagnostic-budget-v1`, `curated-intake-v1`, `curated-reconcile-v1` |
| Unauthenticated `/api/labels/diagnostics/budget` on `tintocellar.com` | HTTP 403, with no secret supplied |
| `/api/analytics/v1/config` on both hosts | `enabled: false` |
| `/api/analytics/v2/config` on both hosts | `version: 2`, `demandEnabled: false`, `workflowEnabled: false`, `progressEnabled: false` |

Keep `ANALYTICS_ENABLED`, `WORKFLOW_ANALYTICS_ENABLED` and `PROGRESS_ANALYTICS_ENABLED` false unless their enablement is separately authorized and its acceptance requirements are met. Diagnostic collection has a separate configuration and must not be described as disabled analytics. A successful smoke check does not establish artwork publication, native AT acceptance or physical print alignment.

Report the commit, workflow URL, observed build and verification results before releasing ownership. If a check fails after upload, the new Worker may already be serving. Record that state and retain release ownership while investigating or explicitly hand it off.

## Migrations and recovery

Migrations run before Worker deployment. Keep deployed migrations immutable and demonstrate old-Worker reads and writes against every expanded schema before release. Follow the expand/contract sequence in [deployment requirements](ci-deployment.md#schema-compatibility-across-releases), including backfill and rollback compatibility evidence in the PR.

Recover through a revert or corrective PR based on freshly fetched `origin/main`, then use the same checks and release workflow. Revert the failing behavior while retaining newer security, privacy and budget configuration. Do not deploy an old checkout, reuse an old generated release configuration, reverse deployed migrations or discard user data. Check that the recovery code works with the schema already deployed. If it cannot, use a forward fix with compatible schema changes.

After a failed workflow, inspect which steps completed before retrying. Manual dispatch must target current main and use the same release owner. Avoid rerunning an old main job after main has advanced, since that would deploy its old commit and configuration.

Application deployment and artwork publication remain separate operations. Release authorization does not authorize publishing, replacing, unpublishing or deleting catalog artwork. Preserve existing publications and follow the artwork publication process under its own authorization.
