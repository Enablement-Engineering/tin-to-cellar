# Usage analytics validation

September 16, 2026. Local evidence after integration with `f03129d`, including its app-recovery and release-verification changes. Implementation commit `da95d6d`; the accompanying follow-up updates existing browser assertions, one gallery disclosure, and this record.

## Passed

- `npm test`: 90 files, 772 tests. Includes the existing recovery tests and the new analytics/client/SQLite/authentication regressions.
- `npm run build`: TypeScript and production build pass. The existing large-chunk warning remains.
- `npm run lint`: passes without findings.
- Explicit Worker TypeScript check: passes with ES2023, bundler resolution, DOM/Node types, and no emit.
- `npm exec -- playwright test --config playwright.usage.config.ts`: eight Chrome checks pass against an isolated local Wrangler instance and migrated local D1.
- After the final gallery wording correction, its 13 existing component tests also pass.
- `git diff --check`: passes.

## What the browser checks establish

The private Usage UI works at 1280px and 320px with no whole-page horizontal overflow or axe WCAG A/AA findings. Scrollable tables accept keyboard focus. The fresh Usage page does not mount gallery review or request its APIs. A failed report request shows unavailable, not zero.

The public browser defaults to no optional analytics request, including no config request before opt-in. Opt-out clears matching metadata. Actual import review, artwork application, and print actions produce only the approved fixed event fields. Copying a request, accepting its matching local artwork, and requesting a print produces the three coarse progress milestones without sending local identifiers. Merely reviewing a returned pack does not complete the import milestone. Clipboard and physical print dialogs are stubbed; these checks do not prove physical output.

Local D1 migration/ingestion accepts valid v2 events, rejects extra fields, preserves the legacy no-write endpoint, and denies public-host report reads. The admin UI tests use synthetic authenticated-host responses. Worker unit tests verify that human authentication precedes report dispatch and that public/unknown/misconfigured hosts cannot read reports. No deployed Access or Cloudflare account settings were tested.

The existing consent/offline-print checks were updated for the v2 contract and explicit default-off choice. They confirm that rate-limited telemetry does not prevent printing, opt-out stops sends, and a loaded print workflow remains usable offline.

## Edge cases and review

Regression tests cover stale consent generations, off/on during a pending receipt, changes after an attempt has already been read, concurrent starts, missing browser locks, lost receipts, 30-day local expiry, partial imports followed by changed requests, changed artwork at printing, strict payload fields, shared admission limits, failed recording after final admission, day rollover, reduced/zero allowance, retained reports with ingestion off, inactive catalog entries with published artwork, and expiry before delayed cleanup.

The technical, privacy, and data-usefulness critics confirmed closure of their material implementation findings. Their source reviews complement the tests; they do not prove production behavior.

An exploratory run of the broader beta browser file exposed a pre-existing gallery-pagination test that mocks an older listing interface and expects a retired button. That unrelated case remains unchanged and is outside the focused usage suite. The default broader accessibility suite has not been certified by this work. The existing full gallery publication browser workflow was not rerun; only its default-consent assertion was updated to require no writes.

## Deployment boundary

All analytics flags remain false in production configuration and release generation. There is no traffic beacon, remote migration, publication, deployment, push, or activation in this work. Migration 0009 and production host/account verification belong to a later authorized release. Collection activation remains a separate decision.
