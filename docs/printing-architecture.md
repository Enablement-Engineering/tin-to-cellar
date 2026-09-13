# Sheet profiles and the print workflow

CellarPack can describe built-in Letter/A4 full sheets and validated custom sheet profiles. The importer preserves these profiles and checks references as format compatibility; it does not select a printer or change the website's supported stock.

The website supports Avery 94502 only. Its import workflow checks the finished artwork shape and dimensions against that stock. `PrintStudio` selects `AVERY_94502_PROFILE` explicitly, deriving slot choices, pagination, preview proportions, physical page dimensions, and slot positions from that profile. `fixed-layout.ts` supplies the shared pagination and coordinates for preview and production pages.

Browser printing remains configured for Letter portrait with zero margins in `app.css`. Calibration instructions and the two-inch ruler also target Avery stock. Supporting another product requires a deliberate UI and print-style change; importing a custom profile does not enable it automatically.

Artwork geometry stays separate from sheet geometry. `LabelArtwork` preserves the supplied artwork frame, and screen previews clip at the finished circle. Production print CSS reveals up to 1 mm of the supplied bleed beyond the circle, without moving or scaling the artwork. Avery 94502's 3.175 mm horizontal gutters leave 1.175 mm clear between adjacent printed circles. The full supplied 3.175 mm bleed per edge would overlap neighboring designs, so it is not exposed in full. Artwork with less bleed only prints what its image frame supplies.

The extra coverage is automatic and reduces white edges from small printer placement errors. Alignment controls remain available for troubleshooting, rather than a required setup step. Preview coordinates include the calibration offset; the physical print coordinate layer applies that offset once. Calibration circles still mark the exact finished size. No date-writing overlays are added by the website.
