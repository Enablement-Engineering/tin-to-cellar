# Tin to Cellar

Tin to Cellar helps people make tobacco jar labels using their existing AI subscription. The static website prepares the prompt, opens the resulting CellarPack ZIP locally, and prints labels. Research, image generation, revisions, and packaging stay in one AI conversation.

**[Open the live site](https://tintocellar.com/)** · [Make a prompt](https://tintocellar.com/#create) · [Print labels](https://tintocellar.com/#print)

## Use it

1. Choose tobaccos with autocomplete, type custom names, paste a list, or import an order PDF or screenshot. You can also leave the list blank and supply it in your AI chat.
2. Copy the full prompt into a chat with web research, image generation, and ZIP creation tools. It includes the instructions, complete CellarPack schema, and your request. ChatGPT has been used in the documented experiments; other providers are not yet verified end to end.
3. Review the generated labels against the original packaging in that same conversation. Ask for corrections before the AI packages the final images.
4. Download the `.cellarpack.zip`, import it into Print labels, and choose quantities. Copy any import repair request back into the original chat.
5. Print at Actual Size / 100% on US Letter, with browser headers and footers off, or choose Save as PDF. Avery 94502 holds nine circles per sheet; extra labels continue onto additional sheets. Test alignment on plain paper first.

For a conversation that already has the reusable instructions, use More options → Copy request only. How it works offers a portable Markdown instruction download. The Open ChatGPT link opens the provider; it does not transfer prompts or files automatically.

## What the app handles

- Offers optional tobacco autocomplete over a local names-only catalog, custom names, bulk paste, and special requests, then hands off a complete generation prompt.
- Reads text PDFs and PNG/JPEG/WebP screenshots locally, cleans up order metadata, and offers catalog matches for review. Scanned PDFs are not supported yet.
- Defines and validates the open CellarPack v1 ZIP format with provenance, geometry, artwork, and write-in metadata.
- Imports packs entirely in the browser, quarantining bad labels without uploading user files.
- Uses label quantities to arrange 2.5-inch circles automatically across Avery 94502 sheets.
- Prints a calibration proof and physically sized US Letter sheets, with Save as PDF available through the browser print dialog.

The website opens to a home page that introduces the workflow. Make a prompt, Print labels, and How it works remain available in the navigation and through direct hash links. The wordmark returns home. The tools use warm paper backgrounds, moss actions, and Newsreader headings; the [design system guide](docs/design-system.md) records tokens, components, assets, and adaptation decisions.

How it works covers the AI handoff, hosting costs, local file handling, and printing instructions. Artwork uses 0.125-inch bleed by default, with an integrated light writing surface; the website prints the artwork without adding any label overlays. Artwork geometry remains separate from sheet geometry. Other profiles exist in the format modules, but the current print UI supports Avery 94502 only.

Import problems produce a repair request to paste into the same AI conversation. A failed replacement does not discard the current print job. Optional alignment controls support a test sheet and printer offsets.

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

The dev/build scripts prepare the OCR runtime automatically. `npm run preview` serves the built frontend; `npm run preview:cloudflare` builds and runs the Worker configuration with Wrangler. See the [deployment guide](docs/cloudflare-deployment.md) before using `npm run deploy`, particularly with your own account or domain. A GitHub push does not deploy the live site.

The prompt artifact is published at `public/agent/tin-to-cellar-prompt.md`. CellarPack's human-readable specification and JSON Schema live under `public/spec/`.

## Trust model

The browser does not upload CellarPack files or automatically fetch provenance links. Imported archives are checked against path and size limits, the v1 schema, artwork metadata, and print compatibility. Imported text is rendered as text. No hosted AI service, account system, or file storage is required.

Order reading also runs locally. Screenshot OCR downloads its English reader from the site on first use. Review matches before adding them; purchase quantities do not become print quantities.

A Cloudflare proof service accepts explicitly submitted generated PNGs and returns trim/safe-area guides. Opening the prompt builder automatically starts Turnstile verification, which adds a private allowance for up to 60 checks over 24 hours. Shared processing is capped at 1,000 attempts per UTC month to leave free-tier headroom. The service stores no uploads, only usage counters and credential hashes. Without access or available capacity, the AI makes guides locally. It must visually inspect the proof alongside the original package; guides and ZIP validation do not certify artwork fidelity. Cloud OCR and automatic reference-image caching are not implemented.

The default circular export includes opaque artwork through a 0.125-inch bleed ring, then transparent corners outside the 2.75-inch outer circle. The preview shows the finished trim; printing includes the supplied bleed. The generated image owns the entire blank writing surface, without website-added words or lines.

## Documentation

- [Architecture and documentation index](docs/README.md)
- [Current user workflow](docs/simplified-workflow.md)
- [Design system and UI guidance](docs/design-system.md)
- [Deployment and proof API](docs/cloudflare-deployment.md)
- [CellarPack specification](public/spec/cellarpack-v1.md) and [JSON Schema](public/spec/cellarpack-v1.schema.json)
- [Reusable AI instructions](public/agent/tin-to-cellar-prompt.md)
- [Catalog sources and deduplication](data/catalog/README.md)
- [Catalog update skill](.agents/skills/update-tobacco-catalog/SKILL.md)

Generated packs/PDFs, experiment output, dependencies, builds, OCR bundles, local credentials, and personal inventory reports are ignored by Git. The catalog distributes names and source links, not package artwork.

The current product scope is described in [the simplified workflow](docs/simplified-workflow.md). Earlier planning documents describe broader options that are outside this UI.

## Shared feedback and source links

Pack imports with readable manifests automatically contribute validated AI feedback and public package-source observations for known catalog blends. ZIPs and artwork remain local. Subsequent prompts look up saved sources before searching and ask the AI to report link validity. The website Privacy page covers collection, Cloudflare, AI providers, retention, and source reuse. See [contribution operations](docs/contributions.md) for storage bindings and the protected maintainer export.
