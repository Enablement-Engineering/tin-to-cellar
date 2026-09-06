# Documentation

Use [the live site](https://tintocellar.com/) to create a prompt or print a CellarPack. Start with the [user workflow](simplified-workflow.md) for supported inputs and instructions.

## How the application works

The browser combines a reusable protocol, full JSON Schema, and optional tobacco request into a prompt. The user carries it into one AI conversation for research, image generation, review, and ZIP creation. The downloaded ZIP returns to the browser for validation, sheet layout, and printing. The optional proof service is called explicitly by the AI's tools, never by pack import.

| Component | Responsibility | Location |
| --- | --- | --- |
| Prompt builder | Protocol, schema, request, and return instructions | `src/lib/prompt/` |
| Names catalog | Local autocomplete and alias matching | `src/lib/tobacco-catalog/` |
| Order import | Local PDF extraction, screenshot OCR, cleanup, and suggestions | `src/lib/order-import/` |
| CellarPack reader | Archive, schema, asset, hash, image, and geometry validation | `src/lib/cellarpack/` |
| Sheet profiles | Physical paper and label positions | `src/lib/sheets/` |
| Print studio | Quantities, pagination, calibration, and browser printing | `src/components/PrintStudio.tsx` |
| Proof service | Separate review guides for generated PNGs | `worker/`, `src/lib/proof/` |

The app handles orders and packs locally, renders untrusted manifest text as text, and does not fetch provenance URLs during import. The AI provider handles the content supplied in its chat under that provider's settings. The optional proof endpoint receives only explicitly submitted generated images and does not store them.

## Current guides and contracts

- [User workflow](simplified-workflow.md)
- [Deployment and proof API](cloudflare-deployment.md)
- [CellarPack specification](../public/spec/cellarpack-v1.md) and [schema](../public/spec/cellarpack-v1.schema.json)
- [Portable AI instructions](../public/agent/tin-to-cellar-prompt.md)
- [Catalog evidence and maintenance](../data/catalog/README.md)
- [Catalog update skill](../.agents/skills/update-tobacco-catalog/SKILL.md)

The embedded schema and downloadable instructions must stay synchronized with the source modules. The generator owns all label artwork, including the blank writing surface; the app owns sheet placement and printing. Geometric validation cannot certify fidelity to packaging.

## Historical plans and experiments

The initial [integrated blueprint](integrated-blueprint.md), [website plan](website-product-plan.md), [prompt plan](agent-prompt-plan.md), and [selector plan](tobacco-selector-plan.md) record options that were later removed or deferred. Use the current guides above for implemented behavior.

The dated [fresh-chat tests](fresh-chat-validation-2026-09-05.md), [fidelity comparison](artwork-fidelity-experiment-2026-09-05.md), [autonomous reference experiment](autonomous-reference-experiment-2026-09-05.md), and [proof experiment](proof-service-experiment-2026-09-05.md) record observed outcomes and limitations. Private chat links may be inaccessible to other readers. These reports do not certify future model runs or identify the latest deployment. Generated artifacts and personal inventory reports remain local and ignored.
