---
name: update-tobacco-catalog
description: Research new pipe-tobacco releases and update Tin to Cellar's names-only autocomplete catalog. Use when asked to refresh the catalog, add newly released blends, or reconcile names from manufacturer and retailer sources with the existing catalog. Preserves provenance, historical entries, and reviewed deduplication.
---

# Update the tobacco catalog

Work from the repository root. Follow its AGENTS.md and use npm for JavaScript commands. This maintains autocomplete names; it does not generate label artwork or CellarPacks.

## Establish the baseline

1. Read `data/catalog/README.md`, `scripts/catalog/merge.mjs`, `scripts/catalog/normalize.mjs`, and `data/catalog/overrides.json` before editing.
2. Inspect `git status --short`. Preserve unrelated edits. Save the current catalog identities and counts outside the source directory so additions, removals, and renames can be compared after rebuilding.
3. Use the user's release window if supplied. Otherwise inspect the latest collection dates and research releases since the last documented collection, including newly discovered omissions. State the window used. A source's `reviewedAt` is a verification date, not a release date.

## Research candidates

Browse live sources. Start with manufacturer announcements and product catalogs, then official distributors and established retailers. `data/catalog/README.md` lists the sources already collected and their limitations.

- Open the supporting page; do not turn an unverified search snippet into a catalog entry.
- Confirm the maker or marketed brand and exact blend name. Store a direct supporting URL.
- Distinguish a new blend or named edition from a restock, new package size, or packaging redesign. Retain meaningful edition names and years when evidence distinguishes them.
- Record announcement/release dates only when supported, and distinguish announced products from released products in the research notes. Undated listings may establish a name, but not a new-release claim.
- Historical directories and regulatory records can establish identities; they do not establish current availability or release dates.
- If a source is blocked or unavailable, use another public source and record the gap. Do not bypass challenges or infer missing names.
- Do not collect artwork, reviews, descriptions, prices, or stock feeds. The app remains a local names catalog with no runtime source fetching.

## Save evidence incrementally

Add verified records to `data/catalog/sources/new-releases-YYYY-MM-DD.json`, using the actual collection date. Use a JSON array with these fields:

| Field | Content |
| --- | --- |
| `maker` | Verified maker or marketed brand |
| `blend` | Blend name, excluding retail package weight |
| `sourceUrl` | Direct HTTPS page supporting this identity |
| `reviewedAt` | Actual verification date, `YYYY-MM-DD` |
| `rawName` | Original product title, preserving source wording |
| `aliases` | Optional array of verified alternative names |

If today's file exists, merge into it without repeating an identical maker/blend/source URL record. Preserve original source snapshots and historical entries. Do not delete a blend because it is discontinued, unavailable, or absent from a refreshed listing.

Save a short dated research note in `data/catalog/reports/new-releases-YYYY-MM-DD.md`: search window, sources checked, evidence for release dates, confirmed candidates, unresolved candidates, and access gaps. Keep unverified candidates in the note, outside source arrays consumed by the merge.

Existing `scripts/catalog/collect-*.mjs` collectors are optional for broader refreshes. Inspect their behavior first: they replace source files and may yield partial results. Preserve previous records and reconcile omissions before accepting collector output. Do not run every collector for an incremental update.

## Resolve identities

Use the existing normalization and exact maker-plus-blend identity. Fuzzy autocomplete matches are discovery aids, not evidence that two entries are identical.

- Compare against `data/catalog/catalog.json` and existing aliases before adding a candidate.
- Never merge on blend name alone or automatically merge historical brand changes such as Dunhill and Peterson.
- Check retailer vendor fields against the product title and primary source; the vendor may be the retailer rather than the blend's brand.
- Merge packaging variants, but preserve meaningful product codes and named editions. Do not strip years indiscriminately.
- For a verified identity correction, follow the existing schema in `data/catalog/overrides.json` and provide a specific reason supported in the research note. Preserve useful original names as aliases.
- Do not introduce broad normalization rules for one ambiguous listing. Unresolved identities stay out of the runtime catalog.

## Rebuild and verify

Never hand-edit either generated catalog. Run:

```sh
npm exec -- node scripts/catalog/merge.mjs
npm test
npm run build
npm run lint
git diff --check
```

The merge writes:

- `data/catalog/catalog.json`: complete entries and contributing sources.
- `src/lib/tobacco-catalog/catalog.json`: runtime names and aliases.
- `data/catalog/reports/merge.json`: counts and individual merge, correction, and exclusion decisions.

Compare identities against the saved baseline; report additions, removals, and changed identities separately, not just the net count. Investigate every removal and review all new exclusions or corrections. Verify that each new entry has supporting provenance and that the runtime copy matches the canonical catalog with `sources` omitted. The merge keeps the first source's display fields; inspect `sources` for later verification dates rather than assuming the top-level date is the latest.

Check representative new names and aliases with the existing matcher tests. If changing normalization, add focused tests for the observed ambiguity and ensure distinct makers or editions remain distinct. Update current count summaries when needed, while preserving dated historical results as historical.

If no new names are verified, report that result without manufacturing catalog changes. Report actual additions, duplicates, unresolved evidence, and validation results. Do not claim complete market coverage. Commit, publish, or schedule future refreshes only when requested.
