# Tin to Cellar

Tin to Cellar turns a tobacco list and optional packaging references into a research-grounded agent brief, accepts the resulting open CellarPack archive locally, and composes print-ready cellar labels.

## Current vertical slice

- Builds guided prompts and one-click ChatGPT handoffs, including an interview path for incomplete input.
- Defines and validates the open CellarPack v1 ZIP format with provenance, geometry, artwork, and write-in metadata.
- Imports packs entirely in the browser, quarantining bad labels without uploading user files.
- Composes, reorders, duplicates, crops, and previews labels across multi-page Avery 94502 sheets.
- Prints a calibration proof and physically sized US Letter sheets, with Save as PDF available through the browser print dialog.

Full-sheet and custom-stock profiles exist in the format and geometry modules; the first production workbench is intentionally focused on Avery 94502.

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

The browser does not upload CellarPack files or automatically fetch provenance links. Imported archives are preflighted before extraction, checked against size and path limits, and validated against the v1 schema. Research sources are displayed for review and opened only after user confirmation.
