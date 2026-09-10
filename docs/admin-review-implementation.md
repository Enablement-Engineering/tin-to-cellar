# Simplified label review

Implemented locally on September 9, 2026. This supersedes the compatibility recommendations in the earlier UX assessment. There are no runtime adapters for early gallery metadata. Existing saved records use a one-time migration to the new representation.

## Review workflow

- Select up to 24 loaded pending labels and inspect them together. Bulk approval binds each decision to the fetched version and digest. Rejection applies the displayed reason to each item.
- Full artwork must load and decode before approval is enabled. Labels needing mapping, correction, or reload remain blocked. Source links and advisory notes are available in each batch card; current warnings remain visible.
- A batch reports results per item. Successful items are not retried. An uncertain write is followed by a status read before another decision is offered.
- Single review has persistent decision controls, an Approve and next action, previous/next navigation, and Back to queue with focus restoration. Small-height viewports have a direct decision link so controls remain reachable without traversing the form.
- Metadata corrections and review evidence are collapsed by default. The routine editor contains tobacco match, optional edition, and optional artwork alternative text. Source editing remains available.
- Unsaved corrections stay with the label when navigating and exclude that label from batch selection. Invalid corrections remain editable after a rejected save. Version conflicts require reload.
- Completed items leave the active pending results and counts refresh. Pagination uses applied filters, even if the filter controls have since been edited.

## Data model

Gallery submissions use `version: 2`, one tobacco reference, `artworkProfileId`, and `writingArea`. Edition and alternative text are optional. Image measurements and consent remain in the submission envelope; lifecycle state, audit records, approval digests, and stored assets remain internal. Source links, package, and variant are optional evidence.

Public browse responses contain one flat presentation record. Gallery packs contain top-level edition and alternative text and do not fabricate a research report. CellarPack research is optional; supplied research remains validated. The prompt and schema agree on this format through immutable protocol release 0.0.29.

The artwork profile describes the circle, bleed, and safe inset. It does not describe printer sheets. The application adds no date text, lines, or overlays to the blank writing area.

## Verification

- Full Vitest suite: 565 tests passed in 77 files.
- After final UI refinements: 59 gallery component tests passed in 9 files.
- TypeScript and production build passed. The build retains its bundle-size warning.
- Lint and whitespace checks passed.
- Browser checks used the real application components with synthetic local API responses. Desktop and 320px layouts, artwork visibility, approval progression, counts, mobile return focus, and keyboard bulk publication were inspected. Axe reported no WCAG 2 A/AA or 2.1 AA violations in individual and batch review. This is local UI proof, not authenticated production proof.
- Real Wrangler 4.129.0 local D1/R2 rehearsal covered preparation, application, stale-plan rejection, rollback after a late failure, successful integrity checks, edition/artwork preservation, retained-pack quota accounting, and idempotent replay. No remote calls occurred.

## Release state

No production migration, publication decision, deployment, or commit was performed. The production application and saved records must move together during the maintenance procedure in [Gallery label metadata migration](gallery-label-metadata-migration.md). Integrate the changes onto current `origin/main` before releasing, then verify the admin workflow, public downloads, health, and protected budget endpoint.

Existing unrelated edits in this checkout were preserved.
