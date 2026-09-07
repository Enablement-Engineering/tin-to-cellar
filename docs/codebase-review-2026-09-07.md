# Codebase review, 2026-09-07

## Current status after reconciliation

All applicable review fixes and both performance improvements are now integrated in the current release branch. Use the [review implementation and release status](codebase-review-work-plan.md) for current verification, production status and preserved work.

R-01, R-06 and R-08 have been adapted to the newer application; the existing cost, privacy and focus fixes are retained. R-02's secured research receiver remains preserved on main and absent from the newer application. R-11 now defers archived instructions/admin code and avoids repeated source-report counting scans.

The user has settled the privacy and budget policy: known catalog URLs only, pause diagnostics at the allowance, preserve local labels, and target the existing $5 monthly plan. The implemented starting allowance is 1,000 attempts per UTC day, with a daily Codex monitor. Production pausing and alert delivery are not verified. No further product decision is needed to begin the remaining local work.

## Original review record

The material below records the earlier checkout and its tests. It is historical evidence, not a claim about the current upstream application or a deployed combined release.

This review covers the current working tree, including the existing uncommitted diagnostics migration and UI changes. Three subagents reviewed security, cost management, and accessibility. The coordinating agent reviewed code quality, assessed the findings, and assigned implementation to those agents with separate file ownership.

The application builds a portable AI prompt, reads the returned CellarPack locally, and places validated artwork on printer sheets. PDF extraction and screenshot OCR run locally. The Worker collects bounded diagnostics and package-source observations. It does not currently run paid AI inference, cloud OCR, or hosted proof rendering.

## Assessed work

P2 means a concrete defect to fix in this maintenance pass. P3 means a lower-impact maintenance issue. R-01 through R-09 were implemented in the original local checkout. Their status in the newer application is recorded above. The table retains the reviewed behavior and original delegated ownership.

| ID | Priority / area | Confirmed behavior and consequence | Assigned work / owner |
| --- | --- | --- | --- |
| R-01 | P2 security | An undeclared artwork asset ID such as `constructor` resolves an inherited property of the asset map, then crashes import instead of quarantining the bad label. | Require own-property lookup and test preservation of a valid sibling label. Security agent, `src/lib/cellarpack/`. |
| R-02 | P2 security | The optional local research receiver accepts unauthenticated cross-origin writes with no body limit. A page visited while it is running can overwrite staged research or consume local resources. | Authenticate the local handoff, reject unauthorized origins, bound input, and test failure paths. Security agent, `scripts/catalog/receive-package-research*`. |
| R-03 | P2 cost | Every public source GET reaches the shared Durable Object, including invalid catalog IDs, without a read limiter. | Validate catalog membership first and use a separate read limiter. Cost agent, `worker/` and `wrangler.jsonc`. |
| R-04 | P2 cost / privacy | A failed legacy migration prevents the scheduled deletion of expired D1 reports and notes. | Attempt cleanup even after migration failure and preserve both errors if both operations fail. Cost agent, `worker/`. |
| R-05 | P2 accessibility | Sharing a standalone report removes the focused button. Browser verification found focus on the body and the next Tab on the footer, skipping the replacement diagnostics controls. Retry has the same removal pattern. | Move focus to a stable diagnostics control and test keyboard transitions. Accessibility agent, diagnostics components and browser tests. |
| R-06 | P2 quality | Optional diagnostic preparation runs before usable artwork is installed. A preparation exception enters the ZIP rejection path and can leave newly allocated object URLs unreleased. | Separate diagnostic failure from import success and verify printable labels plus URL cleanup using fault injection. Accessibility agent, `src/App.tsx` and its tests. |
| R-07 | P3 quality | Help refers to removed feedback controls, and a browser smoke test expects a retired protocol API to return 200. | Update the help and test the current embedded-protocol workflow plus retired route behavior. Accessibility agent, help and API smoke test. |
| R-08 | P2 quality / resource use | PDF reading receives no abort signal from the order importer. Cancellation ignores late results but leaves parsing running; a stuck parser can outlive the UI timeout. | Verify and connect cancellation to PDF task destruction with a pending-task regression. Cost agent owns `src/lib/order-import/`; accessibility agent owns the UI call site. |
| R-09 | P2 privacy | HTTPS validation removes queries, credentials and fragments, but arbitrary URL paths can still contain account names or tokens. Automatic source collection transmits those paths. | User selected automatic sharing of known catalog URLs only. Security agent enforces exact per-entry catalog membership; cost agent filters legacy public suggestions; accessibility agent updates disclosures. Local manifest provenance is preserved. |

The receiver's revised handoff is preserved in `docs/catalog-research-receiver.md` on original main. The receiver is absent from the newer application.

## Decisions and follow-up work

| ID | Assessment | Next work |
| --- | --- | --- |
| R-10 | Original finding: no aggregate diagnostic write budget or volume alert was configured. No excess billing was established. | Policy is now settled and local allowance code exists on the newer branch. Production verification remains open; see the reconciled plan. Do not restore the intentionally removed 1,000-report D1 limit. |
| R-11 | P3 performance: the initial production JavaScript bundle is about 3.27 MB, 676 kB gzip. Legacy source submission also materializes up to 1,000 reports just to count them. Both deserve measurement, but are bounded or architectural concerns rather than demonstrated outages. | Measure catalog payload and startup cost before choosing a split. Consider a transactional source-report count if storage operations justify it. |

## Strengths and review limits

The import pipeline bounds ZIP extraction and decoded image budgets, accepts raster artwork, and renders manifest text without executing imported HTML. Provenance URLs are not fetched by the Worker. Collection uses strict shapes and parameterized database statements. Existing UI tests cover skip navigation, focus, responsive layouts, print controls and automated accessibility scans.

The baseline passed 173 unit tests, lint and production typecheck/build. The initial fresh-server browser run passed 30 cases and exposed the stale protocol-route assertion. `npm audit --json` completed against the npm advisory service with zero reported vulnerabilities across 398 dependency entries. This is an advisory check, not proof that dependencies have no vulnerabilities.

Historical validation of the original checkout passed:

- `npm test`: 192 tests across 32 files, including receiver tests and new cancellation, source privacy, importer and cleanup regressions.
- `npm run lint`: passed without findings.
- `npm run build`: protocol release 0.0.19 verified, TypeScript project checks passed, production bundle built. The large initial bundle warning remains tracked in R-11.
- `npm run test:a11y -- --workers=3`: 32 tests passed against a fresh local Worker server. Coverage includes Axe, keyboard transitions, responsive reflow at 320/640/1280 pixels, forced colors, reduced motion and local API behavior.
- `git diff --check`: passed. A final synthetic account-name substitution in the privacy fixture was followed by all seven contribution tests passing.

These original-checkout results established local fixes for the confirmed defects and no reported dependency advisories at that review time. They do not establish that those fixes are integrated into the newer application. Performance and manual accessibility coverage remain tracked in the reconciled plan.

This original validation did not include deployment, production load testing, billing inspection, actual browser zoom, a native screen-reader session or a third-party video accessibility audit. At that point unrelated edits remained uncommitted. Subsequent local commits and budget work are recorded in the reconciled plan; they do not establish a combined production release.
