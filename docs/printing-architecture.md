# Printing architecture

CellarPack can describe built-in Letter/A4 full sheets and validated custom sheet profiles. The importer preserves these profiles and checks references as format compatibility; it does not select a printer or enable an unsupported print layout.

The website supports Avery 94502 on US Letter and twelve 63.5 mm circles on A4 using OnlineLabels EU30023 / Label Planet LP12/64R geometry. `PRINT_SHEET_PROFILES` is the explicit print allowlist. Both require the same finished 63.5 mm / 2.5-inch circular artwork; importing and saved-collection validation use `checkSupportedArtworkCompatibility`.

`PrintStudio` resolves the selected profile from local print settings and derives slot choices, pagination, preview proportions, physical page dimensions and slot positions from it. `fixed-layout.ts` supplies the shared pagination and coordinates for preview and production pages. The component supplies an explicit `@page` size from this trusted profile for both the print button and browser-initiated printing. Print at Actual Size / 100%, with matching paper size, no margins and headers/footers off.

Saved collections without `sheetProfileId` use Avery 94502. Switching stock resets page, starting slot and offsets. Stored offsets remain in inches; A4 controls and preview positions convert them to millimetres, while the production coordinate layer applies the stored inch offset once. The calibration ruler is 50 mm for A4 and two inches for Letter. Unknown IDs and unsupported full-sheet/custom profiles are rejected by saved-collection validation. Exported packs record the selected profile as nonbinding print intent.

Artwork geometry stays separate from sheet geometry. `LabelArtwork` preserves the supplied artwork frame, and screen previews clip at the finished circle. Production print CSS reveals up to 1 mm of supplied bleed beyond the circle, without moving or scaling the artwork. Avery 94502's 3.175 mm horizontal gutters leave 1.175 mm clear between adjacent printed circles; A4's 4.5 mm gutters leave 2.5 mm. The full supplied 3.175 mm bleed per edge would overlap neighbouring designs, so it is not exposed in full. Artwork with less bleed only prints what its image frame supplies.

See [A4 implementation and validation](a4-printing-plan.md) for manufacturer sources, compatibility details and deferred layouts.
