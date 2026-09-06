# Tin to Cellar workflow

The website keeps hosting inexpensive by using the user's existing AI subscription for research, artwork, and packaging. It supplies instructions and handles local printing.

Start at [tintocellar.com](https://tintocellar.com/). The home page introduces the workflow. Use [Make a prompt](https://tintocellar.com/#create) to begin or [Print labels](https://tintocellar.com/#print) to import an existing pack. [How it works](https://tintocellar.com/#help) explains the handoff and printing. The wordmark returns to `#home`; direct tool links remain available. See the [design system](design-system.md) for the interface's visual rules and asset choices.

## Create labels

Tobacco names and special requests are optional. If no tobacco request is supplied, the AI asks which blends to label before researching or generating. It must not infer an inventory from account memory or unrelated chats. Label dimensions, bleed, and paper profile have supported defaults: 2.5-inch circles, 0.125-inch bleed, and Avery 94502. Generated artwork owns the entire blank writing surface, with no words or writing line added by the website.

Expand Import order to read text PDFs up to 20 pages, PNG/JPEG/WebP screenshots up to 20 million pixels, or pasted text up to 100,000 characters. Files are limited to 10 MiB. Extraction and English OCR run locally; scanned PDFs are not supported. Common price, weight, promotional, and accessory noise is filtered before catalog matching. Rows with one suggestion are preselected; ambiguous rows need a choice. Review and confirm with Add selected tobaccos. File imports show matches without a raw OCR editor. Purchase quantities do not determine label quantities.

The handoff supplies the actual CellarPack contract. It must work without asking the AI to fetch a development server on the user's computer. The primary Copy prompt button carries instructions, the complete schema, and the current request. More options provides Copy request only for a conversation or reusable setup that already has the instructions. A request explicitly asks for missing instructions instead of inventing the format. How it works offers a downloadable Markdown instruction file and a ChatGPT convenience link; the link transfers no prompt.

Instructions include the current site's #print destination and manual ZIP import directions. The hash opens Print labels without uploading or fetching a file. The model must not fetch the destination, which may be a local development address. The reusable Markdown file is a portable instruction document, not an automatically installed provider skill.

The prompt consists of a short task and requirements, the complete minified JSON Schema, and the supplied project input. It does not prescribe a personality. Research must inspect an actual package image, use that image as a generation reference when supported, and preserve the package identity while adapting its layout for the label and writing area.

One AI conversation handles missing information, package-image research, generation, visual inspection, revisions, ZIP packaging, and any import repairs. Reference photographs can be attached in that conversation. The AI should ask only questions needed to proceed and must distinguish checks it ran from checks it could not run.

The chat needs research/image inspection, image generation, and file/ZIP creation capabilities. Provider and subscription support varies. Read full prompt starts collapsed. Expand it to inspect readable Markdown or its source; both expose the same complete prompt. Copy prompt always copies the full instructions, schema, and request, regardless of preview state.

Review the output against the inspected source. Circular reflow may rearrange rectangular packaging, but must preserve defining illustration style, character details, logo, palette, and lettering. Shared subjects or colors are insufficient. Use a saved browser capture as generator input when a direct image download fails and the provider supports it. If no actual package can be inspected, request a reference attachment.

The [proof service](cloudflare-deployment.md#proof-api) returns a separate image with trim and safe guides. Access is prepared automatically in Make a prompt. It accepts only the generated PNG explicitly sent to it; importing an order or pack never calls this endpoint. If unreachable, the AI should produce equivalent guides locally and report that fallback. Keep annotated proofs out of the final ZIP. Geometry checks and model self-review do not establish packaging fidelity.

## Print labels

The user opens the returned ZIP, chooses quantities, previews automatically arranged sheets, and prints. A quantity of zero excludes a label. Labels retain their artwork geometry; the website does not crop or resize incompatible art to force a fit.

Paper and alignment contains optional printer adjustments and starts collapsed. The proof and artwork use the same page geometry and offsets. Users print on US Letter at actual size, without browser headers or footers. A physical ruler measurement and test sheet remain necessary to establish printer accuracy.

The preview clips the image at the circular trim boundary. Printed output includes the supplied outer bleed circle: 2.75 inches for the default 2.5-inch trim with 0.125-inch bleed on each side. Keep the entire trim and bleed opaque, with transparency only outside the outer bleed circle. Essential content and every writing-panel corner belong inside the circular safe inset.

Avery 94502 supports nine labels per sheet. Quantities continue across additional sheets automatically. Importing a different pack replaces the current pack rather than merging jobs; keep your downloaded ZIPs for later use. Save as PDF is available in the browser print dialog.

Validation runs during import. Problems produce a concise explanation and a copyable repair request for the existing conversation. Invalid replacement files must preserve the current usable job. Provenance remains in the pack without becoming an always-visible settings panel or causing automatic network requests.

## Deferred

Custom paper, editable label geometry, crop and zoom controls, manual slot arrangement, alternate date modes, inventory features, and extra export formats are outside this UI. Format-level support does not imply a control belongs on the website.

Cloud OCR, automatic ZIP transfer, and a shared package-image cache are not implemented.

The optional tobacco autocomplete searches a static catalog of 1,482 entries across 146 maker/brand names, with local alias and typo matching. Users explicitly select a result, enter arbitrary names, or paste a list. Typed text is included in the prompt even before selection. The [selector plan](tobacco-selector-plan.md) records scope and future catalog expansion; live web search and automatic file handoff remain future options.

## Shared sources and feedback

ZIP import with a readable manifests submit a limited contribution separately from local printing. Validated feedback and eligible public source observations for known catalog blends improve subsequent prompts. The raw ZIP, artwork, and order files remain local. Source links are never fetched during import. See [collection details](contributions.md) and the website Privacy page.
