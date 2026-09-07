# Review reconciliation and implementation plan

Reconciled September 7, 2026. This is the working status for all R-01 through R-11 findings in [the original review](codebase-review-2026-09-07.md), the decisions made in this task, and preservation of existing work. It supersedes the original review's completion and pending-decision statements. Preparation is complete; implementation of the remaining work below has not begun.

## Verified branch state

Remote references were refreshed for this reconciliation.

| Checkout | Code revision | Role |
| --- | --- | --- |
| Main project, local `main` | `7d46502` | Original review fixes, catalog references, and community-production work. Eight commits ahead and 28 behind `origin/main`. |
| `origin/main` | `343bfb7` | Newer gallery and durable saved-label application. A remote branch is not deployment proof. |
| `codex/diagnostic-cost-controls`, currently `/private/tmp/tin-cost-controls` | `6773c75` | Implementation base for the remaining review work. Includes current upstream plus cost controls and adapted privacy/focus fixes. |

Both implementation checkouts were clean before these documentation changes. Do not merge the old application wholesale over the newer one. Apply isolated fixes to the cost-controls branch and adapt changes that cross the saved-collection boundary. Documentation commits after these revisions do not imply additional runtime fixes.

## Decisions already settled

- Automatically share only URLs already known to the corresponding catalog entry. Unfamiliar URLs remain local. Keep local provenance, saved fingerprints, canonical IDs, and persisted receipts intact.
- Pause diagnostic submissions when the daily allowance is reached; keep local import, label creation, and printing available.
- Target the existing $5/month Cloudflare plan without additional usage charges. Report if that becomes infeasible.
- The implemented starting allowance is 1,000 validated report/note attempts per UTC day. This number was an engineering default, not a user-selected dollar-to-volume conversion. It is configurable and includes retries and interrupted persistence.
- The existing Codex monitor checks daily at 9 a.m. and alerts in this task about material billing changes or newly observed pauses. This is periodic notification, not an immediate email. Production endpoint access and a real pause notification still need verification after deployment.
- Preserve all existing work. Local fixes, a commit, integration, and deployment are separate milestones. Nothing in this reconciliation authorizes a push, deployment, paid provider run, or deletion of preserved work.

No product decision needs to be asked again before the local implementation work below. The diagnostic allowance limits admitted persistence attempts; it is not a hard cap on the whole Cloudflare bill.

## Finding-by-finding disposition

“Ready locally” means present on the implementation base, not live on the site.

| Finding | Verified status on implementation base | Required action |
| --- | --- | --- |
| R-01 asset own-property lookup | Missing. Fixed on original main only. | Port isolated importer change and sibling-preservation regression. |
| R-02 local research receiver | Receiver absent from current upstream application. Secured receiver and tests are preserved on original main. | Do not resurrect obsolete tooling merely to close a finding. Any later restoration must include authentication, origin checks, body/deadline limits and tests. Track with preservation work below. |
| R-03 source read limiter | Ready locally. Canonical catalog prevalidation and separate namespace 1006 preserve gallery namespace 1005. | Retain and include in combined verification. |
| R-04 independent retention cleanup | Ready locally. Migration, diagnostics cleanup and gallery cleanup execute independently with observable failures. | Retain and test combined failure paths. |
| R-05 keyboard focus | Ready locally with current saved-receipt interfaces. | Keep new components; do not copy old components over them. |
| R-06 optional diagnostics blocking import | Missing. `PublicApp.processResult` awaits contribution preparation before usable import; `prepareImport` also rejects invalid diagnostic input. | Adapt error isolation to durable collections. Keep genuine artwork, identity and storage failures visible. |
| R-07 Help and retired protocol route | Current upstream already resolves the original defects. | Preserve current Help and API tests; align source/pause wording where needed. |
| R-08 PDF cancellation | Missing. Current PDF library has no signal and current UI omits it. | Port library/tests; add signal at the current UI call site without replacing newer order-selection logic. |
| R-09 exact catalog URL policy | Ready locally, adapted to current catalog `sourceUrl`. Local parsing is separate from sharing validation. | Retain client retry filtering, server admission checks and legacy suggestion filtering. Do not restore old catalog structures blindly. |
| R-10 allowance and alert | Code and daily monitor prepared. Production rollout unverified. | Verify local admission/denial/reset, then deployed endpoint, monitor access and actual alert after an authorized release. |
| R-11 browser performance | Measured; optimization unfinished. | Separate archived protocol content and expensive application modules from initial loading, then measure again. |
| R-11 server counting | Unfinished. New source reports still scan up to 1,000 retained reports just to count them. | Add a transactionally maintained count with safe initialization and expiry handling. |

## Ordered work and ownership

These are bounded implementation assignments, not claims that agents are already editing. The coordinating agent integrates and validates the result.

### W1. Restore importer and cancellation protections

Library/security owner: `src/lib/cellarpack/importer.ts`, its tests, `src/lib/order-import/index.ts`, and `pdf.test.ts`. Website owner makes the single signal call-site change in `OrderImporter.tsx`.

Port the isolated R-01 diff and R-08 library tests from main. Preserve current canonical order identities, reviewed choices, asynchronous saving, and failed-save recovery.

Acceptance: an undeclared inherited asset name is quarantined while a valid sibling survives. PDF cancellation settles during pending load/page/text/teardown; a pre-aborted request does not start work; successful reads clean up. Timeout and cancellation release the UI without applying late results.

### W2. Adapt diagnostic failure isolation

Website owner: `src/PublicApp.tsx`, relevant components and UI tests. Coordinate any collection-library interface change with the library owner.

Separate optional contribution generation/validation from candidate construction and saving. An optional diagnostic failure must permit usable artwork to reach review, persistence and printing, with an actionable notice. Do not catch and suppress integrity errors or IndexedDB failures. Keep the collection module's strict invalid-input guard; validate optional output and substitute null at the application boundary. Optional retrospective processing must not derail artwork import either.

Current artwork URL ownership is in `src/hooks/usePrintLabels.ts`. Its effect allocates URLs before registering cleanup, so a failure after one allocation can leak that URL. Include a partial-allocation regression and release those URLs when projection fails. Preserve the prior usable preview where feasible. The old App's object-URL cleanup patch is not automatically appropriate here.

Acceptance: fault-injected diagnostic generation and malformed optional receipts do not discard usable labels. A real storage failure leaves prior saved work intact and exposes retry. Verify reimport, duplicate detection, receipt delivery, quarantine and URL cleanup/unmount behavior. Retain R-05 focus behavior and current gallery/example privacy rules.

### W3. Complete source-count optimization

Server owner: `worker/contributions.ts` and server tests. This can run alongside W1/W2.

Initialize a versioned retained-report count once from the bounded existing scan. Increment with successful insertion in the same transaction. Duplicates and rejected inserts must not increment. Delete expired reports and decrement the number actually deleted transactionally so alarm/collection interleaving cannot drift.

Acceptance: legacy initialization, simultaneous inserts at capacity, duplicate submission, alarm/insert interleaving, repeated cleanup, corrupt counter and interrupted migration tests pass. Warm admission performs zero report-list scans. Preserve retention, source ordering, migration idempotence and the separate 1,000 retained-report capacity; do not impose that retained-row cap on D1 diagnostics.

### W4. Reduce initial JavaScript

Prompt/protocol owner handles protocol metadata and archived content. Website owner handles app, route, admin and gallery loading after W2 settles. Coordinate exported interfaces before changing synchronous prompt/repair functions.

Baseline build from current upstream: 3,449.55 kB initial JavaScript, 850.99 kB gzip. The source protocol archive is 2,096,069 bytes and includes historical releases. Lightweight revision checks must not import archived instruction bodies. Load the required immutable content when preparing a handoff or repair, then keep the prepared handoff self-contained. Handle loading failures with retry and preserve the portable fallback. Avoid eager gallery barrels and defer pack construction where appropriate.

Acceptance target: at least 30% reduction in total JavaScript transferred for an ordinary initial home visit under the same build/browser conditions. No historical instruction bodies or admin module requested on that visit. Measure both bundle sizes and network requests. Preserve exact historical repair text/hashes, numeric/semantic revision handling, direct routes, offline prepared prompts, focus, gallery imports, saved collection state and print rendering. Do not satisfy the target by merely renaming chunks or disabling warnings.

### W5. Preserve and reconcile existing production work

Coordinator owns the commit inventory and dispositions. Keep main's original commits reachable:

| Commit | Preserved work | Integration rule |
| --- | --- | --- |
| `cef1158` | Removal of redundant UI eyebrows | Compare with current UI before any copy-only port. |
| `13fdbc0` | Verified catalog package references | Preserve research evidence. Map to current canonical identities before restoring any data. |
| `ced9e1e` | Community reference production workflow | Preserve scripts/data and document which remain useful with current gallery tools. |
| `13b65ed` | Authenticated research intake | Restore only if that receiver remains needed, always with its security tests. |
| `823c1b8` | Asset and PDF protections | Port through W1. |
| `f325537` | Diagnostics/privacy/accessibility work | Most equivalents exist upstream or in cost controls; adapt R-06 through W2. Do not wholesale cherry-pick the old app. |
| `ff7743d` | Review and label-library planning | Preserve history; this plan governs present review status. |
| `7d46502` | Approved community packaging and verification | Preserve approved artifacts and source evidence. Reconcile with current gallery publication workflow separately from review fixes. |

Acceptance: every main-only change has a recorded disposition of integrated, superseded by verified current behavior, or preserved for separate work. Nothing is silently discarded. Do not remove worktrees with unique work or rewrite user commits.

### W6. Combined verification and operational handoff

Coordinator runs relevant tests after each work package, then one full test/build/lint run on the combined revision. Run fresh-server accessibility and relevant gallery/collection browser checks after integration. Keep protocol archive verification and gallery admin access checks intact.

Required behavior: bad assets preserve valid siblings; canceled PDFs stop work; diagnostic preparation failure still permits printing; quota exhaustion and reset preserve labels; unknown URLs are never shared; saved collection identity survives; focus is predictable through share/retry/loading; legacy cleanup and source counts remain correct.

Record the exact combined commit and results in this document. Verify narrow layouts, keyboard and automated accessibility. Actual browser zoom, native screen-reader behavior and third-party video accessibility remain unperformed review coverage, not passed tests. Record outcomes or explicit remaining limits rather than claiming full manual accessibility coverage.

After an authorized deployment, verify the aggregate endpoint with existing credentials, read-only monitor access, synthetic allowance pause/reset and a delivered pause alert. Check account-wide included usage and charges. Do not claim a guaranteed $5 ceiling from the local counter or claim deployment from local tests.

## Evidence boundaries

The original branch previously passed 192 tests and 32 browser cases. Cost-controls code previously passed 342 unit/integration tests; 50 cases in a full browser run plus four corrected feedback reruns cover its 52 cases. Build/typecheck and lint passed for that batch. Those are historical results for different code revisions and must not be added together or described as verification of the eventual combined branch.

This reconciliation used source comparison, refreshed Git references, three independent preparation audits and the existing monitor configuration. It did not run new runtime tests, deploy code, inspect current billing or complete performance implementation.
