# Distributor and retailer name collection

Reviewed 2026-09-05. These files retain product-name facts and source URLs, not images, descriptions, prices, reviews, stock claims, or current-production assertions. Multiple package sizes can yield rows with the same maker/blend and different product URLs; the merge step should preserve source provenance while deduplicating those names.

- `laudisi.json`: public Laudisi distributor product headings. The first pass retrieved Briarworks, Captain Earle's and Charatan; subsequent categories returned HTTP 503. They were recorded as failures, not bypassed. `laudisi-provenance.json` records every attempted category.
- `wvsmokeshop.json`: public WV SmokeShop brand and linked subcategory product headings. Brand names come from the category. Package-weight suffixes and matching maker prefixes are removed conservatively; remaining retailer spelling variants should be normalized by the merge. `wvsmokeshop-provenance.json` records coverage and failures.
- `verified-extra-seed.json`: 163 names verified earlier on public distributor/retailer pages in this session: G. L. Pease 47, Peterson 21, Samuel Gawith 33, Gawith Hoggarth & Co. 58, Capstan 2, Orlik 1, A&C Petersen 1. This supplies coverage absent from the later Laudisi HTTP collection. Source URLs and review dates are attached to every row. Package-size duplicates removed; named cut variants retained, burnt-end package formats omitted. The Smokingpipes entries were verified through indexed product-page text; direct-fetch challenges were not bypassed.

Run from the repository root:

```sh
npm exec -- node scripts/catalog/collect-retailer-names.mjs laudisi
npm exec -- node scripts/catalog/collect-retailer-names.mjs wvsmokeshop
```

The collector fetches public HTML sequentially, does not execute page scripts or request image assets, and stops after three consecutive failures. It does not log in, use cookies, solve challenges, or bypass access restrictions. An optional `--expand` pass revisits previously empty category pages and follows their explicit child-category links. Files ending in `-provenance.json` are metadata objects, not blend arrays.

Limitations: this is a collection of accessible listings, not a popularity ranking or a complete historical catalog. Provider inventory changes. Retailer naming sometimes shortens a blend name or uses a legacy maker. Further normalization should retain the original source URLs and avoid merging distinct editions or cuts merely because their names overlap.

Final collected counts for this run: Laudisi 30 product URLs / 22 exact maker-blend pairs / 3 makers; WV SmokeShop 588 product URLs / 267 exact maker-blend pairs / 48 makers; verified extra seed 163 names / 7 makers. These counts overlap across sources. WV retailer names retain internal identifiers such as `Lane #102 1Q` and `Stokkebye #PS-17 English Luxury`, plus some residual `Bulk` suffixes; they are intentionally not silently merged here. The collector is bounded to 300 category pages on future runs.
