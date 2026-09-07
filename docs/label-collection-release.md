# Saved label workspace migration

Implementation source starts at production `2e7bec8f7af842a33300d65165b172d51fdaa9c4`. Work lives in the isolated `codex/label-collection` branch; unrelated primary-checkout changes were not included.

## Implemented scope

One browser-saved label collection joins community choices, explicitly requested creations and returned packs. Preparation and printing are the two working pages. The existing gallery is an alternative entrance into that same collection.

The collection domain owns validated artwork bytes, bounded metadata, original import receipts, one exact handoff and quantities. IndexedDB commits compare revisions inside the write transaction. Same-tab changes serialize, cross-tab changes refresh, and stale import choices require review. No background restore uploads or provenance downloads run.

Original import receipts retain repairs, bounded contributions and delivery state. Locally verified community artwork hashes also survive removal so unchanged known gallery artwork is not offered as a new creation for sharing. Manifest origin claims never establish that trust.

Prompt 0.0.22 removes replacement-import wording. Existing-only work has no implicit generic prompt; generic conversation-led creation is an explicit entrance. No CellarPack schema or correlation-ID extension was added. All 21 earlier protocol snapshots are unchanged.

## Simplifications and implementation choices

- Removed the independent floating gallery basket, obsolete Configurator and its old string-based picker. The preparation picker commits identities; order review passes those same identities.
- Uses one bounded IndexedDB document with shared encoded buffers instead of separate collection, asset and job services. It does not keep unselected alternative artwork.
- Keeps original receipts for repair and deduplication, not a handoff history dashboard. A deliberate Clear saved labels action provides recovery when old metadata is no longer needed.
- Existing gallery session selections are restored through an explicit action. The original selection remains until all artwork saves; an interrupted restore can retry without adding duplicate copies.
- A standard CellarPack download preserves ready artwork. It is not a backup of quantities or pending requests. No second backup format was introduced.
- Import diagnostics send after accepted additions, or after a readable rejected import is recorded. Cancelling an uncommitted review sends nothing. Restored uncertain receipts offer explicit retry with their original submission ID.

## Verification record

Final local gates passed on 2026-09-06:

| Gate | Result |
| --- | --- |
| `npm test` | 316 tests across 49 files passed. |
| `npm run lint` | Passed without warnings. |
| `npm run build` | Typecheck and production build passed. Vite still reports large chunks and the validator's static/dynamic import overlap. |
| `npm run test:a11y -- --workers=3` | 45 tests passed on a fresh local Worker server. |
| `npm run test:gallery` | 4 real local Worker, D1/R2 and browser workflow tests passed. |
| `PROTOCOL_BASE_SHA=2e7bec8f7af842a33300d65165b172d51fdaa9c4 npm run protocol:history` | All 21 earlier releases unchanged. |
| `git diff --check` | Passed. |

The browser gate exercises existing-only and mixed collections, scoped frozen prompts, new-tab returns, retained quantities, original export bytes, duplicate imports and absence of diagnostic/provenance replay. Unit checks also cover quota rollback, stale review acknowledgement, source-key-order-only reimports, same-manifest archive repairs, known community hash retention, and original diagnostic delivery state. Desktop and 320px preparation/import/print screenshots were inspected. Capacity ceilings are enforced and tested; peak memory on mobile hardware has not been profiled.

No fresh AI generation or physical printer calibration has been performed for this migration. Browser fixtures establish website behavior, not model compliance or artwork quality. Existing immutable historical AI-trial evidence remains separate.

## Release and recovery

Production promotion uses the existing main-branch check/deploy workflow. The corresponding commit and deployment run provide the immutable release identity; hosted verification is reported separately after that run completes.

If a defect is found after users save new-format work, deploy a forward fix that still reads collection version 1. Reverting to the old in-memory replacement importer would hide saved work and is not a safe data-recovery strategy. Retain downloaded CellarPacks and never clear user browser data automatically.
