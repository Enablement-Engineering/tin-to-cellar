# Tin to Cellar workflow

The website keeps hosting inexpensive by using the user's existing AI subscription for research, artwork, and packaging. It supplies instructions and handles local printing.

## Create labels

Tobacco names and special requests are optional. If names are omitted, the AI uses the user's supplied conversation context or asks which blends to label. Label dimensions, bleed, and paper profile have supported defaults: 2.5-inch circles, 0.125-inch bleed, and Avery 94502. The writing area has an unlabeled line, with no JARRED or CELLARED wording.

The handoff supplies the actual CellarPack contract. It must work without asking the AI to fetch a development server on the user's computer. The primary Copy prompt button carries instructions, the complete schema, and the current request. More options provides Copy request only for a conversation or reusable setup that already has the instructions. A request explicitly asks for missing instructions instead of inventing the format. How it works offers a downloadable Markdown instruction file and a ChatGPT convenience link; the link transfers no prompt.

Instructions include the current site's #print destination and manual ZIP import directions. The hash opens Print labels without uploading or fetching a file. The model must not fetch the destination, which may be a local development address. The reusable Markdown file is a portable instruction document, not an automatically installed provider skill.

The prompt consists of a short task and requirements, the complete minified JSON Schema, and the supplied project input. It does not prescribe a personality. Research must inspect an actual package image, use that image as a generation reference when supported, and preserve the package identity while adapting its layout for the label and writing area.

One AI conversation handles missing information, package-image research, generation, visual inspection, revisions, ZIP packaging, and any import repairs. Reference photographs can be attached in that conversation. The AI should ask only questions needed to proceed and must distinguish checks it ran from checks it could not run.

## Print labels

The user opens the returned ZIP, chooses quantities, previews automatically arranged sheets, and prints. A quantity of zero excludes a label. Labels retain their artwork geometry; the website does not crop or resize incompatible art to force a fit.

Alignment adjustments are optional. The proof and artwork use the same page geometry and offsets. Users print on US Letter at actual size, without browser headers or footers. A physical ruler measurement and test sheet remain necessary to establish printer accuracy.

The current renderer maps the bleed-inclusive image into the trim coordinates and clips output at the circular trim boundary. It does not print extra artwork beyond the die cut. Adding external bleed requires a sheet-specific gutter policy to prevent neighboring labels from overlapping.

Validation runs during import. Problems produce a concise explanation and a copyable repair request for the existing conversation. Invalid replacement files must preserve the current usable job. Provenance remains in the pack without becoming an always-visible settings panel or causing automatic network requests.

## Deferred

Custom paper, editable label geometry, crop and zoom controls, manual slot arrangement, alternate date modes, inventory features, and extra export formats are outside this UI. Format-level support does not imply a control belongs on the website.

The optional tobacco autocomplete searches a static catalog of 1,482 entries across 146 maker/brand names, with local alias and typo matching. Users explicitly select a result, enter arbitrary names, or paste a list. Typed text is included in the prompt even before selection. The [selector plan](tobacco-selector-plan.md) records scope and future catalog expansion; live web search and automatic file handoff remain future options.
