# Public copy assessment, September 15, 2026

## Assessment

The app's strongest purpose is carrying the recognizable character of tobacco packaging into useful cellar labels. The previous hero described the visual resemblance but used its supporting paragraph to repeat the entry controls. Several secondary pages still described the older, AI-first workflow.

The [writer's guide](copy-guide.md) now sets the purpose, approved hero, voice, terminology, and limits on claims. The previous guide included obsolete hosted-proof instructions and an old test report. It is preserved separately in [the historical guide](copy-guide-history.md).

## Changes

| Area | Finding | Remediation |
| --- | --- | --- |
| Landing hero | The purpose was less clear than the mechanics. | Applied the approved "Keep the character of the tin" headline and subtext about familiar artwork, printing, and dates. |
| Landing entry and process | Repeated input formats; "Upload" implied sending a locally read file. | Changed the process introduction to choosing a design for the desired packaging and used "Choose" for local input. |
| Page description | Made an AI chat sound required. | Described the purpose and both community and creation paths. |
| About and Inspiration | Described only creating new artwork. | Included community designs and retained personal authorship and source attribution. |
| About, behind the labels | Technical language obscured the actual work and suggested automatic repairs. | Explained reference confirmation, adaptation, checks, and the user's repair decision. |
| Help and creation handoff | Omitted the required packaging-photo handoff. | Explained checking and pasting the reference photo before generation. Help also explains one blend at a time. |
| Help and prompt preview | Used an old button name and exposed format jargon before it helped. | Used current instruction terminology and explained what the copied text contains. |
| Design choices | Called usable community designs "examples." | Used "community design" in headings, descriptions, and accessible names. |
| Example pack | Alternated between "preview pack" and "example pack"; used mouse-specific directions. | Used "example pack" consistently and direct Import and Download actions. |
| ZIP import | Did not explain the expected file format in its introduction. | Introduced CellarPack as the label ZIP from an AI chat or previous download. |

## Reviewed and retained

The source review also covered the order-entry page and reader, artwork request review, selection summary, saved-selection states, import choices and recovery, print quantities and alignment, community browsing and submission, footer, and privacy page.

Their existing operational wording generally gives a useful next step. Keep precise print settings, saved-state consequences, and sharing disclosures near their controls. Repeating the hero's philosophy in errors, quantities, or privacy explanations would make those tasks harder to follow.

The public privacy and rights disclosures were retained. This was a copy and workflow-consistency review, not a new legal review or verification of live retention operations. Admin tools, diagnostic internals, AI protocol text, schemas, and historical planning documents are outside this editorial pass.

## Verification

All 85 targeted component and application tests passed, including the corrected example-pack error assertion. Lint and the production typecheck/build passed. The build reported its existing large-chunk advisory.

All 47 selected browser tests passed against a fresh local preview of that build with API fixtures. They covered the public pages at 320px and 1280px, keyboard and focus behavior, expanded instructions, community selection, example-pack import, saved collections, and print previews. Automated accessibility and overflow checks passed. Additional design-choice checks covered 768px. Desktop and mobile landing screenshots were visually inspected; the new hero fits without clipping. Screenshots are local ignored artifacts at `test-results/overview-1280.png` and `test-results/overview-320.png`.

No application behavior, artwork geometry, or sheet layout was changed. Existing tests were updated for changed accessible names and wording. Unrelated worktree changes were preserved. No deployment, physical printing, screen-reader session, or live-service verification was performed.
