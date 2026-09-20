# Tin to Cellar implementation boundaries

- Use npm for package management and scripts.
- Keep the application local-first. Importing a pack must not upload files or automatically fetch provenance URLs.
- Render untrusted manifest text as text, never as HTML.
- Preserve the separation between label artwork geometry and printer sheet geometry.
- Generated artwork owns the entire blank date-writing surface. The website must not add words, lines, or date overlays.
- Do not commit generated build output or dependency directories.
- Run the most relevant tests, typecheck/build, and lint for changed areas.
- Deploy production through the current `origin/main` release workflow. Older worktrees and generated release configurations can overwrite newer privacy and budget controls. Integrate changes onto current main before release; after deployment verify the protected budget endpoint as well as health. Coordinate concurrent release tasks.
- Keep deployed D1 migrations immutable. Migrations run before Worker deployment, so verify the currently serving Worker can still read and write after each migration. Expand schema first, deploy compatible code, and contract only in a later release after reviewing rollback compatibility. Follow `docs/ci-deployment.md` and record compatibility evidence in the PR.

## Branches and releases

- Follow `docs/release-workflow.md`. Start `codex/` branches from freshly fetched `origin/main`; use isolated worktrees for concurrent work and preserve unrelated edits.
- Submit changes through a PR into `main`; do not push directly to `main`. Require the documented CI checks on the current revision and keep the branch current with `main` before merging.
- No mandatory human PR approval or production environment reviewer is required. Request AI code review for consequential changes. Before merging, read every AI review on the current revision and either address each actionable finding or reply with the concrete reason it does not apply. Re-run affected checks after review fixes; green CI alone does not resolve review feedback. Act within existing user authorization; creating a branch does not authorize publishing, merging, or deploying, and authorization already given does not need to be requested again.
- One release owner coordinates merge and deployment through completion. Merging to `main` triggers production, so confirm release authorization covers that effect. Use the current main workflow and record its exact build, health, protected budget and disabled analytics checks.
- Recover through a compatible revert or fix PR on current `origin/main`. Do not deploy an old checkout or restore old configuration. Application release authorization does not authorize artwork publication or changes to existing publications.

## Shared module ownership during the initial parallel build

- Prompt agent: `src/lib/prompt/**`, `public/agent/**`, and prompt-focused tests.
- CellarPack agent: `src/lib/cellarpack/**`, `src/lib/sheets/**`, `public/spec/**`, and format/validator tests and fixtures.
- Website agent: `src/components/**`, `src/styles/**`, `src/App.tsx`, `src/main.tsx`, UI tests, and public presentation assets.

Do not edit another agent's owned paths. Coordinate through exported interfaces and leave integration notes when an interface is not yet available.
