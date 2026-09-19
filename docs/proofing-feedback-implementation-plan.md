# Proofing feedback assessment and implementation plan

Assessment date: 2026-09-18. Status: instruction changes implemented locally in protocol `0.0.32`; generation evaluation and shape-aware proofing remain deferred.

The implementation preserves the existing `0.0.31` continuation contract, all 31 earlier release snapshots, and the canonical proof program. New handoffs use the consolidated brief and repair modules. Historical repairs remain pinned. See `docs/hosted-protocol.md` for release validation. The assessment and implementation sequence below retain the original rationale.

Adopt the brief, diagnosis, and repair-planning changes first. Keep the canonical proof algorithm unchanged for that revision. Evaluate shape-aware proofing separately, with explicit compatibility work for the website importer.

This assessment covers the two supplied feedback documents and the current checkout. HEAD is `320e7b1` with protocol `0.0.30`; the shared working tree already contains a local `0.0.31` revision and unrelated website changes. Implement against the settled current sources, preserve the continuation changes, and choose the next unused revision at implementation time. If `0.0.31` remains current, the instruction revision would be `0.0.32`. Neither the current production version nor the original run's image-tool arguments were verified here.

The attachments contain descriptions of four generated images and a third-pass proof, but not those original images or measurement files. Their account of the specific oval is unverified. The mathematical distinction between an oval and its bounding rectangle is valid and confirmed by the checker implementation. The reported run supports hypotheses, not causal claims or measured prompting improvements.

## Assessment and source trace

Paths below are repository-relative. Line references describe the assessed working tree and may move.

| Feedback | Current implementation | Decision |
| --- | --- | --- |
| Remove batch research | `src/lib/prompt/protocol.md:14,73,77` contradicts itself. `src/lib/prompt/prompt.test.ts:73` positively requires the batch sentence. | Fix both wording and regression assertion. This is a verified defect. |
| Use an explicit reference-specific visual brief | `protocol.md:78-83` already requires identity, exact names, isolated input, and a separate artwork brief. | Consolidate these instructions and explicitly preserve an absence of illustration. Treat typography-only identity as meaningful reference evidence. |
| Separate printed design from photographed hardware | `protocol.md:86,92-93` already prohibits mockups and metal rims and prescribes square artwork before bleed masking. | Bring the applicable constraints into the brief itself. Preserve the preparation rules. |
| Use absolute panel targets | `protocol.md:79` already supplies center 50%/70%, width 44%, height 12%; `:91` already requires width, height, and position repair. | Add explicit full-canvas bounds and measured-versus-target comparison. This strengthens execution rather than inventing a new layout. |
| Shorten repair briefs | `protocol.md:80-81` asks for about 250-400 words and applies the brief requirement to every call. | Remove the numeric length expectation. Define a shorter repair format with target, one approved change, and preservation constraints. |
| Diagnose enclosure failure accurately | `protocol.md:90-91,133` mixes corners, actual content, and conservative enclosures. `src/lib/prompt/local-proof.py:215-249` checks all four supplied box corners regardless of region kind. | State that rectangular enclosure containment is the active conservative acceptance rule. A failed enclosure blocks certification but does not establish visible clipping. |
| Separate file corrections from artwork repairs | `protocol.md:94,97,129` already does this. | Preserve and consolidate into the diagnosis route. No new image permission or automatic retry. |
| Record the authored brief and actual input evidence | `protocol.md:35,74,84` already records call state, model uncertainty, files, and proof identity. | Extend that receipt instead of creating another ledger. Distinguish intended input from confirmed selection and authored brief from exposed backend prompt. |
| Keep detailed receipts private | `src/lib/prompt/feedback.md:6,12`, `retrospective.md:9`, and `src/lib/feedback/schema.json` prohibit raw prompts and identifying free text. | Keep receipts in the working session, outside both feedback and retrospective, ZIP contents, automatic uploads, and routine downloads. |
| Add shape-aware proofing | Python uses box corners, but `src/lib/cellarpack/geometry.ts:120-177` already samples declared oval perimeters at 32 angles in trim coordinates. | Defer a separate proof/importer compatibility change. The importer is not an exact contour validator or proof of the actual printed border. |

OpenAI's [image prompting guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-1.5-prompting_guide) supports explicit placement, literal lettering, and change/preserve instructions. Its [image-generation API documentation](https://developers.openai.com/api/docs/guides/image-generation#revised-prompt) documents `revised_prompt` for Responses API image calls. Neither source establishes what the historical chat submitted or exposed. No API integration is needed for this proposal.

## Geometry decision

Keep the default panel target. Its full-bleed bounds are x=0.28-0.72 and y=0.64-0.76, including the entire border. For the default 2.75-inch canvas, the farthest box corner is `sqrt(0.22² + 0.26²) = 0.340588` from the canvas center. That fits inside both the existing 0.38 planning radius and the 0.409091 safe radius. The latter leaves approximately 0.1884 inches of radial clearance at the limiting corner. This calculation verifies the planned slot, not returned artwork.

At physical size, the slot is 1.21 by 0.33 inches. Its interior will be smaller after the outline and padding, so assess handwriting usability rather than repeatedly shrinking it. Typography and illustration still need their own feasible, non-overlapping targets. The example maker/blend width percentages alone cannot establish text containment without vertical bounds.

Do not copy these full-canvas coordinates into the manifest. With 0.125-inch bleed and a 2.5-inch finished label, the planned slot converts to trim-relative x=0.258, y=0.654, width=0.484, height=0.132. Final metadata must instead describe the measured returned writing surface. Pixel regions use inclusive bounds and require conservative rounding; custom dimensions require recalculation.

## Implementation sequence

1. **Settle the source baseline.** Coordinate ownership of the already modified prompt, tests, and release files. Record all existing immutable release hashes and the canonical Python hash. Preserve the local `0.0.31` continuation behavior. Do not overwrite another task's changes or create a competing release snapshot.

2. **Replace overlapping instructions in `src/lib/prompt/protocol.md`.** Keep one brief-building module: selected reference or clean candidate, observed identity, allowed lettering, feasible composition and panel bounds, background, applicable exclusions. Keep one diagnosis-and-repair module. Remove the batch sentence and numeric brief-length expectation. Preserve reference approval, input isolation, attempt counting, proof links, host-pause recovery, and delivery behavior. Keep the Bayou Morning example in evaluation material, not universal instructions.

3. **Define the diagnosis routes precisely.** Reference or wrong-blend failures retain the existing input-isolation recovery. Visible artwork failures need an absolute feasible target and the existing one-call authorization. A box-only rejection is described as an enclosure failure; it remains unaccepted under the pinned rule. Reinspect uncertain measurements without redrawing or reducing boxes to manufacture a pass. If an accurate enclosure still fails, offer a focused layout change to meet that rule, or preserve the draft and stop. File and delivery failures use existing artwork. This closes the present gap where a failed proof is blocked but must not be misreported as visible overflow.

4. **Extend the existing working receipt.** Store the authored visual brief, exposed backend prompt or unknown, intended input, evidence of confirmed selection or unknown, assistant and image model identities separately when available, call authorization/count, native and prepared output identifiers/hashes, coordinate system, measured bounds, absolute target, preserved elements, observed result, exact failed check, and next action. Capture only observable facts and short operational decisions. Keep the detailed receipt out of both diagnostic schemas and uploaded artifacts. No schema or storage-service change is needed.

5. **Add focused regression coverage.** In `src/lib/prompt/prompt.test.ts`, replace the assertion requiring batch research with positive current-label sequencing and negative checks for batch research and the word-count expectation. Cover default bounds, target-versus-measurement distinction, conservative failure wording, unchanged authorization, and receipt privacy. Keep `prompt-revision.test.ts` and `src/lib/protocol/protocol.test.ts` covering historical repair pinning and integrity. Add a synthetic box-only rejection case to `test_local_proof.py`, plus the default slot and inclusive-pixel rounding cases, without changing `local-proof.py`. Use synthetic fixtures, not a claimed reconstruction of the missing pass-three image.

6. **Create one immutable instruction release.** Advance `src/lib/protocol/releases.json` only after the canonical changes settle, then run `npm run protocol:release -- --create`. It creates the new snapshot, portable `public/agent/tin-to-cellar-prompt.md`, and `src/lib/protocol/metadata.json`; its runtime `instructions.json` is ignored build input. Update `docs/hosted-protocol.md` with the final scope and actual validation. Assert all previous snapshots and the proof-script hash remain unchanged. Existing chats retain their pinned instructions and checker.

7. **Validate and evaluate.** Run focused prompt, protocol, importer geometry, and Python proof tests, then the required full npm tests, build, lint, and release verification. Check copied new-run instructions and historical repair instructions. Conduct the generation comparison below only with a separately agreed image-call budget. If deployment is later requested, integrate onto current `origin/main`, use its release workflow, and verify live prompt bytes, health, and the protected budget endpoint.

## Evaluation and acceptance

First run a deterministic scenario review: typography-only reference, illustrated reference, visible overflow, box-only rejection, inaccurate measurement, wrong input, unavailable backend prompt, and file-only failure. Confirm the correct next action, authorization handling, and evidence wording for each.

For an initial generation pilot, use three approved reference types, three independent outputs per condition, and two conditions: the frozen baseline and the new brief module. That is 18 initial image calls, proposed rather than authorized here. Keep references, host, available model/settings, dimensions, preparation, and checker identical; counterbalance condition order. Unknown model settings remain unknown. Review identity and handwriting usability blind to condition. Record first-pass canonical acceptance, calls, unintended changes, reference fidelity, usable writing area, and required human interventions. Report counts and individual failures; nine outputs per condition are a pilot, not evidence of universal superiority.

Evaluate repair briefs separately using the same frozen failed candidate for both conditions and a fixed authorized budget. Record requested and achieved bounds, preserved elements, proof result, and calls. Successive edits of one evolving image are not independent first-generation comparisons. Require no loss of reference fidelity or writing usability; do not lower the checker threshold to improve acceptance numbers.

Instruction release acceptance requires passing regression/integrity checks and an unchanged canonical checker. A claim of better generation requires the controlled image evidence. Local proof success, website import, and physical handwriting/print acceptance are separate results.

## Deferred shape-aware proof work

Define a separate region contract for measured shape, full border extent, uncertainty, and fallback. An ellipse declared in metadata is not evidence that an irregular panel is elliptical. Retain rectangular text enclosures; allow panel contour validation only with defensible measurement. Reject unsupported or uncertain shapes conservatively. Specify tolerances and pixel-to-trim conversion before implementation.

Review `local-proof.py`, `test_local_proof.py`, `src/lib/cellarpack/geometry.ts`, `geometry.test.ts`, and importer tests together. Use shared synthetic geometry cases for a true ellipse inside a circle with outside box corners, actual contour overflow, thick borders, near-tangency, pixel rounding, unit conversion, and irregular contours. Do not treat 32 perimeter samples as an exact analytic guarantee. Determine whether local-only region changes suffice or whether manifest semantics need a separately versioned change. Publish a new pinned proof program/hash only in a new release, and evaluate this acceptance-rule change separately from prompting improvements.

## Evidence gathered in this assessment

The focused existing Vitest suite passed: 37 tests across prompt, historical repair, protocol, and writing-area geometry. These passing tests currently include the assertion requiring the contradictory batch sentence, which illustrates the missing regression coverage. Geometry calculations above were independently recomputed. The Python suite could not run: the default uv cache was inaccessible, and retrying with a writable temporary cache could not resolve PyPI to obtain Pillow. Its checker behavior was inspected in source, not verified by an executed Python test in this assessment. No generation, website acceptance, deployment, or physical printing was performed. Only this planning document was added by this task.
