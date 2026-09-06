# Tin to Cellar CellarPack v1

Status: developer-ready planning specification
Proposed media type: `application/vnd.tintocellar.cellarpack+zip`
Recommended extension: `.cellarpack.zip`

## 1. Purpose

A CellarPack is the portable, inspectable handoff between:

1. a ChatGPT/Codex workflow that researches actual tobacco packaging, generates label artwork, and packages metadata; and
2. a browser-local Tin to Cellar print studio that imports, validates, arranges, previews, and prints that artwork.

The format preserves design intent without binding an image to a specific printer sheet. Artwork describes a single finished label surface. Sheet profiles describe how one or more finished labels are imposed on physical paper.

### Goals

- Work without an account, upload, or server-side unpacking.
- Support circles, ovals, squares, rectangles, rounded rectangles, and custom width/height labels.
- Preserve enough geometry for correct clipping, bleed, safe zones, and a writable jarred-date field.
- Record mandatory preliminary research into the actual tin/package and concise visual analysis for every label.
- Allow a generator to emit a pack and a website to render it predictably.
- Be extensible without making v1 importers unsafe or brittle.
- Support Avery 94502, full-sheet sticker paper, other named presets, and custom sheets without putting sheet coordinates into artwork metadata.

### Non-goals

- A layered design/source format such as PSD or SVG editing history.
- A cellar inventory, tasting journal, QR-code system, reminder system, or account synchronization format.
- A promise of exact color matching across uncalibrated home printers.
- Archiving or redistributing third-party reference photography.
- Encoding one precomposed printable page as the canonical content.
- Granting trademark or copyright rights. Producers and users remain responsible for how generated renditions are used.

## 2. Pack versus website responsibilities

| CellarPack owns | Website owns |
|---|---|
| One label's identity and generated artwork | Sheet selection and page imposition |
| Trimmed label shape and finished dimensions | Drag-to-reorder, duplicate, omit, and page breaks |
| Artwork bleed and safe-area intent | Printer calibration, offsets, scaling, and browser print behavior |
| Blank writing surface and measured geometry | Validating safe-area containment and printing the supplied artwork |
| Packaging research, provenance, and visual analysis | Preset registry and display names |
| Optional requested print intent | Resolving named stock to current sheet geometry |
| Optional custom sheet-profile file | Validating whether labels actually fit a selected sheet |
| Asset hashes and contact-sheet preview | PDF/HTML export and final print preview |

The pack MUST NOT bake an Avery page grid into label artwork. A pack MAY request `tin-to-cellar:avery-94502@1`, but the importer resolves that identifier to a separately versioned sheet profile. The same label remains usable on full-sheet stock or another vendor's sheet.

## 3. Archive layout

Required entries are marked **R**; optional entries are **O**.

```text
example.cellarpack.zip
├── manifest.json                         R
├── artwork/                              R
│   ├── escudo-navy-de-luxe.png           R (one referenced asset per label)
│   └── pirate-kake.png                   R
├── preview/
│   ├── contact-sheet.jpg                 O
│   └── escudo-navy-de-luxe.jpg           O
├── sheet-profiles/
│   └── my-custom-sheet.json              O
└── README.txt                            O
```

There is no required standalone `sources.json`: provenance belongs beside each label in `manifest.json`, preventing IDs from becoming detached. V1 MUST NOT embed downloaded tin photographs by default. A future, explicit user-opt-in extension may add private references under `references/`, but v1 importers ignore that directory and generators SHOULD omit it.

## 4. Manifest

`manifest.json` MUST be UTF-8 JSON without comments or duplicate object keys. The root MUST be an object.

### Required root fields

| Field | Type | Rule |
|---|---|---|
| `format` | string | Exactly `tin-to-cellar/cellarpack` |
| `schemaVersion` | string | Semantic version; v1 emitters use `1.0.0` |
| `packId` | string | UUID URN, e.g. `urn:uuid:...` |
| `createdAt` | string | RFC 3339 UTC timestamp |
| `generator` | object | `name` and `version` required; model/workflow optional |
| `labels` | array | 1-100 unique label objects |
| `assets` | object | Map from canonical asset ID to file metadata |

### Optional root fields

- `title`: human-readable pack title, 1-120 characters.
- `description`: plain text, at most 2,000 characters.
- `locale`: BCP 47 tag; default `en-US`.
- `defaultPrintIntent`: a nonbinding sheet/profile request.
- `customSheetProfiles`: references to included profile files.
- `extensions`: namespaced extension object.

### Complete example

```json
{
  "format": "tin-to-cellar/cellarpack",
  "schemaVersion": "1.0.0",
  "packId": "urn:uuid:43649b43-8094-4a32-b5ee-8be75208fb63",
  "createdAt": "2026-08-31T18:10:00Z",
  "title": "Example English Cellar",
  "locale": "en-US",
  "generator": {
    "name": "Tin to Cellar prompt workflow",
    "version": "1.0.0",
    "model": "user-visible model name if known",
    "workflowUrl": "https://example.com/tin-to-cellar/agent"
  },
  "defaultPrintIntent": {
    "sheetProfileId": "tin-to-cellar:avery-94502@1",
    "labelQuantityMode": "one-each"
  },
  "labels": [
    {
      "id": "escudo-navy-de-luxe",
      "maker": "A&C Petersen",
      "blend": "Escudo Navy De Luxe",
      "displayName": "Escudo Navy De Luxe",
      "artworkAssetId": "asset-escudo",
      "surface": {
        "shape": "circle",
        "finishedSize": { "width": 2.5, "height": 2.5, "unit": "in" },
        "bleed": { "top": 0.125, "right": 0.125, "bottom": 0.125, "left": 0.125, "unit": "in" },
        "safeInset": { "top": 0.15, "right": 0.15, "bottom": 0.15, "left": 0.15, "unit": "in" }
      },
      "writeInAreas": [
        {
          "id": "jarred-date",
          "purpose": "jarred-date",
          "geometry": {
            "shape": "rounded-rectangle",
            "x": 0.30,
            "y": 0.74,
            "width": 0.40,
            "height": 0.10,
            "cornerRadius": 0.035
          },
          "background": {
            "integratedInArtwork": true,
            "appearance": "opaque warm cream with low visual texture",
            "minimumContrastWithInk": "high"
          },
          "overlay": {
            "mode": "blank"
          }
        }
      ],
      "research": {
        "status": "complete",
        "observedPackage": {
          "format": "round tin",
          "variant": "cream label with red ESCUDO wordmark and gold/black concentric borders",
          "variantDateOrEdition": "unknown"
        },
        "visualAnalysis": {
          "palette": ["warm cream", "oxblood red", "black", "muted gold"],
          "motifs": ["minimal typographic lid", "small ornamental flourish"],
          "border": "fine concentric black and gold rings",
          "typography": "high-contrast red serif display name; smaller black serif hierarchy",
          "hierarchy": "brand name dominant, blend family second, maker tertiary",
          "style": "restrained heritage European tobacconist"
        },
        "sources": [
          {
            "id": "source-escudo-manufacturer-or-retailer",
            "type": "web",
            "url": "https://example.org/catalog/escudo",
            "title": "Escudo Navy De Luxe product page",
            "publisher": "Example retailer",
            "retrievedAt": "2026-08-31T17:40:00Z",
            "role": "package-appearance",
            "notes": "Front-facing contemporary round-tin image; edition date not stated."
          }
        ],
        "adaptationSummary": "Retains the cream, red, black, and gold hierarchy while fitting the artwork to a circular 2.5-inch label and integrating a blank cream date cartouche."
      }
    }
  ],
  "assets": {
    "asset-escudo": {
      "path": "artwork/escudo-navy-de-luxe.png",
      "mediaType": "image/png",
      "pixelWidth": 1650,
      "pixelHeight": 1650,
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "colorSpace": "sRGB",
      "alpha": true
    }
  }
}
```

## 5. Label identity and canonical IDs

- `label.id`, asset IDs, write-in-area IDs, and source IDs MUST match `[a-z0-9]+(?:-[a-z0-9]+)*` and be unique within their namespace.
- An emitter SHOULD derive a readable label slug from maker and blend, then append `-2`, `-3`, etc. for collisions. IDs are pack-local and MUST NOT be treated as global product identifiers.
- `maker` and `blend` are required nonempty plain-text strings. `displayName` is optional and defaults to `blend`.
- HTML, Markdown, script, and control characters are not interpreted. Importers MUST render all strings as text.

## 6. Surface and geometry model

### Finished label surface

`surface.shape` accepts:

- `circle`: width MUST equal height.
- `oval`: width and height MAY differ.
- `square`: width MUST equal height.
- `rectangle`: any positive width and height.
- `rounded-rectangle`: any positive dimensions plus optional `cornerRadius` in the same unit.
- `custom`: any positive width and height. In v1, `custom` means a custom-sized rectangular bounding box with an optional clipping path extension; baseline importers MAY fall back to `rectangle` if they do not support that extension.

Recommended units are inches (`in`); millimeters (`mm`) are allowed. Importers MUST convert dimensions, not infer them from DPI.

`finishedSize` describes the die-cut/trimmed surface. Bleed lies outside it. `safeInset` lies inside it. Neither is a printer-sheet margin.

### Normalized coordinate system

All writing-region coordinates use normalized coordinates relative to the **finished trim bounding box**, not the bleed canvas:

- origin `(0,0)` is the trim box's upper-left;
- `(1,1)` is its lower-right;
- `x`, `y`, `width`, and `height` are numbers from 0 through 1;
- `rotationDegrees` may be omitted or set to 0; writing regions MUST be unrotated;
- `cornerRadius` is normalized to the trim-box width;
- a region MUST remain inside the safe area of the actual trimmed shape, not merely its bounding box.

For circles and ovals, importers validate each region corner after applying corner radius against the ellipse. Emitters SHOULD retain at least 0.03 normalized clearance from the trim boundary in addition to the declared safe inset.

Writing regions support rectangles, rounded rectangles, and ovals.

## 7. Artwork asset requirements

### Required baseline

- PNG (`image/png`) is REQUIRED for conformance and MUST be supported by importers.
- JPEG (`image/jpeg`) MAY be supported for fully opaque art, but generators SHOULD emit PNG.
- Every `labels[].artworkAssetId` MUST resolve to exactly one `assets` entry whose normalized path is beneath `artwork/`; unused artwork is allowed only with a warning.
- The image canvas MUST cover the trim size plus declared bleed on all sides.
- The asset aspect ratio MUST match `(finished width + left/right bleed) / (finished height + top/bottom bleed)` within 0.5%.
- Minimum effective resolution: 300 pixels per finished inch. Recommended generation/export: 600 pixels per finished inch, including bleed. Maximum accepted dimension: 8192 pixels on either axis.
- `colorSpace` MUST be `sRGB` for v1. ICC profiles other than sRGB are nonconforming and produce a warning or rejection depending on whether deterministic conversion is available.
- 8-bit RGB/RGBA is the baseline. CMYK, indexed-color, grayscale-only, 16-bit, animated, SVG, WebP, HEIC, PSD, and PDF artwork are rejected in v1.
- Alpha is permitted. Pixels inside the finished shape SHOULD be fully opaque. Pixels outside the intended cut line MAY be opaque bleed; transparent corners are allowed for nonrectangular labels. The importer composites against white for print preview unless the user chooses otherwise.
- Text critical to product recognition SHOULD be rasterized into the art at legible size. The website prints that text as part of the artwork.

### Shape-adapted rendition requirement

Each image is intended to be a recognizable, faithful, shape-adapted rendition of the observed package: palette, prominent motifs, border language, typographic character/hierarchy, and overall style should track the researched packaging. Exact source-image pixels are neither required nor desirable. The blank date-writing surface MUST appear integrated into the art rather than looking like an unrelated UI control.

The generator SHOULD avoid placing critical names, motifs, or fine borders in the bleed or outside the safe zone.

## 8. Jarred-date writing surface

Every v1 generator-conformant label MUST contain exactly one `writeInAreas` entry with `purpose: "jarred-date"`.

The **artwork** includes a light, low-detail, visually integrated blank surface large enough for handwriting. The **website** prints the supplied artwork without adding words, lines, or dates. The writing surface belongs entirely to the artwork.

Required write-in fields:

- `id`
- `purpose` (`jarred-date` in v1)
- `geometry`
- `background.integratedInArtwork` (MUST be `true` for generator conformance)
- `overlay.mode` MUST be `blank`. The overlay object contains only `mode`; additional overlay fields are invalid.

Recommended defaults:

- width at least 0.32 of trim width;
- height at least 0.09 of trim height;
- y-position around 0.70-0.78, adjusted to remain inside curved edges;
- opaque warm white/cream background with minimal texture;
- at least 4.5:1 practical contrast for dark handwriting;
- no baked-in word `JARRED` or baked-in date line.

Importers MUST show a visible repair warning if the field is missing, intersects the trim boundary, or the artwork does not appear to contain an appropriate light surface. Geometry can be validated deterministically; visual suitability can only be advisory. Correct an unsuitable writing surface in the artwork and update its measured geometry before returning the pack.

## 9. Mandatory research and provenance

Every label MUST contain a `research` object. This requirement protects fidelity and makes generation auditable without redistributing reference images.

### Required fields

- `status`: `complete` or `limited`. `complete` is required for full generator conformance.
- `observedPackage.format`: e.g. round tin, rectangular tin, pouch, bulk label.
- `observedPackage.variant`: concise description that distinguishes the observed packaging.
- `observedPackage.variantDateOrEdition`: a known value or literal `unknown`.
- `visualAnalysis.palette`: nonempty array.
- `visualAnalysis.motifs`: array; may be empty only when explicitly minimal.
- `visualAnalysis.border`, `typography`, `hierarchy`, and `style`: concise plain text.
- `sources`: at least one source record.
- `adaptationSummary`: explains what was retained and how shape/date-area constraints changed the rendition.

### Source fields

Each source requires `id`, `type`, `role`, and enough locator metadata for its type:

- `type: "web"` requires `url`, `title`, and `retrievedAt`. `publisher` and `notes` are recommended.
- `type: "user-provided"` requires `description` and `receivedAt`; `originalFilename` is optional and SHOULD be reduced to a basename with personal names removed.
- `role` is one of `package-appearance`, `variant-identification`, `historical-context`, or `user-inspiration`.

At least one source SHOULD have role `package-appearance` and depict the actual product packaging. A user's inspiration-only image is not sufficient for `complete` status. If no reliable actual-package source can be found, the generator records `status: "limited"`, explains the gap in `limitations`, and SHOULD ask the user for a photo rather than inventing fidelity.

### Privacy and copyright-safe defaults

- Store URLs, source titles, retrieval timestamps, concise observations, and optional non-sensitive filenames—not copied page text or third-party images.
- Strip URL fragments and known tracking parameters. Preserve query parameters only when needed to identify the source.
- Never store local absolute paths, chat IDs, account identifiers, EXIF/GPS data, cookies, signed URLs, or authorization tokens.
- Do not embed uploaded inspiration photos unless the user explicitly requests a future private-reference extension.
- The contact sheet contains generated outputs only.
- A website importer SHOULD expose provenance for inspection but MUST NOT fetch source URLs automatically. Opening a source is an explicit user action.

## 10. Preview assets

- `preview/contact-sheet.jpg` is optional but recommended for human inspection. It is never a print source.
- Per-label thumbnails are optional. Recommended maximum is 512 px on the long edge.
- Preview files MUST be listed in `assets` only if referenced by manifest metadata; otherwise safe importers may ignore them.
- A missing or corrupt preview does not invalidate an otherwise valid pack.
- Contact sheets MUST contain generated label art only, with blend/maker captions if desired, and MUST NOT contain embedded third-party research images.

## 11. Sheet profiles and print intent

Sheet profiles are separate from labels. A profile describes paper and repeated cut positions in physical units.

### Named presets

The website maintains a versioned registry. Recommended IDs:

- `tin-to-cellar:avery-94502@1` — 2.5-inch circles, 9-up on US Letter.
- `tin-to-cellar:full-sheet-letter@1` — US Letter full-sheet adhesive stock; website computes a grid from label size, margins, and spacing.
- `tin-to-cellar:full-sheet-a4@1` — A4 equivalent.
- vendor profiles follow `vendor:product-code@revision`.

The product code is descriptive interoperability metadata, not an endorsement. Registry entries MUST be empirically test-printable and versioned when geometry changes.

### Custom profiles

A custom profile MAY be included under `sheet-profiles/` and referenced from `customSheetProfiles`. It contains:

```json
{
  "format": "tin-to-cellar/sheet-profile",
  "schemaVersion": "1.0.0",
  "id": "custom:example-2.5-circle-sheet@1",
  "page": { "width": 8.5, "height": 11, "unit": "in" },
  "slots": [
    { "x": 0.5, "y": 0.625, "width": 2.5, "height": 2.5, "shape": "circle", "rotationDegrees": 0 }
  ],
  "calibration": { "xOffset": 0, "yOffset": 0, "scale": 1 }
}
```

All slot positions are physical page coordinates from the page's upper-left. The website MUST validate page bounds and label/slot compatibility. `calibration` values included in a shared pack SHOULD remain neutral; user/printer-specific corrections belong in local website settings.

`defaultPrintIntent` is a hint. If unavailable or incompatible, the importer asks the user to choose another profile; it never scales art silently to force a fit.

## 12. Versioning and compatibility

- `schemaVersion` follows SemVer.
- Major changes may break parsing or semantics. An importer supporting major 1 MUST reject major 2 with `UNSUPPORTED_SCHEMA_MAJOR`.
- Minor changes only add optional fields or enum values with documented fallback. Importers MUST ignore unknown object properties and preserve them on lossless re-export when feasible.
- Patch changes clarify validation and do not alter document shape.
- Required fields are never added in a minor version.
- Unknown enum values in optional features produce a warning and feature fallback. Unknown values in required geometry or asset fields are fatal for that label.
- `extensions` keys MUST be reverse-DNS or URL-like namespaces, for example `engineering.enablement.tintocellar/foo`. Importers ignore unknown extensions.
- A pack can be partially usable: invalid labels are quarantined while valid labels remain importable, unless the root manifest/archive itself is unsafe.

## 13. Conformance levels

Three labels keep responsibilities honest:

1. **Archive Conformant**: safe ZIP, valid root manifest, supported schema major, valid hashes and assets.
2. **Generator Conformant**: Archive Conformant plus full research/provenance, shape-adapted art, required integrated jarred-date surface, 300+ PPI, sRGB, and contact sheet recommended.
3. **Print Ready**: Generator Conformant plus all labels fit the selected sheet profile at 100% scale and pass the website's safe-area checks. This status is profile- and calibration-dependent and therefore determined by the website, not asserted permanently by the pack.

## 14. Deterministic validation and security

The browser importer validates before decoding or displaying assets.

### ZIP rules

- Accept ZIP only; reject encrypted archives, multipart archives, nested archives, executables, symlinks, hard links, devices, and absolute paths.
- Normalize names as UTF-8 NFC with `/` separators. Reject `..`, `.`, empty segments, leading `/`, backslashes, drive prefixes, NULs, control characters, and names over 240 bytes.
- Reject duplicate names after Unicode normalization and case folding, even on case-sensitive systems.
- Reject duplicate `manifest.json`; it MUST be at archive root.
- Maximum: 500 entries, 100 labels, 200 MiB total uncompressed, 80 MiB per artwork asset, 50 MiB compressed archive, path depth 6, and decompression ratio 100:1 per entry or total. Recommended website UX warns before importing above 25 MiB.
- Stream hashing/decompression where available. Never extract to a filesystem path; use in-memory/blob APIs and object URLs, revoking them when the project closes.

### File validation

- Enforce actual decompressed byte limits while streaming entries; central-directory size declarations alone are not sufficient. Stop inflation as soon as an entry or cumulative budget is exceeded.
- Do not trust extensions or manifest media types. Verify PNG/JPEG magic bytes and decode bounds before full allocation.
- Reject polyglot or malformed images when the browser decoder or independent header parser disagrees with declared dimensions.
- Recompute SHA-256 and compare with manifest before use.
- Apply pixel-count limit of 64 megapixels per image and 250 megapixels per pack.
- JSON maximum 2 MiB for manifest, 256 KiB per sheet profile, depth 32, and no duplicate keys.
- Render strings through text nodes; never `innerHTML`. Do not evaluate scripts, CSS, SVG, HTML, fonts, or external resources from a pack.
- Do not make network requests during import. Source URLs appear only as inert text until explicit user action.

### Error model

Each issue has:

```json
{
  "severity": "fatal|error|warning|info",
  "code": "ASSET_HASH_MISMATCH",
  "path": "assets.asset-escudo.sha256",
  "labelId": "escudo-navy-de-luxe",
  "message": "Artwork hash does not match the manifest.",
  "recovery": "Regenerate or repackage this label."
}
```

Recommended stable codes:

- Fatal pack: `UNSAFE_ZIP_PATH`, `ZIP_LIMIT_EXCEEDED`, `DUPLICATE_ENTRY`, `MISSING_MANIFEST`, `INVALID_MANIFEST_JSON`, `UNSUPPORTED_SCHEMA_MAJOR`.
- Label-blocking: `MISSING_ARTWORK`, `ASSET_HASH_MISMATCH`, `UNSUPPORTED_IMAGE_TYPE`, `IMAGE_DIMENSION_MISMATCH`, `INVALID_SURFACE_GEOMETRY`, `WRITE_AREA_OUTSIDE_TRIM`, `MISSING_REQUIRED_RESEARCH`.
- Warning/recoverable: `LOW_EFFECTIVE_PPI`, `LIMITED_RESEARCH`, `UNKNOWN_PRINT_PRESET`, `MISSING_PREVIEW`, `UNKNOWN_OPTIONAL_FIELD`, `WRITE_SURFACE_VISUAL_REVIEW_NEEDED`, `PROFILE_LABEL_MISMATCH`.

The importer MUST present fatal errors before creating a project. Label-blocking errors quarantine only affected labels. Warnings are visible and do not prevent preview/printing unless the user enables a strict mode.

## 15. Generator-to-importer seam

### ChatGPT/Codex generator must

1. Resolve maker/blend identity and research the actual package before art generation.
2. Record observed variant and visual analysis, citing actual-package sources.
3. Ask for target label shape/size and any inspiration images when absent.
4. Generate bleed-aware, shape-adapted sRGB PNG art with a light integrated write-in surface.
5. Keep small `JARRED` typography/date line out of raster art.
6. Measure the surface and emit normalized metadata.
7. Compute dimensions and SHA-256 hashes, create the manifest, then validate before zipping.
8. Return the ZIP plus a short human-readable summary of any limited research or assumptions.

A paste-only ChatGPT workflow may be unable to produce a correctly hashed ZIP in every client. In that case it SHOULD return an unpacked folder/file set or individual assets plus manifest and explicitly say it is **not validated**. The website MAY offer a guided loose-file importer that constructs a local pack, but MUST not mislabel it Generator Conformant until validation succeeds. Codex or a dedicated packager is the preferred deterministic path.

### Browser-local importer must

1. Validate archive safety before parsing content.
2. Parse and validate manifest/schema without network access.
3. Verify all referenced assets and quarantine invalid labels.
4. Show provenance and research limitations.
5. Resolve requested sheet profile or ask the user to choose one.
6. Render label art clipped to trim shape. Add no words, lines, or dates.
7. Let the user reorder, duplicate, crop/zoom only within declared bleed, and calibrate printing.
8. Print at 100% physical scale unless the user explicitly chooses scaling.

## 16. Recommended v1 defaults

- PNG, 600 PPI target, 300 PPI minimum, sRGB, 1/8-inch bleed.
- Safe inset: 0.15 inch for a 2.5-inch label, proportional for other sizes with a minimum of 5% of the shorter dimension.
- Required integrated blank date-writing surface; the website adds no overlay.
- Normalized coordinates relative to finished trim box.
- Avery 94502 as the initial named cut-sheet profile; US Letter and A4 full-sheet modes next.
- Browser-local import, processing, and persistence by default; no telemetry or uploads without opt-in.
- Mandatory source URLs/metadata and visual-analysis summary; no embedded third-party package images.
- Partial import for label-specific failures; all-or-nothing rejection for archive safety failures.

## 17. Open decisions before freezing 1.0

1. **Custom shape semantics.** Recommended v1 default: custom-sized rectangular bounding box only; defer arbitrary vector cut paths to v1.1 or v2 because SVG/path parsing expands security and print complexity.
2. **JPEG acceptance.** Recommended: import JPEG with warnings but require PNG for Generator Conformance.
3. **Exact full-sheet auto-layout rules.** Recommended: website-owned algorithm with user-controlled margins/gutters; keep it out of CellarPack v1.
4. **Pack delivery.** Import requires a conforming `.cellarpack.zip`. Loose artwork must be packaged before import.
5. **Source availability.** Recommended: permit `limited` status with an explicit limitation rather than blocking all artwork when a historical/discontinued tin lacks a reliable online image.
6. **Trademark/copyright notice.** Recommended: a concise metadata/website notice stating that source links document research and generated labels are intended for personal cellar organization; do not make legal clearance a schema field.
7. **Pack signing.** Recommended: defer cryptographic signatures. SHA-256 establishes integrity within a pack, not publisher identity.

## 18. Acceptance criteria for the specification implementation

- A pack with circular, oval, square, rectangle, rounded-rectangle, and custom-dimension labels validates without sheet-specific artwork changes.
- The same label imports into Avery 94502 and full-sheet Letter layouts.
- A custom profile can be included and selected without changing `labels[].surface`.
- Every generator-conformant label records actual-package research and a source-backed visual analysis.
- Every label's blank writing surface is measured from the finished trim box, unrotated, and contained in the safe area. The website adds no words, lines, or dates.
- Unsafe paths, duplicate normalized filenames, decompression bombs, MIME spoofing, dimension bombs, and hash mismatches are rejected deterministically.
- An importer can ignore unknown optional fields from a newer 1.x pack.
- No network request or third-party image redistribution is required to import, preview, arrange, or print a pack.
