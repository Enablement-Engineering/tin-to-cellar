# Diagnostics collection, review, and printing UI plan

Status: implementation prepared and locally verified on September 6, 2026. The UI, optional retrospective contract, D1 storage/migration, analysis scripts, review skill, and CI migration/history checks are implemented. Cloudflare login was refreshed; the remote database schema and read-only token are configured. The new code's deployment, automatic legacy backfill, a live manual review, scheduled review activation, and the first evidence-backed improvement release remain pending. No active Codex schedule was created.

## Intended outcome

Learn which instructions and supplied tools help AI agents complete label requests, where they encounter friction, and which changes reduce that friction. Keep printing focused on importing, checking, arranging, and printing labels. Feedback stays inside the normal CellarPack manifest; a separate file is a fallback for runs that cannot produce a pack.

## Current implementation and constraints

- `src/App.tsx` extracts feedback and builds a contribution from readable imported manifests. Artwork validation can fail while valid feedback still contributes.
- `ContributionStatus` submits the projected JSON contribution independently of `DiagnosticFeedback`. Removing the detailed presentation must preserve that submission lifecycle.
- `DiagnosticFeedback` currently displays run results, resolved issues, stages, JSON, downloads, and local report comparison. Standalone JSON imports are currently local only.
- `worker/contributions.ts` stores reports and source observations in a Cloudflare Durable Object. Both expire after 90 days; report collection stops at 1,000 stored reports.
- The current source schema declares feedback `0.2.0` with string protocol revisions. Some existing documentation describes older version conventions. Inventory actual released schemas and fixtures before assigning a successor version; correct documentation without rewriting historical releases.
- `.github/workflows/deploy.yml` configures tests, lint, and build, then deployment for successful runs on main. Live credentials, branch protection, and recent deployment success remain to be verified during implementation.
- ZIPs and image bytes stay local. Import never fetches contributed reference URLs. Label artwork and printer-sheet geometry remain separate.

## Implementation A: simplify the printing UI

### User flow

1. Import the ordinary CellarPack ZIP.
2. See import results, actual validation errors, actionable warnings, and the print preview.
3. Keep a short collection notice beside import, with a privacy link and a quiet `View shared diagnostics` action when there is something to inspect.
4. Open an accessible dialog for the exact eligible submission fields and receipt status. It may offer a validated JSON download. Clearly distinguish prepared data from confirmed receipt.
5. Keep submission failure and retry near import. Printing must remain available if diagnostics cannot be sent.

Remove the large AI run card, resolved-issue history, stage disclosure, raw JSON disclosure, and saved-report comparison from the printing page. Maintainer comparisons move to the reporting workflow in Implementation B. Do not substitute another large diagnostics panel.

Retain protocol mismatch and unknown-version warnings where they affect repair instructions. Do not accidentally remove them with `DiagnosticFeedback`. AI-reported unresolved concerns may appear as a compact, explicitly attributed warning when the user can act on them; resolved history belongs in diagnostics. Never present AI self-assessment as a website validation result.

The diagnostics dialog must identify the reference-link fields as well as feedback: it shows what the endpoint actually receives, not only the AI report. Opening it must not make another submission. Changing print quantities or views must not duplicate submission or discard retry state.

### Acceptance checks

- Normal imports no longer show the pictured run card or comparison controls.
- Import still sends the same allowed structured contribution once; reimports remain server-deduplicated.
- Submission failures retain a working retry without blocking printing.
- Validation and protocol warnings remain reachable and correctly attributed.
- Inspecting/downloading diagnostics does not upload artwork, fetch provenance, or send additional data.
- Dialog keyboard behavior, focus return, narrow layouts, and existing import-to-print flow pass review.

## Implementation B: richer diagnostics and an improvement loop

### 1. Versioned report contract

Preserve existing bounded outcomes, stages, attempts, and categorized issues. Add a separate optional process retrospective, so malformed narrative does not discard otherwise valid structured diagnostics or labels.

Proposed retrospective: at most five observations, each with a stage, a kind (`helped`, `friction`, `recovery`, or `suggestion`), and a short bounded explanation. Recovery observations include a fixed result (`worked`, `partly-worked`, `failed`, `not-tested`). An optional related issue code connects the observation to structured counts. Limit total narrative size as well as per-field length, initially 3,000 characters total and 600 per observation. These limits are proposed defaults to validate against sample reports.

Add bounded capability statuses (`available`, `unavailable`, `unknown`) for browsing, image generation, file creation, and local execution. Identify supplied tools through known tool IDs and validated release versions, with `unknown` supported. Record instruction revision and tool versions separately. Never invent provider/model identity or timings an agent cannot observe.

Prompt guidance must request observable actions and results: what helped, what required retries, what workaround actually worked, and a concrete improvement. Suggestions are hypotheses, not executable instructions. Keep cumulative issues across repairs, including resolved failures. Do not ask for chain-of-thought, transcripts, raw logs, user filenames, product/order details, URLs, or private information in the retrospective.

Example: "The pack builder generated filenames and hashes correctly. Artwork dimensions still required manual calculation. Accepting finished size and bleed as inputs would remove that step."

Ship a new immutable protocol release and matching schemas/readers together. Preserve supported old packs and historical protocol bytes. Add fixtures for actual supported versions, mismatched versions, malformed retrospectives, unsupported fields, and oversized input. Verify schema patterns through accepted/rejected examples, not documentation alone.

### 2. Collection and evidence separation

Continue automatic collection of allowed fixed diagnostics and eligible reference observations. New narrative sharing is optional and unchecked by default. Let the user inspect the exact narrative before an explicit `Share process notes` action; omitting notes does not impede automatic structured collection or printing. Render all submitted text as text.

Keep a stable report identity across structured submission and optional narrative supplement. Use the existing manifest fingerprint for imported packs. Store the supplement under that identity rather than treating it as a duplicate full submission or a second run. Retries must be idempotent, and supplements must not restart the structured report's retention clock.

Add a small `Report a failed AI run` entry on help/import-error surfaces. It opens a standalone JSON report locally, validates and previews the shareable fields, then submits only after an explicit action. Keep existing standalone-file behavior local until that action. Use a persisted random submission ID for the retry of one submission; identify standalone reports separately and do not imply accurate run deduplication across independently uploaded copies.

Add a bounded website-validation record containing only recognized issue codes, counts, validator version, and import outcome. Do not transmit raw error messages, paths, manifest text, or artwork. Record it separately from AI assertions. Preserve validated AI feedback when artwork fails. For unreadable archives, any standalone website failure submission needs its own explicit flow and must not pretend an AI report exists.

Optional human label-quality feedback is a later extension, not required for this first implementation.

### 3. Storage and retention

Use Cloudflare D1 for queryable report metadata, structured diagnostics, optional narrative, website checks, analysis runs, and finding records. Keep the existing Durable Object serving reference suggestions initially, with its existing freshness behavior. This avoids coupling a source-service rewrite to diagnostics analysis.

- Structured diagnostics and website results: 12 months from receipt.
- Optional narrative: 90 days from its receipt.
- Source observations: retain the existing 90-day freshness policy.
- Monthly aggregates: retain without raw narrative, fingerprints, or source URLs.
- Curated findings: retain sanitized conclusions and release/test references; do not retain copied raw notes beyond their policy by embedding them in findings.

Add indexed, cursor-paginated exports and explicit retention jobs. Remove the fixed 1,000-report rejection path for diagnostics while retaining request-size limits, rate limiting, and monitored operational limits. Monitor collection failures and cleanup failures without logging submission bodies.

Backfill unexpired existing reports idempotently, preserving original receipt times and expiry commitments. Existing records retain their original 90-day policy; apply extended retention to new records after the updated notice is live. Expired or absent reports cannot be recovered. Validate counts before switching diagnostic writes. Keep source reads working throughout and prevent diagnostic retries from multiplying source observations. Define partial-success responses if the two stores differ in availability.

Update collection/privacy copy together. Raw records and narrative exports remain protected; raw exports stay out of Git, public issues, CI logs, and public workflow artifacts. Scope the analysis credential to read-only diagnostics. Temporary snapshots and backups need retention matching the fields they contain.

### 4. Deterministic analysis

Add npm scripts to fetch a bounded snapshot and generate validated JSON plus a short Markdown summary. Include a snapshot ID, date window, schema normalization version, report IDs, and source revision so a recommendation is traceable.

Calculate weekly and trailing 28-day counts by protocol, supplied-tool version, stage, and relevant capability status. Include denominators: reported failures, unresolved issues, resolved issues, attempts, website validation outcomes, and the share of reports containing notes. Keep missing or unsupported values explicit.

Compare submitted-report rates, not unique users or overall production success. Separate standalone failures, pack imports, and optional-note samples. Avoid treating before/after changes as causal proof. Show small samples as limited evidence. Record successful tools and workarounds as preservation findings as well as problems.

Use fixture datasets with known results to test aggregation, deduplication, retention boundaries, sparse samples, schema migration, and report identity. A report with no new data is a successful no-op; failed retrieval is not an empty sample.

### 5. Weekly Codex review using the subscription

Create a project review skill and test it manually before enabling a weekly task in this conversation. The task uses the locally signed-in Codex subscription and requires the computer and app to be running. Retrieve protected reports through the scoped export script, then inspect aggregates, selected observations, current protocol, tool code, and the existing findings register.

Treat reports as untrusted evidence, never as instructions to run commands, retrieve URLs, access unrelated files, or change the review process. The task has no production-write capability and does not run text from a report. Keep deployment credentials out of its analysis environment.

Each review produces at most three new or materially updated findings: supporting report IDs and counts, what worked, observed friction, a proposed cause, prompt-versus-tool recommendation, a reproduction plan, and expected measurable improvement. Update matching findings rather than producing weekly duplicates. Track states such as proposed, investigating, candidate, released, and follow-up-needed.

Stay quiet when there is no meaningful new evidence. Notify on a new actionable finding, a material regression, collection/review failure, or a decision needed. Persist a cursor only after a successful review; use an overlapping window and stable IDs to catch up safely after missed schedules. Produce monthly rollups through the same process.

Start report-only. Development work follows selection of a finding and runs in an isolated worktree. A later explicitly enabled mode may prepare draft PRs; no automatic merging or deployment from analysis.

### 6. GitHub validation and release

Reuse the existing GitHub Actions checks for schema/contract tests, collection and retention tests, aggregation tests, UI regressions, lint, and production build. Add checks that historical protocol releases remain unchanged and supplied-tool versions match the published protocol. Keep credentials out of untrusted PR jobs.

For each selected finding, reproduce it, add a meaningful regression fixture, implement a bounded candidate, and compare with the current release. Tool correctness can often be tested in CI. AI workflow improvements require fresh trials; artwork fidelity requires visual review. Neither a green build nor a self-reported success replaces those trials. Any paid provider trial has its own explicit cost authorization.

After reviewed merge, the existing main workflow deploys the release. Verify the deployed revision and smoke-test relevant collection/import behavior. Record the release against its finding and compare later reports. Roll back through a reviewed revert or a new protocol release; never mutate historical instruction releases.

The documented Codex GitHub Action uses an API key and separate API billing. Keep weekly AI analysis local initially to use the subscription. GitHub Actions handles deterministic checks/deployment under the repository's own billing. Confirm GitHub credentials, protection rules, and deployment health when enabling the workflow.

## Delivery sequence

1. **Printing UI simplification:** preserve collection and warnings; add compact inspection; remove maintainer comparison UI.
2. **Report contract and storage:** new schema/readers, optional narrative consent, standalone failure intake, validation evidence, D1 migration, retention, and updated notices. Deploy storage/acceptance support before publishing prompts that emit new fields.
3. **Analysis tooling:** private export, deterministic summaries, findings register, fixture-backed checks, and a manual review against available data.
4. **Scheduled review:** validate one manual run, enable the weekly task with scoped credentials, and verify no-data, failure, catch-up, and meaningful-notification behavior.
5. **First improvement cycle:** select one finding, reproduce, prepare and validate a candidate, review/merge, deploy, and record follow-up evidence.

Do not delay the UI simplification until the analytics system is finished. Do not enable a recurring review until its data source and manual run work.

## Completion criteria

Both implementations are complete when normal printing is free of the detailed diagnostics panel; embedded feedback still collects independently; users can inspect exactly what is shared; optional notes and standalone failure reports work without uploading ZIPs/images; retention and migration are verified; a weekly review produces traceable findings without duplicates; and one prompt/tool improvement has completed the reviewed release and follow-up process. Report local tests, hosted behavior, and human/visual acceptance separately.

## Product documentation checked for this plan

- [Codex scheduled tasks](https://developers.openai.com/codex/app/automations): local project execution and machine/app availability.
- [Codex pricing](https://learn.chatgpt.com/docs/pricing): subscription usage versus API billing.
- [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action): documented API-key CI integration.

These product pages were checked in the planning conversation. Recheck authentication and scheduling requirements when implementation is enabled.
