# A4 label printing

## Scope and implementation plan

Add A4 sheets with twelve 63.5 mm circles alongside Avery 94502 on US Letter. Reuse existing 2.5-inch artwork at its original physical size. Do not change the artwork, integrated writing area, gallery publications, hosted services or database schema.

1. Register a versioned fixed-slot A4 profile using manufacturer dimensions.
2. Add a visible paper selector and save its profile ID in the local collection. Older collections without an ID continue to use Letter. Reject unknown and unsupported print profiles.
3. Derive pagination, first-slot limits, preview and print dimensions from the selected profile. Reset the starting slot, preview page and calibration when changing stock.
4. Retain inches as the stored calibration unit for compatibility. Convert to millimetres for A4 controls and preview coordinates. Use a 50 mm A4 calibration ruler and a two-inch Letter ruler.
5. Update paper guidance, new request print preferences and exported pack print intent. Keep the same 63.5 mm artwork validation for both stocks.
6. Verify unit tests, saved-settings reload, keyboard access, narrow layouts, accessibility, actual PDF dimensions, pagination, artwork size, bleed and the existing Letter path.

## Verified stock geometry

Sources checked 2026-09-20:

- [OnlineLabels EU30023](https://uk.onlinelabels.com/products/eu30023)
- [Label Planet round-label layout guide](https://www.labelplanet.co.uk/downloads/guide-printing-round-labels-oval-labels.pdf)
- [Label Planet LP12/64R removable matte white paper](https://www.labelplanet.co.uk/removable-labels-white-paper/lp12-64r-rem/)

Both layouts have a 210 × 297 mm page, 63.5 mm circles, three columns, four rows, 68 mm pitch in each direction, 5.25 mm side margins and 14.75 mm top/bottom margins. Slot origins are x = 5.25, 73.25, 141.25 mm and y = 14.75, 82.75, 150.75, 218.75 mm. The profile ID is `tin-to-cellar:a4-63.5-circle-12@1`.

The 4.5 mm gaps allow the existing 1 mm exposed artwork bleed on each side, leaving 2.5 mm clear. Exposing the complete 3.175 mm supplied bleed would overlap neighbouring labels, so the existing clipping policy remains.

Product code and layout must match. A4 alone does not identify the label positions. The material must match the user's inkjet or laser printer; country delivery and handwriting suitability need checking before purchase. A plain-paper alignment test and a physical sticker test remain necessary for printer acceptance.

## Compatibility and deferred work

`sheetProfileId` is optional in existing version-1 local collections. Missing means the previous Letter default; invalid IDs are rejected. Older app builds cannot validate a saved A4 first slot above nine. A rollback should retain support for reading these settings or explicitly migrate the first-slot setting before removing A4 support. No artwork migration is required.

Imported pack print intent remains nonbinding and never switches the selected paper automatically. A new handoff uses the selected paper; an already saved handoff remains frozen. Protocol 0.0.33 updates paper guidance for new chats while preserving earlier releases. The website's paper selector controls printing, and artwork geometry is unchanged.

Full-sheet A4, arbitrary imported layouts, 60 mm labels and artwork resizing are deferred. This implementation deliberately supports only the two listed fixed layouts.

## Validation record

Local validation completed 2026-09-20 on `codex/a4-label-sheets`, based on `7c3f8b31f81508f49b46a9d43b0358b0373e5f99`.

| Check | Result |
| --- | --- |
| `npm run test -- --maxWorkers=2` | 850 tests passed across 102 files. Earlier broad runs encountered worker-start and asynchronous timeouts; the final reduced-concurrency run was clean. |
| `npm run build` | Passed TypeScript checks and production build. Existing large-chunk advisory remains. |
| `npm run lint` and `git diff --check` | Passed. |
| Protocol history against the base commit | All 32 earlier releases unchanged. New local source revision is 0.0.33. |
| Browser regression selection | 45 cases passed in the full run; the remaining ZIP keyboard case passed after updating its expected tab stops for the two new supplier links. All 46 selected cases are covered. |
| A4 print test | Saved paper, slot 12 and ±2.54 mm offsets survive reload. Two A4 PDF pages, blank starting slot, overflow page, twelve-slot layout, 63.5 mm trim, unchanged artwork frame, 1 mm bleed and clear gutters verified. |
| Calibration and switching back | A4 50 mm ruler and offset positions checked; one calibration PDF page; switching to Letter resets alignment and produces Letter PDF dimensions. |
| UI and accessibility | Desktop and 375 px A4 screenshots inspected; no detected A4 workspace axe violations or horizontal overflow. Broader route/paper-guidance checks include 320 px. Keyboard focus reaches the paper selector; native popup selection is exercised through Playwright, not a native assistive-technology session. |

Commands for the browser selection: `npx playwright test app.pw.ts import-quality.pw.ts print.pw.ts instructions-recovery.pw.ts --workers=1`, then the focused ZIP keyboard case. The `print.pw.ts` filter also selects `a4-print.pw.ts`, including in the existing CI browser job.

Local PDF and image evidence is retained under ignored `output/a4-validation/`. Red circles are synthetic test artwork; the calibration PDF includes deliberate test offsets. These artifacts are verification fixtures, not user-ready label packs.

This record describes local implementation validation before release. The release PR records CI, deployment and public endpoint evidence separately. No physical sticker print was performed; physical printer alignment remains unverified.
