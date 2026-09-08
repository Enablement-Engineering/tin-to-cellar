# Code quality, security and UX review, round two

Reviewed committed main `0d3e8dd` on September 7, 2026. The findings below describe the pre-fix baseline. The approved implementation and validation are recorded at the end. Unfinished community research was excluded.

The core separation remains sound: local deterministic validation and printing, external AI generation, and explicit public submission. The main opportunities are reliable state updates and making the next action visible.

## Confirmed functional and security findings

| Severity | Finding and evidence | Proposed change |
| --- | --- | --- |
| Medium | Print controls can lose pending edits. Two rapid increments produce two absolute updates to 2; immediate printing still renders 1 copy. Changing start slot then alignment can reset the pending slot change. Reproduced with delayed persistence. `src/components/PrintStudio.tsx:19`, `:60`; `src/PublicApp.tsx:208`. | Pass quantity deltas and narrow settings patches into the current-state transaction. Reflect edits promptly and ensure the printed DOM contains the latest requested job before enabling Print. |
| Medium | Community additions can fail because an unrelated save changes the collection revision during download. A deferred download plus a first-slot update reproduces an import conflict. `src/hooks/usePackImport.ts:49`. | Construct automatic import plans inside the current-state commit. Revalidate the identity of an explicitly selected replacement row; retain review invalidation for manual ZIP replacement decisions. |
| Medium | Some unauthenticated gallery requests perform work before request admission. Unsupported non-GET methods still read flags from D1. A submission with a failed challenge performs database and challenge work without calling a limiter. Six disposable tests reproduced this with all limiters denying. `worker/gallery/routes.ts:95`, `:109`; `worker/gallery/admission.ts:4`. | Reject unsupported route/method combinations before storage, and admit public mutation requests before body parsing, D1 or challenge verification. Keep request limits distinct from successful reservation quotas and upload-attempt limits. This is availability/cost exposure, not an authorization or data disclosure bypass. |
| Low | Imported display names become the canonical blend name in `src/hooks/usePrintLabels.ts:21`. The bundled Westminster pack therefore displays its maker twice, including in preview accessibility names. | Keep maker, canonical blend, and optional display name separate; compose the presentation label once. Do not rewrite imported provenance. |
| Low | The bundled Escudo pack uses a known alias, “Escudo Navy De Luxe,” but the catalog row is “Escudo Navy Deluxe.” Import leaves the existing request unmatched. `src/lib/tobacco-catalog/index.ts:65` does not include catalog aliases in exact identity lookup. | Offer a clear match suggestion for a unique reviewed alias. Preserve explicit confirmation for ambiguous identity or artwork replacements. |
| Low | `downloadPublishedLabel` has no callers and `buildSelectedPack` is referenced only by its own tests. `src/components/gallery/pack-builder.ts:38`. | Remove these obsolete construction paths and builder-only tests while retaining current download validation and collection export. |
| Low | `tests/accessibility/feedback.pw.ts:82` still expects notes submitted without an ownership capability to return 200. The secured route correctly returns 403. | Update the successful request to use its report capability and retain explicit missing/wrong-capability denial checks. Do not relax production authorization to satisfy the old test. |

## UX findings and proposed patterns

### 1. Keep the print action visible

On the live desktop print page with 17 saved labels, the first screen prioritizes Add more labels, Download labels, a large ZIP drop zone and the sheet preview. The actual Print button is below the entire quantity list. A fresh local ten-label import has the same ordering. At 390px wide, the import panel consumes almost the whole first screen; the preview and Print action are farther down.

Use a persistent job summary with **10 labels · 2 sheets · Print 10 labels**. On desktop, put it beside the preview; on mobile, use a bottom action bar with space reserved so it cannot cover controls, validation messages or keyboard focus. Hide it in printed output. It must reflect pending quantity changes correctly, not just move the existing race into a more prominent button.

Collapse Add artwork into a secondary **Add labels** action when printable labels exist. Retain the expanded drop zone for an empty collection, an active import, or an import that needs repair.

### 2. Make adding a design lead naturally to printing

The gallery's return action says **View your labels**, although it opens the print page. Its selected-design summary is above a long, automatically growing results grid, so it scrolls out of reach. Cards become disabled **Added to your labels** buttons without a nearby next action.

Use a persistent **Your labels (N)** summary and **Review & print** action across choosing and browsing. After an add, show a small confirmation with a **Review & print** link and, where reversible, **Undo**. Keep the browsing position so people can continue collecting designs. Opening the operating-system print dialog should remain an explicit action after quantities and sheet settings are visible.

### 3. Distinguish catalog selection from adding a custom name

Observed locally: typing Nightcap and pressing Enter creates a custom-name row, then displays separate Dunhill and Peterson match buttons. Clicking a catalog suggestion directly avoids this extra step. The adjacent Add blend button follows the custom-name path too.

Make the selected suggestion explicit. Enter should choose a highlighted suggestion; ambiguous matches should present a choice rather than silently becoming a custom name. Label the custom path **Use this name without a catalog match**. Apply the same review pattern to pasted orders so users understand whether they added a blend identity or printable artwork.

### 4. Show only import decisions that need attention

The bundled ten-label pack presents ten repeated “How to add this design” controls and puts Add 10 labels at the bottom. It simultaneously shows the import area and another example-pack entry point. This is safe, but visually expensive for an uncomplicated batch.

Start with a compact summary: **10 new designs; 1 possible match to review**, with a visible confirmation action. Expand duplicates, ambiguous matches and replacements. Never auto-replace saved artwork merely to remove a step. Use **Add and review print sheet** when the action both saves and advances, so the destination is clear.

### 5. Match the empty state to the actual situation

A row with no available designs currently says “No community designs for this blend yet,” followed by “Prefer a different design?” The latter assumes a design exists. The print page can say “You can print the ready labels now” when the collection only contains requests without artwork.

Use **No design yet → Create this label** for an unavailable design, and offer **Browse designs** or **Import finished ZIP** when nothing is printable. Once artwork exists, Change design is the appropriate secondary action. Distinguish ready designs, copies selected for this job, and requests still waiting for artwork.

## Verification and limits

- Browser walkthrough: live landing, existing 17-label collection, gallery return action and print page; disposable local empty state, catalog suggestions, Enter-to-add, custom-name matching, no-design state, AI handoff, bundled ZIP review, adding ten labels, and mobile print-page ordering. Existing production collection content was not modified.
- Existing app/accessibility browser suite: **55 passed, 1 failed**. The failure is the stale ownership expectation described above. Passing coverage includes responsive accessibility, import, persistence and print/PDF behavior.
- Security agent: **65 existing security/artifact/privacy tests passed**, plus **6 tests reproducing the admission gap**.
- Quality agent: **3 tests reproducing quantity/settings and asynchronous import races**.
- Production dependency audit: **0 reported vulnerabilities** from `npm audit --omit=dev --json`. This is an advisory check, not proof of absence of vulnerabilities.
- Disposable reproduction sources are retained in ignored `output/review-round2/`. They assert current faulty behavior and should be converted to regression tests when fixing it.
- No production abuse/load testing, synthetic public submissions, physical printer output, or independent Cloudflare Access configuration audit was performed.

## Suggested implementation order

1. Fix gallery mutation admission and update its tests. Correct the stale ownership browser test.
2. Fix collection transaction commands and automatic-import planning. Establish that rapid edits and immediate printing produce the requested job.
3. Add the persistent job summary and Review & print actions; demote the import panel when labels are ready.
4. Simplify import review and catalog/custom-name selection, then correct display-name composition and empty-state wording.
5. Remove unused pack-building exports. Re-run relevant unit, browser, accessibility and print-layout checks before release.

No broad importer rewrite or new application architecture is warranted by this round.

## Approved implementation

Implemented small changes on shared main without changing the application architecture:

- Collection transactions now accept quantity deltas and narrow settings patches. Print remains disabled until the entire save queue settles; browser printing during a save presents an actionable notice instead of stale labels.
- Automatic community imports plan against current collection state. Explicit artwork replacements still reject a changed or removed target.
- Gallery mutations pass a dedicated request limiter before parsing, storage, or challenge work. Unsupported requests are rejected before storage.
- Print and Review & print actions remain visible; ZIP intake collapses when labels are ready. Mobile actions sit above the footer with reserved scroll space.
- Routine new designs use a compact import summary; conflicting decisions remain visible. Catalog suggestions distinguish a selected identity from an explicit custom name.
- Canonical blend names stay separate from display names; unique maker-scoped aliases resolve consistently. Removed unused pack-building exports.

Regression tests cover queued saves, deferred imports, print gating and geometry, catalog ambiguity, aliases, request admission, capability ownership, and mobile action reachability. Existing research files are excluded from this change.

Validation: 505 tests across 72 files passed; lint and typecheck/build passed. All 56 accessibility/workflow browser tests and all five local gallery end-to-end tests passed. Manual browser inspection covered the populated desktop print page and 320px mobile layout. Physical printer output remains untested.

## Selection and history follow-up

Existing selections can now be replaced from an imported pack review after an explicit confirmation. Replacement is one atomic save after local validation; it resets quantities and print settings, preserves report ownership/history, and retains existing work on failure. This also supports packs that fit on their own but exceed storage limits when combined with existing artwork.

Print Labels now includes Reset labels, with confirmation and the same full local reset available from Choose labels. Import history is a separate disclosure: entries identify their saved blend names and sequence, and explain that viewing a report does not alter the sheet. Pending import review cannot be discarded by switching history entries. Validation reports with no issues still show an explicit ready count when opened.

Pending imports now use a separate review screen. The saved sheet preview, quantity controls, and print actions are unmounted until the user adds, replaces, or cancels the import. This prevents pending template artwork from appearing alongside an unrelated saved print job. Cancel restores the saved sheet; accepted changes produce the new sheet. Browser coverage checks both outcomes with the real home-page example pack and verifies that no old production pages exist during review.

When the collection is empty, trying the bundled example pack now saves its locally validated, ready artwork directly and opens the print preview with Reset labels available. Existing selections still require review. A concurrent selection change or storage failure preserves the pack review and existing work. Browser regression coverage exercises home and print-page template entry points, reset, and reload.

Choose labels now keeps a persistent selection summary even before any artwork is ready. It distinguishes selected blends, printable designs, and missing artwork, provides View selected with keyboard focus transfer, and offers Review & print when ready. Successful search additions show a six-second live confirmation with the current total while retaining search focus. Mobile layout reserves space after the footer for both actions.

Visual review at desktop, 390px and 320px found the total too understated and mobile actions leaving unused width. The total now has stronger emphasis and the two mobile actions share the available width. Verified the transient confirmation beneath the focused search field and the selected-list shortcut beneath the sticky bar before release.

Import decisions now open in a native modal dialog with focus containment, Escape cancellation, and a scrollable body between a fixed heading and action footer. Validation and save errors remain accessible inside the modal. Actual matches stay visible; new and identical designs can be expanded separately. Identical designs are counted as already saved rather than conflicts. Desktop decisions use artwork-and-control rows, stacking on mobile. Visual review verified complete artwork and persistent actions; the old grid rule that overrode hidden cards was corrected.
