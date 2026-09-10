# Tin to Cellar

Tin to Cellar helps people choose tobacco jar labels from community artwork, create missing designs in their own AI chat, and print them together. One browser-saved workspace retains the selected artwork, quantities and unfinished requests.

**[Open the live site](https://tintocellar.com/)** · [Choose labels](https://tintocellar.com/labels/create) · [Print labels](https://tintocellar.com/labels/print)

## Use it

1. Add blends with autocomplete, custom names, a pasted list, or a reviewed order PDF or screenshot. Choose existing community designs where you want them.
2. Mark any remaining designs with Create my own. Copy their scoped prompt into a chat with research, image generation, and ZIP creation tools. The prompt includes the complete versioned protocol, schemas and local proof program. Existing artwork stays on the website.
3. The AI researches and shows one tobacco's packaging photo. If it is the right package, right-click the photo, choose **Copy Image**, then paste it into the chat and send. The AI generates and proofs that label before researching the next tobacco. If copying is unavailable, attach the saved photo or a clear screenshot. If the chat pauses after an image, reply Continue to resume checks and ZIP preparation. A confirmed artwork defect prompts a separate choice to authorize one focused repair.
4. Download the `.cellarpack.zip`, review its additions in Print labels, and add them to your saved work. Choose quantities across all ready designs. Copy any original-import repair request back into its chat.
5. Print at Actual Size / 100% on US Letter, with browser headers and footers off, or choose Save as PDF. Avery 94502 holds nine circles per sheet; extra labels continue onto additional sheets. Test alignment on plain paper first.

For an empty website list, Choose blends in my AI chat keeps the conversation-led entrance available. How it works offers reusable instructions. No prompt or file transfers automatically. Download labels preserves finished artwork as a standard CellarPack; pending requests and quantities stay in this browser.

Saved requests retain the instructions originally copied. When newer instructions are available, **Copy updated instructions for a new chat** keeps the same request and replaces its saved instructions. Use the updated copy in a new chat; existing conversations retain their original protocol.

## What the app handles

- Offers catalog suggestions, custom names, reviewed order intake, exact community-design lookup and a complete prompt for explicitly requested creations.
- Reads text PDFs and PNG/JPEG/WebP screenshots locally, cleans up order metadata, and offers catalog matches for review. Scanned PDFs are not supported yet.
- Defines and validates the open CellarPack v1 ZIP format with provenance, geometry, artwork, and write-in metadata.
- Reviews additive imports entirely in the browser, quarantining bad labels without uploading user files. Saves validated artwork locally and prevents stale tab writes from overwriting current work.
- Uses label quantities to arrange 2.5-inch circles automatically across Avery 94502 sheets.
- Prints a calibration proof and physically sized US Letter sheets, with Save as PDF available through the browser print dialog.

The root opens the Labels introduction. Choose labels and Print labels are the main working views; Community labels adds to the same saved work. How it works remains available through the footer. The [design system guide](docs/design-system.md) records visual tokens, components and adaptation decisions.

How it works covers the AI handoff, hosting costs, local file handling, and printing instructions. Artwork uses 0.125-inch bleed by default, with an integrated light writing surface; the website prints the artwork without adding any label overlays. Artwork geometry remains separate from sheet geometry. Other profiles exist in the format modules, but the current print UI supports Avery 94502 only.

Import problems produce a repair request for the original AI conversation. Rejected imports and failed saves do not discard the committed labels. Optional alignment controls support a test sheet and printer offsets.

## Development

Use a current Node.js release supported by Vite 8, with npm. No AI API key is required for the frontend.

```sh
git clone https://github.com/Enablement-Engineering/tin-to-cellar.git
cd tin-to-cellar
npm ci
npm run dev
```

Quality gates:

```sh
npm test
npm run lint
npm run build
```

The dev/build scripts prepare the OCR runtime automatically. `npm run dev` builds the frontend and serves it with the real Worker API locally through Wrangler. `npm run preview` serves an existing build with that backend; `npm run preview:cloudflare` is an alias for `npm run dev`. Rebuild after frontend edits. For frontend-only work with hot reload, use `npm run dev:frontend`; it does not run the API. See the [deployment guide](docs/cloudflare-deployment.md) before using `npm run deploy`, particularly with your own account or domain. Pushes to `main` deploy through the configured [GitHub workflow](docs/ci-deployment.md) after checks pass.

The prompt artifact is published at `public/agent/tin-to-cellar-prompt.md`. The [protocol operations guide](docs/hosted-protocol.md) covers the selected revision, conversation behavior, integrity verification and release process. CellarPack's human-readable specification and JSON Schema live under `public/spec/`.

## Trust model

The browser does not upload CellarPack files or automatically fetch provenance links. Imported archives are checked against path and size limits, the v1 schema, artwork metadata, and print compatibility. Imported text is rendered as text. No hosted AI service, account system, or file storage is required.

Order reading also runs locally. Screenshot OCR downloads its English reader from the site on first use. Review matches before adding them; purchase quantities do not become print quantities.

Before saving or copying a prepared creation request, the browser verifies the bundled instructions against their release hash and byte length, then checks that the prompt contains exactly those instructions and the frozen request. These checks depend on the application and its release metadata being trusted. Imported CellarPacks still undergo their own validation.

The protocol supplies a tested Python/Pillow program that the AI runs inside its chat. Its `prepare` command converts artwork to a clean sRGB PNG, verifies lossless serialization, and preserves native dimensions. Its `inspect` command creates separate trim, bleed, and safe-area guides. See the [local preparation and proof guide](src/lib/prompt/LOCAL-PROOF.md) for commands and limits. The AI must visually inspect the proof alongside the original package; guides and ZIP validation do not certify artwork fidelity. Cloud OCR and automatic reference-image caching are not implemented.

The default circular export includes opaque artwork through a 0.125-inch bleed ring, then transparent corners outside the 2.75-inch outer circle. The preview shows the finished trim; printing includes the supplied bleed. The generated image owns the entire blank writing surface, without website-added words or lines.

## Documentation

- [Architecture and documentation index](docs/README.md)
- [Current user workflow](docs/simplified-workflow.md)
- [Design system and UI guidance](docs/design-system.md)
- [Deployment and local review guides](docs/cloudflare-deployment.md)
- [CellarPack specification](public/spec/cellarpack-v1.md) and [JSON Schema](public/spec/cellarpack-v1.schema.json)
- [Reusable AI instructions](public/agent/tin-to-cellar-prompt.md)
- [Catalog sources and deduplication](data/catalog/README.md)
- [Catalog update skill](.agents/skills/update-tobacco-catalog/SKILL.md)

Generated packs/PDFs, experiment output, dependencies, builds, OCR bundles, local credentials, and personal inventory reports are ignored by Git. The catalog distributes names and source links, not package artwork.

The current product scope is described in [the simplified workflow](docs/simplified-workflow.md). Earlier planning documents describe broader options that are outside this UI.

## Shared feedback and source links

New accepted local imports, and readable rejected imports, contribute validated AI feedback and public package-source observations for known catalog blends. ZIPs and artwork remain local. Each original import keeps its own receipt; reload, navigation, printing and combined downloads do not send it again. Subsequent prompts use source leads for research, not as automatic artwork choices. See [contribution operations](docs/contributions.md) for storage bindings and the protected maintainer export.
