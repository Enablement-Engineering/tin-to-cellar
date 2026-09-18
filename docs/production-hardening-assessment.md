# Production hardening assessment

Reviewed September 17, 2026 against `15de90da429a1d38ef34868cc281e6c84e3f4428`, which matched GitHub main during this review. Existing mobile/gallery changes were preserved. During this task, their owner committed them separately as `780a24887fd9eb749449dca1a0bdec25dfd8cebe`; final local build includes its follow-up `afc4c90987bc2ae3f122991a16ea1144a0944882` plus the hardening changes. This assessment is not a production certification.

| Feedback | Decision and evidence | Action |
| --- | --- | --- |
| Protect main and production | Valid. At assessment, GitHub returned no rulesets, `Branch not protected` for main, and no protection rules or branch policy for production. | Applied and verified PR/check protection including administrators, blocked force pushes/deletion, and a main-only production environment. Zero mandatory human approvals. |
| Enforce existing integration suites | Valid. The existing check job covered unit tests, lint, build, recovery and selected WebKit/mobile tests, but omitted gallery, security, accessibility and usage suites. | Add required browser jobs before deploy. Require gallery, security, usage and resilience suites plus a curated accessibility gate for core navigation, keyboard/focus, import, print and instruction recovery. Run that gate on every change so path filters cannot omit shared dependencies. The full legacy accessibility suite remains diagnostic pending fixture maintenance. |
| Improve incident diagnostics | Valid, with limits. The top-level catch discarded exception identity. Existing logs deliberately use bounded fields and 10% head sampling. | Add bounded failure categories and error-only random incident IDs under the existing opt-in switch. Account metrics and alerts remain separate work. |
| Broaden CSP | Valid defense in depth. The Worker only appended `frame-ancestors 'none'`; no injection defect was established by this feedback. | Added and locally checked the policy against bootstrap, OCR, PDF, imported print artwork and script/frame rejection. CellarPack validators are now precompiled; JavaScript unsafe-eval is removed, with a narrower WebAssembly permission retained for local OCR. |
| Expand/contract migrations | Valid. The workflow applies D1 migrations before Worker deployment. | Add explicit compatibility requirements and PR checklist. A text search for SQL keywords would not prove compatibility. |
| Manual browser, AT and print acceptance | Valid. Existing acceptance documents explicitly limit local browser/PDF evidence and do not establish physical output or native assistive technology acceptance. | Record the outstanding matrix below, without marking it passed. |
| Split large orchestration files | Reasonable future maintenance, not a demonstrated defect. The reported file sizes match this checkout. | Defer until a specific change exposes a useful boundary; avoid an unrelated rewrite. |
| Move immutable artifacts out of Git | Plausible future optimization, not evidence of initial bundle cost or a current production failure. | Defer pending measured transfer/deployment cost and preservation of immutable protocol history. |
| Missing license | Confirmed by GitHub metadata and absence of a repository license file. | User selected MIT. Added the standard license, package metadata and separate artwork/third-party scope notes. |
| Dependency/security automation | Dependabot and CodeQL configuration were absent. Application security tests already exist. | Added Dependabot and a deployment-gating CodeQL analysis job. Hosted scan results and severity protection must be verified separately. |
| Beta versus GA | A useful caution, not a result derivable from repository age or line count. | Tie any GA claim to release controls and recorded operational/manual acceptance. |

## Repository settings to apply after the new checks run

Require pull requests into main, block force pushes and deletion, and require the `check` job plus every `browser-check` matrix job to pass on the current PR revision. Keep PR branches current with main. The [release workflow](release-workflow.md) lists the exact check names defined in YAML; confirm those names in a completed workflow run before applying settings. The owner chose zero mandatory human approvals. Agent review is encouraged and does not add an approval gate.

Restrict the production environment to main with no required human reviewer. These settings were read during the original assessment, not changed by the documentation work. Merging a PR to main initiates the existing automatic release path, so merge authorization must cover deployment. See the release workflow for serialized ownership, verification and recovery.

## Outstanding GA acceptance matrix

Every result must identify commit/build, date, tester, platform/version, expected behavior, observed result and retained evidence. An unrun row stays outstanding.

| Gate | Required exercise | Current status |
| --- | --- | --- |
| VoiceOver and Safari | Import, select artwork, edit collection, prepare print, recover from errors; verify names, reading order, focus and announcements. | Outstanding |
| NVDA or JAWS on Windows | Repeat the main workflow with a supported browser and record the AT/browser pair. | Outstanding |
| Keyboard only | Complete main workflow, dialogs and recovery without pointer input; verify visible focus and no traps. | Manual acceptance outstanding |
| Zoom/reflow | Test 200% and 400% browser zoom, narrow viewport, dialogs, sticky controls and print preparation. | Manual acceptance outstanding |
| Physical print | Record printer model/driver, browser/OS, sheet stock, scaling and measured alignment on several representative combinations. | Outstanding; browser PDF is insufficient |
| Hosted controls | Verify real Access authentication, private no-store behavior, health, protected budget route, exact build, and disable/recovery behavior. | Refresh against release candidate |
| Operations | Record observation period, traffic, failures, alert delivery and incident response, including privacy settings and retention. | No new hosted evidence gathered |

The code changes in this task do not deploy, publish artwork, enable analytics, configure account alerts, or establish any of these manual results.

## Additional findings from validation

The broader accessibility run exposed a real scrollability issue in expanded prompt code blocks. These blocks now accept keyboard focus and have an accessible group name. The existing axe check remains enabled. Dialog tests now wait for the exit animation before checking restored focus. Gallery fixtures were updated to the current browse endpoint and local pagination behavior.

The gallery browser suite also contained an outdated navigation expectation and exhausted shared local test quotas. The test harness grants test mode a larger quota while preserving ordinary development and production settings. Unit security tests retain rate-limit coverage.

## Local verification record

- Full unit suite: 829 passed across 101 files with two workers. The first highly parallel run failed two UI readiness assertions; both passed in a focused rerun and in the complete two-worker run.
- After the prompt/CSP follow-ups: 30 focused component and Worker tests passed. Gallery security tests separately passed 55 cases.
- Built-Worker security: two tests passed, including real OCR/PDF processing, pack import, print artwork, theme, injected script blocking and framing.
- Gallery: all six tests passed, including unpublish/revocation and public import/print. A temporary fixture copy changed only the loopback port because an existing user server occupied the default port.
- Usage: all 12 passed. Usage resilience: all 14 passed. An initial usage failure occurred while parallel builds replaced files under a running server; the stable-build rerun passed.
- The broad 131-case accessibility run was stopped after exposing stale fixtures and prompt scrollability problems. It is not a passing acceptance result. The workflow selects 45 core cases instead.
- GitHub workflow execution, branch/environment settings changes, production deployment, account alerts and native/physical acceptance were not performed by this task.

A further import test caught duplicate network dispatch during development StrictMode effect replay and resubmission of already-sent receipts after a component remount. Contribution sharing now waits one microtask and checks cancellation before sending. A persisted-delivery guard prevents remount resubmission. Unit tests cover StrictMode and already-sent remount behavior, and the browser fixture still requires exactly one request. The accessibility server configuration now requests graceful shutdown so the local launcher can clean up its detached Worker children.

Final browser follow-up: all 45 curated accessibility cases passed across runs. The first run passed 44; the failing import case then passed with the original single-request assertion, alongside three repeated dialog/prompt checks. That four-case rerun exited cleanly with graceful shutdown. The corrected gallery pagination case and both collection viewport cases also passed separately. This is combined local evidence, not a single green GitHub workflow run.

Final build/typecheck, lint and diff checks passed. The build continues to report existing large-chunk warnings.

After both diagnostic-dispatch fixes, the final complete unit run passed 831 tests across 101 files with two workers.

## Follow-up implementation

The user selected standard MIT after discussing visible attribution. LICENSE and package metadata now declare MIT for original software, with LICENSING.md explaining separate artwork and third-party rights. Operational alerts should go to dylan@enablement.engineering; Cloudflare notification configuration and delivery testing remain pending.

CellarPack validators now generate before dev/build/test, preserving the schema and validation errors while removing runtime schema compilation from browser code. CSP excludes JavaScript unsafe-eval and permits only the WebAssembly compilation needed for local OCR. Two built-Worker browser security cases passed, including explicit dynamic JavaScript compilation rejection. The complete unit suite passed 833 tests across 102 files; lint and build/typecheck passed.

CodeQL is added as a required deployment dependency. The first hosted analysis completed and identified one high-severity finding in a test's HTML-parsing regex; the test now uses an inert DOM parser. The updated scan must confirm resolution. The separate code-scanning severity rule needs a main-branch baseline before activation. GitHub branch and environment protections were applied and verified on 2026-09-18 UTC, requiring PRs and checks with zero mandatory human approvals.
