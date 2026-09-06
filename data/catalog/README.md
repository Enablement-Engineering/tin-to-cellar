# Pipe tobacco name collection

The app's autocomplete catalog is built from the name records in `sources/`. The 2026-09-05 merge contains **1,482 distinct entries across 146 maker/brand names**, from 2,913 input records. It merged 1,409 duplicate records, excluded 22 unsuitable/unresolved records, and applied 222 reviewed corrections across source rows. It includes both retail and historical listings. Inclusion does not establish current stock, current production, or which package edition a user owns.

## Best resources found

| Resource | Best use | Result in this collection |
| --- | --- | --- |
| [4noggins](https://4noggins.com/collections/tinned-tobacco) | Broad retail and historical consignment coverage | Public storefront records include explicit product titles, but vendor fields sometimes name the retailer. Title-based corrections are recorded. |
| [Tobacco Reviews](https://www.tobaccoreviews.com/advanced-search/) | Broad discovery, including discontinued blends | Search page reported 8,580 blends and the brand directory 667 brands. Direct collection and pagination returned challenges/403 responses. No bulk dataset was obtained. |
| [Mac Baren](https://mac-baren.com/pipe-tobacco/) and [Cornell & Diehl](https://www.cornellanddiehl.com/pipe-tobaccos/) | Manufacturer identities and named product lines | Names-only manufacturer records retained. |
| [Laudisi](https://www.laudisi.com/gl-pease-pipe-tobaccos.cfm/original-mixtures-203) | Distributor catalogs covering multiple blending houses | Available pages plus the earlier verified seed retained; later requests returned HTTP 503. |
| [WV SmokeShop](https://wvsmokeshop.com/) and [GQ Tobaccos](https://www.gqtobaccos.com/pipe-tobacco/) | Bulk, regional, and house-blend coverage | Product names retained, package variants merged. |
| [FDA marketing orders](https://www.fda.gov/tobacco-products/substantial-equivalence/marketing-orders-se) | Additional factual manufacturer/product names | Explicit pipe-tobacco records retained. Regulatory listings are not a stock feed. |

No broad, reusable licensed names dataset was found in the public GitHub search. No review text, descriptions, prices, or image assets are distributed here. Names and source URLs are factual identification records; these websites do not provide a blanket license for their other content.

## Saved outputs

- `catalog.json`: merged maker/blend entries with all contributing source references.
- `sources/*.json`: collected name records before cross-source merging. Some source collectors already collapse exact duplicates or package weights.
- `overrides.json`: individually reviewed identity corrections, with reasons.
- `reports/merge.json`: input, output, merge, exclusion, and correction counts plus individual decisions.
- `../../src/lib/tobacco-catalog/catalog.json`: compact runtime copy with no automatic source fetching.

## Deduplication

The merge normalizes Unicode accents, punctuation, whitespace, capitalization, and reviewed maker aliases. Retail package weights and suffixes are removed. The canonical key contains both maker and blend; a shared blend name alone is not enough to merge two records. Explicit reviewed mappings handle product codes and repeated prefixes. Original source names remain in provenance.

Samplers, accessories, snuff, and names without an established maker are excluded from runtime suggestions and recorded in the report. Historic maker changes are not merged automatically. Ambiguous edition years are retained. Search uses fuzzy matching, but catalog deduplication does not: a near match is not evidence of the same blend.

## Refresh

For incremental new-release updates, use the repo skill [`update-tobacco-catalog`](../../.agents/skills/update-tobacco-catalog/SKILL.md), or ask Codex to `Use $update-tobacco-catalog to check for new releases`. It preserves existing records, saves source evidence, and rebuilds the deduplicated catalog.

For a broader collection refresh, inspect the collectors before running them: they replace their source files and can return partial results. Preserve existing records and reconcile omissions before accepting refreshed output.

Run the collectors with npm, then rebuild from saved source records:

```sh
npm exec -- node scripts/catalog/collect-4noggins.mjs
npm exec -- node scripts/catalog/collect-gq.mjs
npm exec -- node scripts/catalog/collect-retailer-names.mjs
npm exec -- node scripts/catalog/merge.mjs
npm test
npm run build
npm run lint
```

Network collectors are optional maintenance commands; the application never invokes them. Manufacturer/FDA extractions include provenance in `source-assessment-manufacturers.json`; these files require manual source review when refreshed. Do not bypass access challenges or substitute inaccessible pages with inferred names.
