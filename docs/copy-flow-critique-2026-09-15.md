# Copy overhaul and flow critiques

September 15, 2026. This continues the [initial copy assessment](copy-assessment-2026-09-15.md) using the [writer's guide](copy-guide.md).

## Scope and method

The overhaul covers public introductions, order intake, artwork selection and requests, the AI handoff, import review and recovery, printing, community browsing and sharing, help, and privacy explanations. The approved hero remains unchanged. Private administration, AI protocol contracts, and artwork generation were outside this editorial scope.

After rewriting the copy, four scenario-based design critique sessions examined the running app at 1280px and 320px. Each considered the first impression, next action, reading order, consistency, and accessibility. These were agent walkthroughs with synthetic service responses, not participant research or live-service tests. Screenshots and rendered-text records are under `output/copy-review/perspectives/`; the first pass is preserved in `output/copy-review/perspectives-before-fixes/`.

The checkout also contains concurrent work on adding blends and grouping saved labels. The critiques use the current behavior. That functional work is separate from this copy overhaul; it was preserved.

## Session 1: A first-time collector with a list of blends

Question: Can someone understand the purpose, choose an entrance, and review a list without learning the app's terminology first?

Walkthrough: Home, example section, Add several blends, paste a short order, review the match.

What works: The hero explains the purpose. The two main entry cards distinguish bringing a list from browsing finished designs. The order review asks for a choice and explains that print quantities come later. Its save button names the next destination.

Finding F1, moderate: At 320px, the example section kept two columns. The description became a narrow stack of short lines while the artwork shrank to about 100px across. Nothing overflowed, but the section was difficult to read and weak as a preview of the result.

Fix: Stack the copy and artwork below 600px. Give the artwork up to 220px of width. Keep the example action and existing artwork disclosure.

Decision: Retain the manual-entry and ZIP-import shortcuts. They serve different inputs, and the revised labels make those choices explicit. Preserve the existing keyboard and focus handling in order review.

## Session 2: A collector who wants existing community designs

Question: Can someone find a design, save it, and print without believing that AI creation is required?

Walkthrough: Browse label designs, view a synthetic community result, add it, review and print, change quantity, reload.

What works: The page explicitly says community designs can be used without an AI chat. Add to your labels leads to a saved selection and a Review & print action. Quantity survives reload.

Finding F2, moderate: The invitation to create different artwork appeared between search and the first result. At 320px, that placed the creation button before any artwork could be seen. It competed with the reason this user opened the gallery.

Fix: Place the creation invitation after the results and pagination. It remains available for an empty search and when the library is unavailable.

Decision: Keep per-design actions beside the artwork and retain clear empty, loading, and unavailable states. Do not turn the gallery into another creation setup screen.

## Session 3: A collector who needs new artwork

Question: Does the user know when a blend is saved, when a request is prepared, and when work moves to their own AI chat?

Walkthrough: Enter a custom blend, open artwork choices, choose AI creation, review the saved request, open instructions, and copy them.

What works: The choice dialog explains that selecting the AI route saves a request. The following screens distinguish reviewing a request, copying instructions, and returning a ZIP. The revised handoff names the chat capabilities needed and the packaging-photo confirmation step.

Finding F3, high: At 320px, the open custom-name suggestion covered Add blend. A real pointer click timed out because the suggestion intercepted it. Keyboard activation alone had not exposed this problem.

Fix: Put the manual-entry suggestions in normal document flow below 600px so the button moves below them. Keep input focus during the button's pointer press so blur does not collapse the suggestions and move the button before the click completes. The existing browser scenario now activates Add blend with a pointer while suggestions are open.

Finding F4, minor: The custom-name explanation offered community browsing inside a dialog without explaining how to leave that dialog and reach browsing.

Fix: Tell the user to close the choices and use Browse label designs. Help also explains attaching a saved photo or screenshot when Copy Image is unavailable.

Decision: Keep the review step and the explicit Copy instructions action. Copying does not start an AI job. No image generation was needed for this critique.

## Session 4: A returning user with a ZIP and a print job

Question: Can the user add designs, recover from an invalid file, and keep their print job without mistaking a download for a complete backup?

Walkthrough: Open Print labels, import a synthetic label ZIP, review and add it, set three copies, import an invalid ZIP, inspect recovery, and read printing and privacy guidance.

What works: Import review offers a clear add or cancel decision. The print preview and quantities remain available after the invalid ZIP. Printing instructions name the settings in the browser dialog and distinguish artwork checks from a plain-paper alignment test.

Finding F5, moderate: The repair heading depended on whether any saved labels existed. An invalid new ZIP produced Some labels need fixing even when the existing labels were printable. This could make the user distrust good saved work.

Fix: Use Repair this import and refer to the chat that made that ZIP. State that saved labels remain printable. Import history now says imported rather than uploaded.

Finding F6, moderate: Download labels lacked an adjacent explanation of what it preserves. A returning user could reasonably assume the downloaded ZIP included print quantities or unfinished requests.

Fix: Explain beside the download controls that the ZIP saves artwork, while quantities and unfinished requests stay in this browser. Keep Save as PDF instructions beside printing.

Finding F7, minor: The import summary said quantities stay the same even for a first import with no existing quantities.

Fix: Explain that new labels start at quantity 1 and replacing artwork retains its quantity. The separate start-over confirmation still warns that replacing the entire saved selection resets quantities and print settings.

Decision: Keep precise error details available for repair. Keep public sharing separate from local import, and preserve the existing privacy and rights conditions.

## Cross-cutting copy decisions

- Use community design for selectable artwork and example pack for the bundled sample.
- Give each introduction a task or decision; use the hero's philosophy only where it explains the product.
- Use instructions for the complete copied text and request for blends and design notes.
- Preserve distinctions between original artwork, adapted label artwork, file checks, visual review, and physical printer alignment.
- Break dense privacy explanations into shorter paragraphs. Preserve automatic feedback sharing, optional notes, public source suggestions, artwork-submission consent, retention periods, and external-service disclosures.
- Keep file-format details at import and sharing boundaries. Avoid vague promises of exact reproduction, guaranteed printing, or permanent browser storage.

## Verification

- Component and app tests: 171 passed across 20 files. Run with `NODE_OPTIONS=--no-experimental-webstorage npm test -- src/components src/App.test.tsx --maxWorkers=2` so the local Node runtime uses the test environment's browser storage.
- Scenario walkthroughs: all 8 passed, covering the four perspectives at 1280px and 320px. The captured states had no horizontal overflow or automated axe findings. Screenshots were also reviewed for reading order, spacing, and action visibility.
- Existing accessibility and beta-readiness browser checks: 37 passed across the initial run and a targeted rerun. The initial run passed 36; the remaining check referenced two replaced headings and passed after its expectations were updated. These checks include keyboard operation, narrow layouts, reduced motion, saved selections, and the pointer regression described in F3.
- Typecheck and production build passed. Lint and `git diff --check` passed. The build retains its existing bundle-size warning.

This verifies the local implementation with test fixtures. It does not establish participant usability, screen-reader acceptance, live AI-provider behavior, or physical printer alignment. Nothing was deployed.
