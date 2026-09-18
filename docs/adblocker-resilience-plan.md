# Optional analytics must not block the app

Status: implemented locally following user approval. See [validation evidence](adblocker-resilience-validation.md). Not deployed.

## Outcome

The public app must load and support gallery browsing, label selection, local ZIP import/export, instruction copying, and print preparation when optional analytics modules or requests are blocked. Privacy controls must remain usable and opt-out must still clear local measurement records. A blocked analytics runtime must become inactive without retries, deferred event delivery, or an application recovery prompt.

This covers optional usage collection. It does not promise that the app will work when a blocker rejects essential application code, gallery data, or artwork.

## Current evidence

- Helium's uBlock Origin logger matched `/analytics/event$from=~app.diagrams.net` against the Vite module URL `/src/lib/analytics/events.ts`. The failed static import left the page blank.
- Renaming that module to `payloads.ts` restored the local page. Keep this existing change, but do not use filename changes as the resilience mechanism.
- `PublicApp.tsx` statically imports both `analytics/client.ts` and `analytics/progress.ts`. Both lead to shared analytics contracts.
- `DemandPreference.tsx` and `UsageInvitation.tsx` import preference functions through the network client. `DemandPreference` also imports progress cleanup directly.
- `client.ts` already catches request failures, uses 2.5-second request timeouts, checks consent before sending, and does not retry an individual event. However, later actions can still attempt new requests after a transport failure.
- Existing unit tests cover consent, payload bounds, lost receipts, and local progress matching. The usage browser suite serves built assets; it cannot reproduce the Vite source-module failure by itself.

## Implementation decisions

### 1. Separate local privacy controls from collection

Move the existing preference implementation from `src/lib/analytics/preferences.ts` to `src/lib/usage-preferences.ts`. Preserve all storage keys, consent tokens, storage-failure behavior, cross-tab notifications, and the existing lock used for progress cleanup.

Both privacy components should import their read/write/subscribe functions directly from this module. Preference changes must not depend on loading analytics. Keep opt-out deletion and the check for stale in-flight writers here. Keep startup cleanup of expired or invalid local measurement records available without the collection runtime, extracting only the necessary cleanup logic from `progress.ts` into a local helper beside preferences.

These core modules contain local preference and cleanup behavior only. Network collection stays under `analytics/`; do not disguise or proxy blocked requests.

### 2. Add one optional loading boundary

Add `src/lib/optional-usage.ts`, a small adapter used by `PublicApp.tsx`, and `src/lib/analytics/runtime.ts`, the dynamically imported entry point for collection and progress matching.

- The adapter has no static runtime imports from `analytics/`. Type-only imports are acceptable and must disappear from emitted JavaScript.
- Start loading after app startup when the saved choice allows collection and the browser is online, or after a later opt-in. React rendering never waits for this work.
- Use one shared loading promise per document. React effect remounts and repeated consent notifications cannot create duplicate initialization or subscriptions.
- States are idle, loading, ready, and unavailable. Failed imports, module evaluation, or initialization enter unavailable for the remainder of that document. A normal reload may attempt initialization again.
- Calls made while idle, loading, opted out, or unavailable do nothing. Do not retain their arguments, store event queues, or replay actions after initialization.
- Calls made when ready catch synchronous errors and rejected promises. Core save, import, clipboard, download, and print paths never await analytics. Keep the print action in its original user gesture.
- Check the current consent token after every asynchronous initialization step. An opt-out, or an off/on change while loading, must not activate stale work. Do not replace the saved user choice merely because collection is unavailable.
- A blocked import must not trigger the app's essential-module recovery/reload flow. Handle it at this boundary.

The production build must retain a separate optional runtime chunk. Check its actual output graph rather than assuming `import()` alone guarantees isolation.

### 3. Stop collection after delivery becomes unavailable

Keep existing request timeouts, bounded payloads, canonical catalog resolution, deduplication, and explicit receipt requirements in `client.ts` and `progress.ts`.

- Failed or malformed configuration leaves collection inactive.
- A rejected request, timeout, non-success HTTP response, or missing recording receipt stops further collection attempts for that document. Apply this across usage, demand, and progress so one blocked endpoint does not cause repeated attempts from other actions.
- Disabled capabilities are an ordinary inactive state. Do not poll or retry them.
- Opt-out immediately prevents new sends and invalidates pending initialization. Abort pending collection requests where possible. A request already accepted by the server cannot be recalled.
- Preserve the current rule that later progress milestones require successful earlier receipts. Never turn blocked or uncertain delivery into successful measurement.
- Do not detect which extension is installed, upload blocker errors, introduce an alternate endpoint, or ask the user to disable their blocker.

## File map

| Files | Planned change |
| --- | --- |
| `src/lib/optional-usage.ts` and its tests, new | Optional loader, consent lifecycle, safe observation calls, and permanent failure handling for the current document. |
| `src/lib/usage-preferences.ts`, local cleanup helper and tests | Move local choice handling outside collection; preserve keys and make cleanup available when analytics cannot load. |
| `src/lib/analytics/runtime.ts`, new | Dynamic entry point combining client and progress APIs. |
| `src/lib/analytics/client.ts`, `progress.ts`, and their tests | Remove UI-facing preference orchestration, add delivery shutdown and cancellation, preserve progress and payload rules. |
| `src/PublicApp.tsx` | Replace static analytics imports with adapter calls and one managed startup subscription. |
| `src/components/DemandPreference.tsx`, `UsageInvitation.tsx`, and tests | Read and write local preferences independently of collection. |
| `src/App.test.tsx` | Spy on the adapter where testing application actions; retain separate tests for real collection behavior. |
| `tests/usage/` and Playwright configuration | Add blocked-module and blocked-request acceptance coverage in development and built modes. |
| `vite.config.ts` or the test build harness, if needed | Expose build manifest/module ownership for tests to locate and verify the optional chunk. |
| Analytics implementation/validation docs and `worker/analytics/README.md` | Document dropped observations, shutdown behavior, and the tested boundaries; update stale `events.ts` references. |

No new Worker endpoints, database migrations, admin reports, or collection fields are needed. Consent wording already allows collection only when available; review it for accuracy without expanding the invitation. Existing local retention, aggregate retention, and production enablement flags remain the contract.

## Validation

### Unit and component checks

- Import rejection, evaluation failure, delayed loading, synchronous runtime exceptions, and rejected runtime calls never escape into application actions.
- Multiple initializations share one attempt; failure stays inactive across route changes and preference toggles until reload.
- Actions during loading are dropped, including their arguments; they are not delivered when loading finishes.
- No opt-in means no runtime load or collection requests. Storage failures keep collection off.
- Opt-out during load, configuration, or delivery prevents stale activation and new sends. Cover off/on races and another tab changing consent.
- Opt-out clears local progress even if the runtime never loads; expired-record cleanup still runs. Existing progress deduplication and lost-receipt tests continue to pass.
- A transport failure suppresses subsequent calls across all collection types. A successful configuration and successful delivery still produce the expected bounded counts.

### Browser acceptance

Use isolated servers and local test data. Keep the user's server on port 43928 available.

1. **Development modules:** run the Vite stack, opt in using a fixture, and block `/src/lib/analytics/**` before navigation. Verify the landing page and gallery render, a design can be saved, a valid local pack can be imported/exported, instructions can be copied, and print preparation reaches the print invocation. Repeat a focused case blocking only a dependency such as `payloads.ts`.
2. **Built modules:** use the existing local Worker harness with built assets. Resolve the optional runtime and its exclusive dependencies from build output metadata; block those resources before navigation. Prove that no blocked module is also a static dependency of the public entry or privacy controls. Repeat the essential workflow above.
3. **Configuration and transport:** separately block configuration, return malformed configuration, and allow configuration before blocking POSTs. Exercise later actions and route changes to prove request counts stop increasing. Test timeouts with controlled responses, not long arbitrary sleeps.
4. **Privacy:** with modules blocked, navigate to Privacy, change the choice using the keyboard, verify local-record deletion, and reload. Check the invitation and controls at narrow width and run their existing accessibility assertions.
5. **Control:** with analytics enabled in the isolated harness and no blocking, retain the existing happy-path event, consent, and progress tests.

Capture unhandled errors and promise rejections. A browser network diagnostic for an intentionally blocked script is expected; a blank page, application error, reload loop, or unusable workflow is a failure. Browser checks prove the print invocation and prepared output, not physical printing.

Run relevant unit/component tests, the usage and new development browser suites, `npm run build`, and `npm run lint`. Finally verify the local gallery in Helium with uBlock still enabled.

## Delivery order and completion

1. Extract and test independent local preferences and cleanup.
2. Implement the adapter/runtime boundary and migrate the public app and privacy controls.
3. Add collection shutdown and consent-race handling; run the existing analytics regressions.
4. Add deterministic development and production-build browser tests and inspect the bundle boundary.
5. Record verification evidence and prepare a focused commit.

The checkout currently contains concurrent gallery image work and this task's earlier spacing/module-rename changes. Preserve those edits and stage only the intended files or hunks. Coordinate edits to `PublicApp.tsx`, configuration, and package scripts if another task owns them.

Complete when blocked optional modules and requests leave the tested core workflows usable, privacy choices still work, and the unblocked analytics tests pass. Implementation is local first. Any later release uses current `origin/main` and the normal health/protected-budget verification; analytics activation remains a separate decision.
