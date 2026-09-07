# Code quality cleanup

This cleanup starts from production main `d019bef`. It preserves the saved collection, gallery, privacy restrictions, diagnostic budget, and immutable protocol history added since the older local checkout was audited.

## Ownership and boundaries

- `PublicApp.tsx` composes pages and collection actions. `usePublicNavigation` owns routes, history and navigation focus. `usePackImport` owns serialized import work and pending review choices.
- `lib/import-workflow/prepare.ts` adapts the validated pack to Avery printing and prepares optional diagnostics. The importer's aggregate issue list already contains quarantined failures. Append new printer compatibility failures once; do not append quarantine issues again.
- `lib/cellarpack/importer.ts` sequences validation. `schema.ts` owns AJV compilation, `archive-contents.ts` owns bounded extraction, `artwork.ts` owns artwork checks, and `sheet-profiles.ts` owns optional profile parsing. The public import result contract is unchanged.
- `lib/feedback/validation.ts` supplies the same validator to the browser and Worker. `scripts/feedback-validators.mjs` compiles strict AJV standalone functions without runtime code generation. Generated JavaScript is ignored; its declaration file and generator are tracked.
- `worker/http.ts` owns bounded JSON reading and distinguishes invalid input, timeout and size failures. Legacy diagnostic migration is separate from collection and export requests. Its authenticated maintenance action and scheduled fallback retain original records and expiry. See [diagnostics operations](diagnostics/operations.md).
- `lib/sheets/fixed-layout.ts` derives pagination and coordinates from the selected profile. Generalized profiles remain supported by the pack format; the website still prints Avery 94502. See [printing architecture](printing-architecture.md).

## Runtime data and removed code

The complete immutable protocol registry remains verification evidence. `protocol:release` verifies the archive, canonical sources and tracked metadata, then generates the ignored `src/lib/protocol/instructions.json` build input. It contains only the archive's exact instruction bodies for the deferred prompt module, without duplicate HTML, separate schema copies or hashes. Historical repair requests retain their original instructions. The generated representation is not committed.

The deferred prompt chunk decreased from 2,334.82 kB to approximately 865.54 kB, and from 589.20 kB to approximately 216.91 kB gzip. This is a comparison with current main before this cleanup, not with the older checkout used for the initial audit. Large-chunk warnings remain enabled.

Removed code includes the unused `SiteHome` component and unreachable home state, unused ChatGPT URL wrappers/constants, and report-summary helpers with no application or operational callers. `/` still redirects to `/labels`. Session selection restoration and historical protocol/feedback compatibility remain because they have active migration uses.

Application and Worker TypeScript configurations now enable strict mode without suppressions.

## Checks

`npm test`, `npm run test:watch`, `npm run build`, `npm run dev:frontend`, and `npm run diagnostics:smoke` explicitly generate feedback validators. The test, watch, build and frontend development scripts also run `protocol:release` to prepare runtime instructions. Explicit chaining also works when npm lifecycle hooks are disabled. Before running TypeScript or a test runner directly in a fresh checkout, run `npm run feedback:validators` and `npm run protocol:release`.

The regression coverage checks once-only quarantine diagnostics, retained labels after a rejected replacement, schema parity, request deadlines, maintenance authentication, profile-derived layout, and saved-collection behavior. Browser coverage includes PDF page size, circle clipping, gutters, pagination and calibration offsets. Physical printer alignment remains a separate manual check.

Release through the main GitHub workflow after local checks. Verify health capabilities and that unauthenticated access to `/api/labels/diagnostics/budget` returns 403. Do not release the preserved older checkout or its unrelated community-artwork research.

## Local verification, September 7, 2026

- 410 unit and integration tests passed across 61 files; strict TypeScript and lint passed.
- 56 application browser cases passed, including accessibility, import recovery, cross-tab collections, prompt loading, and PDF geometry.
- Five gallery browser flows passed against disposable local Worker, D1 and R2 bindings. Authentication is synthetic only in the test harness.
- The diagnostic budget smoke passed manual pause/resume, report and note persistence, exhausted admission, protected status, and persistence across restart.
- All 23 historical protocol releases remained unchanged.

The initial simultaneous run collided on the debugger port and encountered three unit-test timing failures. The harnesses now request an available debugger port; the sequential full unit rerun and gallery rerun passed. Application browser checks passed on their first run. Browser screenshots and the rendered print PDF were also inspected locally.
