# Adblocker resilience validation

September 17, 2026. Local implementation and verification in the shared checkout. Concurrent gallery-preview and dialog-animation work was preserved. This record does not claim production deployment or physical print acceptance.

## Implemented behavior

- `PublicApp` uses a small optional adapter. Only an opted-in, online document attempts to import `analytics/runtime.ts`; the app renders independently.
- Preferences, storage-failure handling, and local progress cleanup remain available without the runtime. Existing keys, consent tokens, and retention are preserved.
- Actions before readiness are dropped. Failed imports and runtime exceptions cannot escape into application actions. There is no event queue, replay, or alternate collection endpoint.
- Configuration and delivery failures stop collection for the current document. Opt-out invalidates stale initialization and aborts pending requests where possible. Previously accepted server writes cannot be recalled.
- The app recovery handler gives the optional import catch a chance to identify its own failure before triggering essential-module recovery. A separate concurrent essential failure still triggers recovery.
- The earlier `events.ts` to `payloads.ts` rename remains. Resilience is tested by blocking the whole analytics module directory and the emitted optional chunk, not just the original filename.

## Passed checks

| Check | Result |
| --- | --- |
| Focused analytics, adapter, local cleanup, privacy component, and app tests | 7 files, 99 tests passed. |
| Existing app recovery plus optional-module recovery tests | 2 files, 47 tests passed. |
| `npm run test:usage-resilience -- --max-failures=1` | 14 browser tests passed, split across Vite development and production-build preview. |
| `npm exec -- playwright test --config playwright.usage.config.ts --output test-results/usage-final` | 12 existing usage and beta regression checks passed against an isolated local Worker/D1 harness. |
| `npm run build` | TypeScript and production build passed. Existing large-chunk advisory remains. |
| `npm run lint` and `git diff --check` | Passed. |

The blocked-module workflow tests cover landing and gallery rendering, saving a community design, copying instructions, local ZIP import, ZIP export, and print invocation. Additional cases cover blocked dependencies, module evaluation failure, blocked or malformed configuration, blocked POST requests, and no runtime requests before opt-in. Privacy controls are tested with keyboard interaction and axe at 320px, including record deletion and persisted opt-out after reload.

The test build inspects actual module ownership. It requires an analytics dynamic entry and rejects analytics in the initial static dependency graph. Tests read the generated chunk URLs from `output/usage-resilience/usage-boundary.json`; they do not depend on a hard-coded asset hash. Build output is isolated from `dist` and ignored by Git.

The existing rate-limit regression now accepts the first selection event, rejects the print event, and confirms printing/opt-out/offline behavior. This preserves its canonical-quantity assertions while matching the new rule that failure stops later collection attempts. Separate new tests verify shutdown after the first blocked POST.

## Manual evidence and limits

Helium displayed the local gallery with 314 designs and later the print page during the final check. Automation of a fresh reload was interrupted by user activity, so this is observation of the active session rather than a completed fresh-load acceptance run. Browser settings and uBlock rules were not modified. Deterministic script-blocking evidence comes from the automated development and built-mode suites.

Browser printing was intercepted to verify invocation and prepared labels. Physical printer alignment, live production behavior, and every third-party blocking rule remain outside these checks. No analytics activation, migrations, or deployment were performed.
