# Gallery validation checkpoints

September 6, 2026. Implementation checkout: `/private/tmp/tin-to-cellar-gallery`, branch `codex/community-gallery`, based on `919aa50f461dd63413f6f5d1d99ac611e4a8675c`. The saved mixed checkout was not used for implementation. The initial local-validation checkpoint used no remote provisioning, deployment or public artwork submission. The later authorized staging deployment and current hosted checks are recorded below; no production gallery deployment, commit or push is claimed.

## Earlier validation before submission simplification

The earlier real local Worker, D1 and R2 completed private submission, reviewer approval, public download, CellarPack reimport, print output, withdrawal, unpublish/republication, and delayed deletion. Production authentication was not weakened: a separate test Worker injects local authentication fixtures; signed JWT and Turnstile checks also have focused tests.

The browser uploads only explicitly selected artwork and allowlisted metadata. Tests prove no gallery write on ZIP import or selection alone, no private research/extension payload, no automatic resubmission or diagnostic contribution when using a gallery label, and no stale diagnostics after a trusted demo import. Approval requires the reviewed version and digest. Pending, withdrawn and unpublished artwork cannot be fetched through public detail, thumbnail, artwork or pack URLs, including conditional requests.

Raw uploads must match the selected CellarPack asset's SHA-256 and size. Normalization keeps decoded pixels unchanged. The generated download uses the exact canonical full-resolution PNG and its current hash. A matching hash does not bypass decoding, geometry, private review, or prove authorship.

User-authorized local Downloads testing used two existing packs, selecting one Orlik Golden Sliced design and one Autumn Evening design. Both completed submission, approval, download, reimport and withdrawal. Their original archives remained untouched. Full decoded pixel arrays matched after normalization. Printed outputs were one-page US Letter PDFs; rendered inspection preserved each blank writing area. Physical printer alignment is unverified.

Auditing 22 Downloads archives found 12 ready, 8 partial and 2 rejected imports. There were 28 usable labels, of which 16 passed gallery eligibility after two fixes. The real files exposed incorrect gallery geometry assumptions: normalized writing-area coordinates use the finished surface, and rounded-corner radii follow the existing CellarPack schema/helper contract. Gallery now reuses those rules. The remaining 12 usable labels contain embedded ICC profiles, which the gallery deliberately does not convert or silently strip. They can still print locally.

Private local evidence is ignored under `output/gallery/` and `.wrangler/download-pack-audit.json`. Original archives, manifests, private notes and artwork are not committed as fixtures. The Downloads tests require explicit environment variables and do not inspect personal folders by default.

## Checks

| Check | Result |
| --- | --- |
| `npm test` | Current simplified contributor/admin/agent run: 262 tests in 42 files passed. The earlier repair checkpoint was 228 tests in 39 files. |
| `npm run lint` | Passed. |
| `npm run build` | TypeScript and production build passed (448 modules); Vite reports the existing large-bundle warning. |
| `PROTOCOL_BASE_SHA=919aa50f461dd63413f6f5d1d99ac611e4a8675c npm run protocol:history` | All 20 historical releases unchanged; new local draft is 0.0.21. |
| `npm run test:a11y` after local diagnostics migration | All 31 browser/API tests passed, including narrow views and keyboard checks. |
| Gallery local Worker/browser tests | Five cases passed across the main run and a focused rerun: synthetic API/browser flows, two Downloads positive flows, and a Downloads ICC-profile rejection that preserves local printing. The maximum 2048px synthetic image completed the real local Worker path. |
| Image normalization benchmark | A synthetic 2048px, 6.4MB image retained its decoded pixels; measurement is local only. |
| `git diff --check` | Passed. |

One full-unit run timed out on the existing ten-label example import while browser work was running concurrently. The full suite passed when rerun without that contention. Browser test fixes corrected a test-only cleanup route, accessible select lookup, retired API expectations, and write-only diagnostics counting; none weaken production assertions.

## Earlier admin correctness follow-up

The [admin and agent plan](gallery-admin-plan.md) exposed two UI contract defects and an audit persistence gap. The UI now sends the backend's expectedVersion-only republish payload and keeps unpublished metadata read-only. Two component regressions cover these controls. Review mutations and contributor withdrawal now commit their state changes and corresponding audit events in a single D1 batch, with event creation conditional on the guarded update succeeding.

Seven SQLite trigger-injected audit failures cover correction, duplicate, approval, rejection, unpublish, republish and withdrawal: a failed event leaves no completed transition or new event, and retry records one event with the committed version/digest. Competing reject/edit requests produce one success, one conflict and one event. The final full unit suite, lint, typecheck/build and whitespace checks pass.

Both synthetic local Worker/browser workflows passed again after the repair. A read-only query against that run's local D1 confirmed exactly two approval, one unpublish, one republish and two withdrawal events. Test authentication remains confined to the local harness. The first browser launch was blocked by sandbox loopback/log-file permissions; the permitted local rerun passed. That repair checkpoint was local only. The expanded admin presentation, machine authentication and advisory recommendations have since been implemented; see the later staging checkpoint below.

## Authorized staging checkpoint

The enabled staging Worker completed fresh human OTP login, queue/detail loading and full-resolution 2048px synthetic-artwork inspection. A real browser explicitly selected and submitted synthetic artwork through Turnstile to private review. Personal Downloads artwork was not uploaded.

A selected machine grant permitted scoped queue and artwork reads; the downloaded image matched the canonical SHA-256. Recommendation submission and identical replay returned one ID. After a human metadata correction, the prior advice displayed stale and a request bound to the old version/digest was denied. Human approval published the reviewed version. The downloaded public CellarPack contained the canonical image bytes, and actual browser “Use label” produced one imported label and one print sheet.

The imported gallery pack has the expected `LIMITED_RESEARCH` warning: private original research is deliberately omitted during reconstruction. Current generator/importer verification returned `ready`, one usable label and exactly this visible warning. It is not a print, geometry or image-hash failure.

Human unpublishing then made public detail, thumbnail, artwork and pack routes all return 404 with `Cache-Control: no-store`. Revoking the machine grant caused the real client to return `access_denied`. The test publication is no longer public; the submission remains unpublished/private under its retention schedule. Earlier unauthorized and wrong-host denial checks also passed. This is hosted staging evidence, distinct from local fixture authentication.

Current simplified-flow validation passed **262 tests in 42 files**, lint, the 448-module build and all 20 historical protocol versions. All three updated real local Wrangler/D1/R2 end-to-end flows also passed. Prior restricted-server EPERM was resolved by an approved rerun; no production authentication bypass was introduced.

The temporary setup token was deleted through the UI and rejected by a follow-up API request with 401 Invalid API Token. Temporary setup-secret copies were removed; protected ongoing agent credential files remain. No secret values are recorded here.

## Current contributor flow and release boundary

The user removed contributor status links and withdrawal controls. Successful upload now displays “Submitted for review”; internal same-tab reservation/upload retry state remains, while admin rejection, unpublishing and retention continue. Earlier withdrawal/status assertions in the historical sections describe the retired flow. Updated local tests cover the simplified behavior.

The simplified staging redeployment completed as Worker version `f15e9fdc-6004-4abd-ab5a-f8eaa6b7067d`. A fresh synthetic 1024px ZIP passed actual browser import, explicit selection, Turnstile and private submission, ending with “Submitted for review.” and zero private/status links. Hosted GET contributor status, GET preview and POST withdrawal each returned 404. Production root configuration now has actual bindings and enabled Worker flags, but all three production database switches remain 0 and implementation commit `0fff239` is pushed only to the feature branch. No production gallery feature deployment or main-branch update has occurred; direct main push was rejected by automatic approval review and [pull request #3](https://github.com/Enablement-Engineering/tin-to-cellar/pull/3) is prepared. Complete the separate production release and verification before claiming production availability. There is no pending OTP step. Software and hosted staging checks do not establish physical printer alignment, artwork fidelity or rights.

## Consent and completion refinement

The sharing agreement now says: “I created or generated these labels and agree to share them through Tin to Cellar for personal cellaring.” New submissions use notice version `2026-09-06-v2`; existing v1 consent remains unchanged and reviewable. Retention details are collapsed, and completion appears in a compact result card. Expired upload reservations cannot produce a false success; a deliberate new submission is required. The full 262-test suite, lint and build pass.

The final consent/status build is deployed on staging as `818fd726-ae7a-4018-b849-093bbae20292`. A fresh synthetic 1024px browser submission passed v2 consent and Turnstile, displayed the compact confirmation with no private links, and remained private. The rendered confirmation was visually inspected. All three final local integration workflows passed.
