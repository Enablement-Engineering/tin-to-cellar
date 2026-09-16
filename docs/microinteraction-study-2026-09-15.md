# Microinteraction and motion study

Reviewed September 15, 2026. The study below records the original recommendations. The first polish pass has since been implemented locally; see Implementation result.

## Direction

Use motion to confirm an action or explain a small change in context. Keep the artwork, reading pages, and print sheet steady. The warm paper, moss controls, and serif headings already provide character. Motion should make working with them clearer.

Start with CSS and the existing tokens. The best first pass is copy confirmation, persistent selection feedback, consistent disclosures, and restrained dialog entry. Defer page transitions and animated list rearrangement.

## Evidence and limits

Browser review covered the landing page, Your labels, autocomplete and the artwork chooser, Create artwork and its instruction reveal, pasted-list review, example-pack review, the populated Print labels workspace, How it works, About, Inspiration, Privacy, and the populated public gallery. Local interactions used an existing preview and then a fresh Vite preview at port 43931 after the existing build failed to load an import chunk. That failure is not evidence of a production defect.

The public gallery was inspected without adding or submitting artwork. Submission and administrative review recommendations below come from source inspection, not a completed live moderation workflow. This was a design study, not a full keyboard, screen-reader, cross-browser, performance, or physical printing acceptance test.

The checkout already contained unrelated edits. Those were preserved. Recommendations refer to the working source as reviewed and should be reconciled with any concurrent UI changes before implementation.

## What is already present

- React 19.2.8 and React DOM 19.2.8 in the lockfile, TypeScript, Vite 8.2.2, and plain CSS. No animation library or router package is installed.
- `src/styles/tokens/motion.css` defines 80, 140, 220, and 360 ms durations. Controls use a 140 ms color transition; a 220 ms surface transition is available. No CSS keyframes were found in `src`.
- `docs/design-system.md` explicitly favors color-only control feedback, stationary cards, immediate decoded gallery thumbnails, and no shimmer or decorative entrances. Preserve that direction. The task-specific disclosure and dialog transitions proposed here would be narrow additions to the guide.
- Reduced-motion CSS already shortens transitions and animations and disables smooth scrolling. New JavaScript animation or view-transition pseudo-elements would need their own treatment; the current rule is not a universal motion switch.
- The app already has native dialogs, native disclosures, status messages, and deliberate focus restoration. Reuse those behaviors.
- Global `html { scroll-behavior: smooth }` also affects programmatic navigation and workflow scrolling. `usePublicNavigation` restores route positions and gallery scroll; `ArtworkCreationFlow` focuses and scrolls to newly available instructions. Scope smooth scrolling to deliberate in-page navigation so route changes and restored positions settle immediately.

## Page-by-page recommendations

| Page or flow | Recommended interaction | Purpose and limits | Priority |
| --- | --- | --- | --- |
| Landing, `/labels` | Apply the existing 140 ms border/background feedback consistently to the large entry buttons and resume actions. | These are choices. Keep their bounds and the jar photograph still. No hero sequence, scroll reveal, or parallax. | First pass |
| Your labels, `/labels/create` | After a successful save, change the affected row's status and give that row a brief, soft moss background emphasis. Keep the existing textual confirmation. | Identify the label that was added or made ready. Do not animate every saved row on initial load or restoration. Leave search focus where it already returns. | First pass |
| Autocomplete | Open and update immediately. Keep the active option and focus indicator immediate. | Fast typing and arrow-key navigation should not accumulate fades. An opening animation has little value here. | Keep still |
| Artwork chooser | Fade the native dialog and backdrop in, with an optional maximum 4 px vertical offset on the dialog. Use the same behavior for creation-list and import-review dialogs. | Make the change of context legible without scaling the artwork. About 140 ms for the backdrop and 220 ms for the dialog. Close immediately in the initial implementation. | Second pass |
| Add several blends, `/labels/order` | Change drop-target border/fill during drag-over. Show actual reading/recognition state and completion text. Retain the existing focus move to Review your blends. | No moving dashed border, fake progress percentage, or staggered result rows. Fast parsing should remain fast; only show an activity indicator for work that remains pending. | First pass |
| Create artwork, `/labels/artwork` | Add a copy-to-check icon change after clipboard success. Keep the button width stable and the existing next-step text. A short disclosure may open over 220 ms. | Success must follow the clipboard result. Preserve the existing fallback when copying fails. Do not show progress for the external AI chat; the website cannot observe it. | First pass |
| Review-to-instructions step | Settle the collapsed request summary and focus/scroll position first. At most, softly reveal the newly available panel in place. | The current change also moves focus and scroll. Avoid combining a large height animation, a panel slide, and smooth scrolling. This is less valuable than copy feedback. | Later |
| Community gallery, `/gallery` | After download, validation, and save, change the chosen button to a quieter persistent Added state with a check. Use a 140 ms color change. Update the selection summary without moving it. | Confirms which design was saved. Leave thumbnails sharp and immediate. Do not fly a label to the summary or stagger cards. | First pass |
| Gallery search and pagination | Preserve stable result space while loading where practical; keep search focus, `aria-busy`, and loading/retry text. | Source currently clears results when filters change. Address any collapse/flash before adding fades. Never keep stale results actionable as if they match the current query. Appending another page should not reanimate earlier cards. | Stability first |
| ZIP import review | Use the shared dialog entry. Transition selected option background/border in place; keep radio/checkbox state immediate. Give Review new designs and duplicate disclosures the shared behavior. | Keep choices next to the artwork. Do not crossfade current and imported artwork during comparison. Show Added/Applied only after the save succeeds. | Second pass |
| Import history and repair details | Reuse the disclosure indicator and copy-confirmation pattern. Keep long reports immediately readable. | The growing history should not introduce a second motion vocabulary. No accordion-height tween for an entire report. | Second pass |
| Print labels, `/labels/print` | Retain color-only quantity-button feedback. Use stable-width totals with tabular numerals. Update quantities and sheet contents immediately. Animate only short optional controls such as Paper and alignment. | A print preview is a measurement tool. Do not move labels into slots, tween printer offsets, roll numbers, or animate page turns. Never claim printing completed when the browser dialog closes. | First pass |
| How it works, `/labels/help` | Shared feedback-disclosure treatment and link feedback only. | The instructional steps are reading content. Keep them visible from the start. | Low |
| About and Inspiration | Existing link feedback; keep article and video still. | No scroll-triggered paragraphs, decorative motion, or autoplay. | Keep still |
| Privacy | Immediate native checkbox state and clear saved-state text if needed. | No celebratory animation or motion that biases a privacy choice. | Keep still |
| Community submission | Local pending state and persistent per-label receipt status after the server responds. | Submitted for review and published are different outcomes. No celebration, automated progression through consent, or optimistic success. Source review only. | Later |
| Admin review | Shared control/disclosure feedback and clear saved-state text. Keep evidence and review rows stable. | Review accuracy is more valuable than list animation. Do not animate destructive confirmations or make a row disappear before the decision succeeds. Source review only. | Later |

## Motion specification

Reuse the current durations and easing rather than introduce a second scale.

| Behavior | Duration | Treatment |
| --- | --- | --- |
| Pressed state, focus ring, checkbox/radio state, numeric value | Immediate | Never delay the input response. |
| Hover, selected border/fill, copy/check icon | 140 ms | Existing standard easing. No button movement. |
| Short disclosure, dialog entry | 220 ms | Existing ease-out. Opacity or a small local reveal; no spring or overshoot. |
| Temporary changed-row emphasis | 360 ms return to normal | Begin only after a confirmed action. Persistent status text carries the meaning. One change, no pulse loop. |
| Reduced motion | Immediate | Preserve all text, status, focus, and selected state; remove movement and decorative fades. |

Do not stagger repeated content. Do not add minimum loading durations to make animation visible. Scope animation to the action just completed, not to every React render, image decode, tab restoration, or data refresh.

## Stack options

| Option | Fit for this app | Recommendation |
| --- | --- | --- |
| CSS transitions and small keyframes | Existing tokens and plain CSS cover control feedback, confirmations, indicator rotation, and dialog entry. | Use for the first pass. No dependency needed. |
| Native disclosure/dialog CSS | `@starting-style` can describe entry styles. Dialogs have top-layer and backdrop behavior to preserve. Intrinsic-height interpolation still has incomplete browser support. | Progressive enhancement with instant fallback. Keep native semantics. Animate a disclosure indicator even where height animation is unavailable. |
| Web Animations API | Useful for one isolated cancellable effect when CSS cannot express the trigger cleanly. | Optional escape hatch. Avoid building a general animation controller. Check reduced motion and cancel on unmount. |
| Motion for React | Stronger fit if animated layout changes and coordinated enter/exit become a real product need. | Defer. If adopted, scope it to the relevant components and use LazyMotion; layout features require the appropriate feature bundle. Configure reduced motion explicitly. |
| React ViewTransition | Current React documentation exposes this in 19.3; this checkout resolves 19.2.8. It also interacts with update timing and effects. | A separate upgrade and navigation investigation, not a prerequisite for this polish. Avoid a blanket wrapper around the application. |
| GSAP, Lottie, or decorative animation assets | Would add machinery without an identified need in these workflows. | Do not add for this scope. |

Native browser view transitions are another future option, but they do not remove the need to coordinate React commits, focus, reduced motion, and scroll restoration. The gallery is deliberately retained in a hidden wrapper after visiting it. Avoid changes that remount it or replay its loading state merely to animate navigation.

## Implementation boundaries and checks

1. Start in `src/styles/tokens/motion.css`, `src/styles/app.css`, and the smallest affected components. Keep the existing 140/220 ms easing. Update the design guide alongside any newly permitted motion.
2. Put decorative animation inside `@media screen and (prefers-reduced-motion: no-preference)`. Include `::backdrop` explicitly. Do not rely on the existing `*::before`/`*::after` override to cover every new pseudo-element.
3. Use React state to report success, not an animation-end event. Animation must never gate saving, copying, cancellation, navigation, or printing.
4. Keep dialogs mounted only as long as their established focus/inertness contract requires. Start with entry-only animation. An exit transition would require deliberate lifecycle and focus work because the current components close/unmount immediately.
5. Keep native `<details>` semantics. Short content can have a progressive height transition, but unsupported browsers should open instantly. Do not introduce focusable collapsed children through a CSS grid workaround without managing hidden/inert state.
6. Keep motion off `LabelArtwork`, production pages, calibration output, slot dimensions, bleed, clipping, offsets, and the writing area. Screen-only interaction styling must not affect PDF output.
7. Verify rapid repeated actions, failed clipboard/save/import states, cancellation, background restoration, and changing the reduced-motion preference while open. Test keyboard focus on open/close and after rows change.
8. Check both narrow and wide layouts, reduced motion, and browser fallback. Preserve gallery scroll and search focus. Read the final status once through the live region; do not announce every animation frame.
9. Run relevant component and browser checks, lint, and build for implementation. Check print/PDF rendering if any shared print CSS changes. Browser evidence does not establish physical printer alignment.

## Suggested sequence

The first implementation should cover copy feedback, saved/selected states, drop-target feedback, stable counts, and scoped scrolling. Then add a shared disclosure treatment and entry-only dialog transition. Review those together before considering any route or list animation.

## Implementation result

The first pass uses the existing CSS motion tokens and adds no dependency. `src/styles/microinteractions.css` provides copy/check crossfades, stable copy-button dimensions, readable saved-design states, a brief emphasis after local workspace changes, shared disclosure chevrons, progressive short-disclosure height transitions, and entry-only dialog/backdrop fades. Drop feedback preserves the paper texture. Counts use tabular numerals, and route/focus scrolling is immediate. Reduced motion removes every new fade and transition. Artwork and physical sheet geometry remain unchanged.

Confirmed-state feedback follows successful operations. A failed clipboard retry replaces an earlier success with the manual-copy fallback. Opening a replacement review does not mark the row as saved. Page entrances, animated gallery results, and external submission/admin changes remain outside this pass.

Local validation passed:

- Targeted component tests for the workspace, copy handoff, gallery browse, import review, print studio, and app integration, including clipboard-retry and replacement-review regressions.
- Four new Chromium checks at 1280px and 320px, with normal and reduced motion: native dialog focus and Escape, live motion-preference changes, disclosure keyboard navigation, restored-row behavior, stable copy-button width, overflow, and axe checks.
- Seven existing preparation/design browser checks and the print/PDF geometry check.
- `npm run lint`, `npm run build` (including TypeScript), and `git diff --check`. The build retains its existing large-chunk warning.

Manual local browser review confirmed the artwork dialog, Design notes disclosure, and copied state. This does not establish Safari/Firefox, assistive-technology, or physical-printer acceptance. Changes are local and have not been deployed.

## Technical references

- [React ViewTransition](https://react.dev/reference/react/ViewTransition), current 19.3 API, trigger/effect behavior, and explicit reduced-motion responsibility.
- [Motion accessibility](https://motion.dev/docs/react-accessibility), `MotionConfig` and `useReducedMotion`. The user setting disables layout/transform animation, but retains other animated properties unless handled explicitly.
- [Motion LazyMotion](https://motion.dev/docs/react-lazy-motion), optional feature loading.
- [MDN starting-style](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@starting-style), entry styles for newly displayed elements.
- [MDN dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog), native modal behavior and transition considerations.
- [MDN interpolate-size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size), intrinsic sizing and current compatibility limits.

Sources checked during this study. Compatibility should be checked again when implementing.
