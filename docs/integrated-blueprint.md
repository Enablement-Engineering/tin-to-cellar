# Tin to Cellar — Integrated Product Blueprint

Status: historical planning baseline. The current UI scope is defined in [the simplified workflow](simplified-workflow.md).

## Product promise

**From tin inspiration to print-ready cellar labels.** A user describes their tobaccos and label needs, uses ChatGPT or Codex to research and generate faithful cellar-label adaptations, downloads an open CellarPack, then privately arranges, calibrates, and prints the labels in Tin to Cellar.

The trust boundary is deliberate:

- the agent owns questions, package research, art direction, image generation, and pack construction;
- the open format owns the portable handoff and validation contract;
- the website owns deterministic geometry, microtype, composition, calibration, and printing.

## Moving components

### 1. Project configurator

Collects whatever the user already knows:

- tobacco list, with optional maker and per-blend notes;
- label shape and finished dimensions;
- optional stock preference such as Avery 94502 or full-sheet adhesive paper;
- optional inspiration URLs and the names of local files the user will attach later;
- optional art-direction notes.

It previews the exact prompt and offers:

- **Create in ChatGPT** using `https://chatgpt.com/?prompt=<encoded>`;
- **Copy prompt** as the universal fallback;
- **Copy for Codex** with deterministic packaging and validation instructions.

Local files never travel through the deep link. The prompt names the expected attachments and asks the user to add them in the destination conversation.

### 2. Adaptive Tin to Cellar agent

The agent accepts a complete request or progressively interviews the user. It asks only for information that materially changes generation.

Blocking facts are:

1. at least one identifiable tobacco;
2. label shape and finished dimensions;
3. one inspected actual package image for each tobacco;
4. a user choice only when materially different packaging variants cannot be resolved safely;
5. any reference the user explicitly made required but has not supplied.

Everything else receives disclosed defaults.

### 3. Mandatory package research

Before generating a label, the agent must inspect the real tin or package image. It must not generate from memory or a written blend description alone.

Default retrieval budget per tobacco:

- one focused search;
- preferably a manufacturer or brand source;
- one reputable specialist retailer, distributor, or archive when needed;
- a third source only to resolve ambiguity, inadequate imagery, or a conflicting variant.

The research record captures:

- source URL and title;
- selected package variant;
- palette;
- central motifs;
- border treatment;
- typographic character and hierarchy;
- period, texture, and overall visual identity;
- what was observed versus what was creatively introduced.

If no usable source image can be inspected, the agent asks for a user-supplied photo rather than inventing fidelity.

### 4. Image-generation stage

The result is a recognizable, shape-adapted cellar rendition of the selected package—not a screenshot pasted into a circle and not a claimed exact reproduction.

Each image request specifies:

- finished shape and aspect ratio;
- trim, bleed, and safe area;
- hierarchy and composition;
- package sources and the role of user inspiration;
- palette, medium, texture, and period;
- output size, format, and background;
- negative constraints such as no jar mockup, tabletop, contact sheet, interior crop marks, or critical detail outside the safe area.

Every artwork contains a blank, light, low-texture writing surface integrated into the design. It may resemble parchment, a brass-edged cream plaque, a library-card strip, an enamel field, or another treatment native to the package style.

The bitmap should not be responsible for small `JARRED` typography or the date line. Those remain crisp website overlays. Large display lettering integral to the package identity may be rasterized only when spelling and rendering pass visual inspection.

### 5. Visual QA

Each label is inspected at full resolution and approximate physical print size for:

- recognizable fidelity to the researched package;
- adaptation to the requested shape;
- spelling and display-lettering quality;
- continuous borders and adequate bleed;
- safe-area containment;
- a light, unobstructed, writable date surface;
- absence of watermarks, duplicate ornaments, gibberish, mockups, or unintended backgrounds.

Allow at most three render attempts per label by default. A failed label is reported and omitted from the validated set rather than silently included.

### 6. CellarPack v1

The generator returns a `.cellarpack.zip` containing:

```text
manifest.json
artwork/<label-id>.png
preview/contact-sheet.jpg       optional
sheet-profiles/<custom>.json    optional
```

The pack contains label artwork, trim geometry, normalized write-in regions, provenance, hashes, and optional print intent. It does not contain a precomposed Avery page.

Default v1 artwork contract:

- PNG;
- sRGB;
- 600 PPI target and 300 PPI minimum;
- 1/8-inch bleed;
- physical dimensions declared independently of pixels;
- normalized overlay coordinates relative to the finished trim box;
- exactly one integrated jarred-date surface per generator-conformant label.

### 7. Sheet-profile registry

Sheet geometry is versioned separately from artwork. Initial profiles:

- `tin-to-cellar:avery-94502@1`;
- `tin-to-cellar:full-sheet-letter@1`;
- `tin-to-cellar:full-sheet-a4@1`;
- user-defined custom profiles.

A named preset is a hint in the pack. The website resolves and validates it. The importer never silently scales artwork to force it into an incompatible slot.

### 8. Browser-local importer and validator

The website validates before displaying or decoding untrusted pack content:

- safe ZIP paths and normalized unique names;
- archive, file-count, decompression, pixel, and JSON limits;
- manifest schema and supported major version;
- actual image signatures, dimensions, and hashes;
- physical geometry and asset aspect ratio;
- normalized write-in region containment;
- required research and provenance.

Unsafe root/archive failures reject the pack. Label-specific failures quarantine only affected labels so valid work remains usable. Import makes no source-URL requests automatically.

### 9. Local print project

The imported pack remains immutable source material. A separate browser-local project owns:

- selected sheet profile;
- label instances and order;
- duplicates and blank slots;
- instance-level crop and zoom;
- chosen `JARRED`, `CELLARED`, line-only, or blank overlay;
- printer/stock calibration;
- page composition and export preferences.

This separation allows the same pack to produce several sheets without rewriting provenance or original geometry.

### 10. Composition workbench

The user can:

- drag labels to reorder;
- reorder with click/tap or keyboard controls;
- duplicate, remove, or insert blank slots;
- continue overflow onto additional pages;
- adjust crop and zoom nondestructively;
- toggle trim, bleed, safe-area, and printable-area guides;
- inspect research sources without including them in print output.

The website renders the microtype and line over the declared light surface. It warns rather than covering bad art with an unrelated opaque patch.

### 11. Calibration, print, and export

The site provides a low-ink plain-paper calibration page with a measurable ruler and alignment marks. Positional X/Y offsets remain separate from scale correction.

Production output:

- uses physical CSS/PDF dimensions;
- defaults to 100% / Actual Size;
- excludes controls, warnings, provenance, shadows, and preview guides;
- exports print-ready PDF or a browser Save-as-PDF path chosen during implementation;
- exports self-contained HTML;
- optionally exports individual final label images.

## Resolved v1 decisions

1. **One final artwork per label.** Variant galleries are deferred. A user resolves current versus historical packaging before final generation.
2. **The writing surface is mandatory.** Every generated artwork includes it. The website may show `JARRED`, `CELLARED`, a line only, or leave it visually blank.
3. **`JARRED` is the default overlay.** It is user-selectable without regenerating art.
4. **Artwork geometry and sheet geometry are independent.** A stock preset may suggest dimensions but never silently changes them.
5. **Research provenance is required.** Third-party source images are not embedded by default.
6. **The MVP is local-first and account-free.** Import, editing, validation, and printing do not upload pack contents.
7. **Custom shapes are bounded in v1.** Circle, oval, square, rectangle, rounded rectangle, and custom rectangular aspect ratio are supported. Arbitrary vector cut paths are deferred.
8. **Capability status is explicit.** Outputs are named validated pack, unvalidated draft pack, loose bundle, or research-only fallback.
9. **ChatGPT deep links require a copy fallback.** The query-parameter behavior is useful but not treated as a guaranteed public API.

## MVP delivery sequence

### Milestone 1 — Freeze the contracts

- Publish the universal agent prompt.
- Freeze CellarPack JSON Schema 1.0.
- Freeze initial sheet profiles.
- Create valid, partial, malformed, and hostile fixture packs.

### Milestone 2 — Prove generation to import

- Run representative prompt tests.
- Generate a multi-label pack.
- Validate it independently.
- Import it locally and display provenance and geometry correctly.

### Milestone 3 — Prove composition

- Implement accessible reorder, duplicate, remove, and blank slots.
- Add crop/zoom and guide overlays.
- Render `JARRED` and the writing line inside normalized regions.

### Milestone 4 — Prove physical output

- Physically verify Avery 94502 geometry.
- Implement full-sheet Letter and custom layouts.
- Build calibration and direct-print flow.
- Compare direct print, PDF, and self-contained HTML at physical size.

### Milestone 5 — Limited beta

- Test the empty-input interview and supplied-list paths.
- Test current/historical package conflicts.
- Test missing web, image, ZIP, and validation capabilities.
- Complete keyboard-only and screen-reader workflows.
- Confirm no pack data leaves the browser.

## Evaluation matrix

### Prompt fixtures

- no initial input;
- clean maker/blend list;
- ambiguous blend name;
- discontinued blend with historical packaging;
- conflicting current and historical designs;
- supplied package image;
- inspiration that supplements package identity;
- inspiration that explicitly overrides selected style elements;
- no web search;
- no image generation;
- no ZIP/filesystem;
- repeated image failure.

### Pack fixtures

- conforming multi-shape pack;
- low-PPI warning;
- missing artwork;
- bad hash;
- write-in region outside a circle;
- limited research;
- unknown optional 1.x fields;
- unsupported major version;
- path traversal, duplicate normalized names, MIME spoofing, decompression bomb, and pixel bomb.

### Print fixtures

- Avery 94502 at 100%;
- US Letter full-sheet grid;
- A4 full-sheet grid;
- oval and rounded-rectangle custom sheets;
- X/Y calibration offset;
- keyboard-only reorder and crop;
- direct print versus PDF/HTML parity.

## Remaining implementation decisions

These require prototyping or physical evidence rather than more abstract planning:

1. Accepted physical-size and positional tolerance.
2. Supported browser, operating-system, and printer matrix.
3. Browser-generated PDF versus documented Save-as-PDF for MVP.
4. Minimum practical handwriting-surface dimensions across label sizes.
5. The simplest custom-sheet input model that still covers real stock.
6. Safe encoded-URL threshold before recommending copy/paste.
7. Final trademark, attribution, personal-use, and non-affiliation language.
8. Maximum self-contained HTML size and fallback behavior.

## End-to-end completion bar

Tin to Cellar is ready for a limited beta when a user can:

1. start with an empty request or tobacco list;
2. reach ChatGPT or Codex with the complete project contract;
3. receive artwork grounded in inspected real packaging;
4. import a conforming pack without an upload;
5. understand provenance and repairable warnings;
6. arrange the sheet without a mouse;
7. calibrate on plain paper;
8. print a physically accurate Avery 94502 sheet;
9. export equivalent PDF/HTML output;
10. complete the workflow without provenance, prompts, tobacco names, or artwork leaving the browser during the website stage.
