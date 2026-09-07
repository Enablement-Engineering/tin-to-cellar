# Review implementation and release status

Updated September 7, 2026. This supersedes the preparation snapshot at commit `a6c7b11`. The user authorized completion, testing and deployment after reviewing that plan.

All applicable R-01 through R-11 implementation work is now integrated on `codex/diagnostic-cost-controls`, based on the newer gallery and saved-label application. All combined local checks pass. Production deployment and live verification are next; deployment is not yet claimed.

## Finding disposition

| Finding | Completed work |
| --- | --- |
| R-01 | Own-property asset lookup quarantines an undeclared inherited name while preserving a valid sibling. |
| R-02 | The authenticated, bounded local research receiver and its tests remain preserved on original main. That optional receiver is absent from the deployed application source and has not been reintroduced. |
| R-03 | Public source reads validate canonical catalog membership before the dedicated 60/minute limiter and storage dispatch. Namespace 1006 preserves gallery namespace 1005. |
| R-04 | Legacy migration, diagnostic retention and gallery retention run independently; failures stay observable. |
| R-05 | Standalone sharing, retries and optional-note actions retain useful keyboard focus. Background submission completion does not steal focus. |
| R-06 | Optional diagnostic generation/validation and retrospective failures do not reject usable artwork. Integrity checks, collection revisions and durable-save failures remain strict. Both print-preview and import-review partial URL allocations are released; import review has a retry that preserves choices. |
| R-07 | Help and API tests follow current controls and retired route behavior. Older approved eyebrow cleanup is selectively retained. |
| R-08 | PDF cancellation reaches loading, page/text extraction and teardown; late results cannot replace the current order. Current canonical identity and save-retry behavior is preserved. |
| R-09 | Client, server and legacy suggestions share only exact URLs in the corresponding current catalog entry. Saved structural parsing, fingerprints, receipts and canonical aliases remain unchanged. |
| R-10 | Reports and notes share an atomic daily allowance with manual pause, UTC reset, fail-closed errors and authenticated aggregate status. The existing daily Codex budget monitor remains active. |
| R-11 browser | Lightweight revision metadata no longer imports archived instruction bodies. Instructions, gallery panels and admin screens load when needed. A failed instruction download has deliberate reload recovery with saved labels and keyboard focus retained. |
| R-11 server | The retained source-report count initializes once, updates atomically with inserts/deletions, and eliminates report-list scans from warm admission. Alarm cleanup cannot overwrite a concurrently refreshed source. |

## Settled policy and operational boundaries

Automatic sharing is limited to known catalog URLs; unfamiliar provenance stays local. Diagnostic collection pauses at the allowance while local label workflows remain usable. The target is the existing $5/month Cloudflare plan with no additional usage charges.

The configured starting allowance is 1,000 validated report/note attempts per UTC day. It includes duplicate attempts and interrupted persistence. It is an engineering default, not a user-selected dollar conversion. The daily allowance is separate from the pre-existing 1,000 retained source-report limit and does not impose a D1 retained-report cap.

The Codex monitor checks daily at 9 a.m. and reports meaningful billing changes or newly observed pauses in the originating task. It is periodic notification. The allowance does not bound all requests, source reads, gallery work, retention work, subscriptions or other projects' usage, so it is not a hard cap on the account bill.

## Verification

- `npm run test`: 370 tests across 56 files passed on the completed source.
- `npm run lint` and `npm run build`: passed.
- `npm run protocol:history -- 343bfb78414d32f3dc00a50fab9c2463a980153a`: all 22 historical releases unchanged.
- `npm run test:gallery`: all four local Worker/D1/R2 browser flows passed, including private submission, review, publication, public reimport/printing, grant scope and revocation.
- `npm run diagnostics:smoke`: actual disposable local Worker verified manual pause/resume, combined report/note quota, denied persistence, protected aggregate status and allowance persistence across restart. Only synthetic data and isolated local storage were used.
- `npm run test:a11y -- --workers=3`: all 54 browser cases passed on the final full rerun, including instruction-download recovery and the initial network-size target. Earlier runs exposed and led to the fixes recorded above.
- `git diff --check`: passed.

The initial entry bundle decreased from 850.99 kB gzip to about 290.78 kB gzip, approximately 66%. A browser test totals all initially requested JavaScript and checks the 30% reduction target plus absence of archived instruction bodies and admin code on home. Current and historical handoffs remain self-contained once prepared. The remaining large-chunk warning applies to deferred archive content as well as the entry; it was not disabled.

Real browser zoom, native screen-reader behavior, third-party video accessibility and physical printer alignment have not been established by these automated checks. They are coverage limits, not claims of passed manual testing.

## Preservation of existing work

The original local main was not reset, rebased or merged wholesale over the new application. Existing user edits to artwork-production and worklist JSON files remain untouched.

| Original commit | Final disposition |
| --- | --- |
| `cef1158` | Approved redundant-eyebrow removals selectively applied to current components. Removed configurator architecture is superseded by the saved-label workflow. |
| `13fdbc0` | Package-reference research/catalog data preserved on main for separate identity-aware data work; current catalog and canonical identity records were not replaced. |
| `ced9e1e` | Community production scripts and evidence preserved on main for the ongoing production workflow. |
| `13b65ed` | Secured receiver and tests preserved with that optional research workflow. |
| `823c1b8` | Asset and PDF protections integrated into current code. |
| `f325537` | Equivalent diagnostics already upstream or adapted here, including current privacy, focus, budget and import-resilience behavior. Old components were not copied wholesale. |
| `ff7743d` | Historical planning retained in Git; this document governs current review status. |
| `7d46502` | Approved packaging/publication work preserved with its source evidence on main, outside this review release. |

No generated artwork, build output, dependencies, private diagnostics, credentials or production working records are included in the review commits.

## Release and recovery

The production release uses the existing repository deployment workflow and existing Cloudflare resources. After deployment, verify the exact served asset hash, protected aggregate endpoint, admin routing and built-in example import/printing/reload, with no diagnostic or gallery submission from that example action. Record the deployment result here.

Do not roll back to an older source-report writer after it starts modifying counted records without arranging a transactional count rebuild before the optimized writer resumes. A forward fix using the current counter implementation preserves the invariant. Current tests cover rollback of failed transactions, initialization, drift detection and alarm/insert interleaving.

The daily monitor's configured alert path and authenticated production status can be checked without deliberately exhausting production allowance. A real future exhaustion notification must not be claimed before it happens; local smoke tests establish pause behavior without interrupting real users.
