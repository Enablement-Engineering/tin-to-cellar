# Tin to Cellar writer's guide

Use this guide for public website copy, page descriptions, instructions, and status messages. Check behavior against the [current workflow](simplified-workflow.md) and the component being edited. This guide does not change the AI protocol or file format.

## Purpose

Moving tobacco into jars should carry its visual identity with it. Tin to Cellar helps people keep the recognizable character of the packaging in practical jar labels, with room for handwritten dates and sheet layout handled by the app.

The artwork is adapted to a label shape. Describe keeping the original's character, illustration, colors, and lettering. Avoid promising an exact reproduction, archival preservation, better tobacco storage, or guaranteed print alignment.

## Approved hero

**Keep the character of the tin.**

Bring your blends' familiar artwork to the jars in your cellar, with labels adapted for printing and space to write your dates. Choose community designs or create the ones you need.

The headline explains why the tool exists. The subtext names the useful result and the two ways to obtain artwork. Nearby controls explain how to start; the hero need not list input formats or print settings.

## Voice

Write like a fellow collector explaining a useful tool. Be warm in introductions and direct in working screens. Use concrete language and short sentences. Avoid sales language, elaborate metaphors, invented personal stories, and technical vocabulary that does not help the reader decide or act.

Keep Dylan's first-person voice on About. Describe Enablement Engineering as a philosophy and practice of helping people do more with technology, with accessibility, education, and human needs central to the work. Preserve the existing attribution to Hobbiton Piper and the maker credit.

Keep the "Why use AI?" section at the end of About. Lead with the motivation for making familiar packaging artwork more approachable to adapt into personal jar labels, without presuming the reader's reaction to AI. Recognize the original artists and explain reference confirmation and human review. Keep the discussion specific to this use; do not dismiss concerns, claim AI makes better art, or suggest that care alone settles questions of permission.

## Give each kind of copy a job

| Location | Job |
| --- | --- |
| Hero | Explain the purpose and what the user gets. |
| Page introduction | Explain the decision or task on this page. |
| Button | Name the action it performs, such as Choose ZIP or Use this design. |
| Field hint | Explain the expected input or a consequence that matters now. |
| Empty state | Explain how to get started from the current state. |
| Status or error | Say what happened, what remains available when relevant, and the next action. |
| Help | Explain the full workflow, including reference confirmation and printing. |
| Privacy and sharing | Say exactly what stays local, what is sent, and what action sends it. |

Keep button names consistent with instructions that refer to them. Use input-neutral language such as "Choose" or "Import" instead of "Click." Keep accessible names aligned with visible labels.

When a creation action prepares a request, say so before the user selects it. Keep optional creation choices after the community designs on the browsing page. Explain what a download preserves beside its control.

## Terms

| Term | Meaning and use |
| --- | --- |
| Blend | The tobacco being identified or selected. |
| Design | A choice of artwork for a blend. Use "community design" for selectable artwork shared by others. |
| Label | The jar label being selected, prepared, or printed. Use quantities when discussing printed copies. |
| Artwork | The image itself, including its blank writing space. |
| Example pack | The bundled ten-label sample. Reserve "example" for this sample, not all community designs. |
| Label ZIP | The file users bring back from their AI chat or download here. Introduce its format as "CellarPack, the label ZIP" when explaining import. |
| AI chat | The user's separate creative tool. Name ChatGPT only for that specific product or link. |
| Instructions | The complete copied text for the AI. "Copy instructions" is the current action; "request" means the user's blends and design notes. |
| Preview | A view of artwork, a request, or a print sheet. It is not another name for the example pack. |
| Ready to print | Artwork has passed the app's import checks and is available for printing. It does not certify visual fidelity or printer alignment. |

## Claims and workflow boundaries

- Community designs can go straight to printing. AI creation is optional and happens in the user's own chat.
- Say "Designed for ChatGPT" on the instructions screen and in Help. Other agents may work if they can browse the web, inspect and generate images, run code, and return downloadable ZIP files. Do not promise compatibility with every agent that has those tools. Keep "your AI chat" in the remaining steps.
- For new designs, the AI shows the packaging reference. The user confirms it by copying and pasting the photo into the chat. Say "Copy Image" when giving the browser action, never "Copy Image Address." Each label is created and checked before the next. An artwork repair requires the user's decision.
- The app checks imported files and dimensions. The user reviews spelling, fidelity to the original, and usable writing space. Do not call automated checks proof of artistic accuracy.
- The artwork contains the whole blank writing area. The website adds no date text or lines to the label.
- The current print UI supports Avery 94502, nine 2.5-inch circles on US Letter. Keep Actual Size / 100%, headers and footers, and plain-paper alignment guidance near printing.
- In general copy, say "2.5-inch round labels for jar lids." Reserve Avery 94502 for buying, paper setup, and calibration. Link to https://www.avery.com/blank/labels/94502 from Print labels and How it works using "Buy label sheets from Avery" and state that it is not an affiliate link. Plain printer paper, scissors, and a glue stick are an alternative to adhesive sheets. Ask users to check the flat area of their lid; do not promise a perfect fit or infer lid size from jar capacity. Other 2.5-inch label sheets are not necessarily layout-compatible.
- Orders and label ZIPs are processed in the browser. Say "choose" or "import" for local files; reserve "upload" for artwork submitted to the community gallery.
- A readable user-imported pack can automatically share validated diagnostics and eligible public source links. Artwork sharing is a separate explicit submission. Never broaden "your files stay local" into "nothing is shared."
- Saved labels, quantities, and requests stay in this browser. Download labels preserves finished artwork, not quantities or unfinished requests. Avoid account sync, permanent-backup, or offline-startup claims.
- Preserve existing rights, attribution, and privacy disclosures. A copy edit must not invent a permission, endorsement, or new policy.

## Review checklist

1. Does the copy describe the current action and outcome?
2. Does it use the terms above and the exact names of nearby controls?
3. Does a neighboring paragraph or button already say the same thing?
4. Does it make AI sound required, adaptation sound exact, or a local check sound like a guarantee?
5. Does an error give a next step the app actually supports?
6. Do changed accessible names still work in existing tests? Does the text fit at narrow widths, and can people still reach the controls with a pointer as well as a keyboard?

Record the reviewed scope, fixes, and actual verification in a separate assessment. Keep this guide reusable. The [previous guide and audit](copy-guide-history.md) are historical evidence, not current instructions. The [September 15 assessment](copy-assessment-2026-09-15.md) applies this guide to the current public UI.

The subsequent [copy overhaul and flow critiques](copy-flow-critique-2026-09-15.md) review first-time, community, creation, and returning-print journeys, including the findings that shaped these guidance updates.
