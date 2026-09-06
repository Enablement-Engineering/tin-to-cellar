# Tin to Cellar

Tin to Cellar helps people make tobacco jar labels using their existing AI subscription. The static website prepares the prompt, opens the resulting CellarPack ZIP locally, and prints labels. Research, image generation, revisions, and packaging stay in one AI conversation.

## Current vertical slice

- Offers optional tobacco autocomplete over a local names-only catalog, custom names, bulk paste, and special requests, then hands off a complete generation prompt.
- Defines and validates the open CellarPack v1 ZIP format with provenance, geometry, artwork, and write-in metadata.
- Imports packs entirely in the browser, quarantining bad labels without uploading user files.
- Uses label quantities to arrange 2.5-inch circles automatically across Avery 94502 sheets.
- Prints a calibration proof and physically sized US Letter sheets, with Save as PDF available through the browser print dialog.

The website opens directly to the prompt form, with Print labels and How it works in the navigation. The explanation tab covers the AI handoff, hosting costs, local file handling, and printing instructions. Artwork uses 0.125-inch bleed by default, with an integrated light writing surface; the website prints the artwork without adding any label overlays. Artwork geometry remains separate from sheet geometry. Other profiles exist in the format modules, but the current print UI supports Avery 94502 only.

Import problems produce a repair request to paste into the same AI conversation. A failed replacement does not discard the current print job. Optional alignment controls support a test sheet and printer offsets.

## Development

```sh
npm install
npm run dev
```

Quality gates:

```sh
npm test
npm run lint
npm run build
```

The prompt artifact is published at `public/agent/tin-to-cellar-prompt.md`. CellarPack's human-readable specification and JSON Schema live under `public/spec/`.

## Trust model

The browser does not upload CellarPack files or automatically fetch provenance links. Imported archives are checked against path and size limits, the v1 schema, artwork metadata, and print compatibility. Imported text is rendered as text. No hosted AI service, account system, or file storage is required.

The current product scope is described in [the simplified workflow](docs/simplified-workflow.md). Earlier planning documents describe broader options that are outside this UI.
