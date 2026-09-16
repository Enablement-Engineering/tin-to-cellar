# App update recovery

## Problem and intended behavior

An open tab retains the asset URLs of its original build. A later deployment can make a deferred module unavailable. Today several unrelated failure paths offer a full reload, without distinguishing an update from a network failure or protecting unfinished work.

Keep previous hashed assets available so open tabs usually continue without interruption. If a module fails, check a fresh build marker. Refresh automatically only for a confirmed different build when all registered work guards permit it. Preserve the URL and restore main-content focus. Stop after one automatic refresh per recovery window. Network failures and application exceptions must not trigger automatic reloads.

## Implementation

1. Emit a build identifier in the client and `app-version.json`, independent of the immutable AI protocol revision. Serve the marker with `no-store` through the existing Worker host/auth boundaries.
2. Retain three prior production asset generations alongside the current build. Archive fresh hashed assets before retention merging. Validate downloaded artifacts, paths, hashes, size bounds and collisions. Never retain HTML, Worker code, configuration or mutable public files.
3. Coordinate actual module download failures through one recovery controller. Do not suppress normal import errors or treat every React rendering exception as an update. Coalesce probes, use a bounded timeout, and fail closed if the marker or session storage is unavailable.
4. Block refresh while saving, importing, downloading, printing, reviewing unsaved content, editing drafts, or submitting reports. Hidden retained components count. The admin app has no automatic recovery permission. Show the reason and let the user finish or cancel the work.
5. If the ZIP reader itself cannot load, retain that selected file locally in a separate, tab-addressed IndexedDB checkpoint before allowing recovery. After refresh offer an explicit resume action. Do not automatically repeat imports, report submissions, gallery writes or clipboard operations. Expire and remove temporary checkpoints.
6. Keep frozen AI handoffs and integrity verification unchanged. A website update is not an instruction revision upgrade.

## Critic review

Independent runtime and deployment critics reviewed the initial plan. Incorporated objections include background contribution writes, standalone report drafts on the help page, React.lazy caching rejected imports, Vite error suppression, admin separation, recursive asset retention, and deployments whose smoke check fails after deployment succeeds.

The implementation review also caught failed-storage dismissal traps, missing controls for closing reports and discarding unshared notes, generic-chat state loss, late draft changes during a version check, and retention of earlier attempts when rerunning the same deployment. These were addressed before final verification. Generic-chat mode is tab-local; frozen prompt contents still come from the existing saved collection. Pending drafts remain in memory and block recovery until saved or explicitly closed.

## Acceptance gates

- Unit tests for build-marker validation, unknown/network/same-build cases, blocked recovery, one-refresh limit, unavailable session storage, and local ZIP checkpoint lifecycle.
- Production-build browser tests that keep build A open while build B becomes current, exercise retained and missing deferred assets, verify restored navigation/focus, and stop repeated failures.
- Regression checks for saved labels and frozen handoffs; typecheck/build and lint.
- Deployment is a separate operation through current main. Local checks do not prove a production rollout, assistive-technology behavior, or physical printing.

## Verification on September 16, 2026

- `NODE_OPTIONS=--no-experimental-webstorage npm test -- src worker scripts`: 758 tests across 90 source suites passed. The local Node runtime otherwise shadows jsdom storage; source paths also exclude an old copied test under ignored `output/`.
- `npm run test:recovery`: nine Chrome production-build scenarios passed, including A-to-B updates, retained assets, same-build/network failures, repeated failures, printing, late drafts, ZIP byte preservation without replay, and storage-quota dismissal. CI runs this suite using installed Chromium.
- `npm run test:a11y -- tests/accessibility/instructions-recovery.pw.ts`: deliberate reload preserved a saved blend and main-content focus. The development test now intercepts Vite source modules; production tests intercept built assets.
- `npm run build`, `npm run lint`, and `git diff --check` passed. Build reports the existing large-bundle advisory.
- No production deployment or GitHub artifact round trip was performed. Retention begins with the first deployment of this workflow; it cannot reconstruct asset generations that were never archived.
