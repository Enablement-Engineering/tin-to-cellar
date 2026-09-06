# Tobacco names catalog

1,482 entries across 146 maker/brand names, reviewed on 2026-09-05. This is a starter selection, not a popularity ranking, complete market inventory, or stock feed. The application accepts arbitrary names and optional empty requests.

Only factual maker/blend names, aliases, source URLs, and review dates are stored. No package photographs, generated artwork, descriptions, prices, or reviews are included. Source URLs are provenance data and are not fetched when searching or selecting. The full [source assessment and maintenance workflow](../../../data/catalog/README.md), raw records, merged provenance, and deduplication report are saved in data/catalog. Run scripts/catalog/merge.mjs to rebuild this runtime file; do not edit it directly.

Sources:

- 4noggins public bulk, tinned, and consignment catalogs.
- Mac Baren official catalogs and FDA pipe-tobacco product-name records.
- GQ Tobaccos regional retail listings.

- Cornell & Diehl's manufacturer catalog, all 13 pages: https://www.cornellanddiehl.com/pipe-tobaccos/
- Laudisi's distributor catalogs for G. L. Pease, Samuel Gawith, and Gawith Hoggarth & Co.
- WV SmokeShop's Peterson and Capstan listings.
- Smokingpipes product listings for Orlik Golden Sliced and A&C Petersen Escudo.
- L.J. Peretti's Capstan Gold listing.

Individual source URLs are retained per entry. Package weights are collapsed where they identify the same blend. Distinct blend or cut names remain separate. These names do not establish which package edition a user owns; the AI still researches the requested/current package.

To update, verify a manufacturer's or specialist retailer's listing, add only the identifying facts, retain its source URL and review date, and run the catalog tests. Do not automatically infer renamed-brand equivalence or discard an old blend because it is absent from one retailer's stock.

Matching is local and deterministic: exact blend names, prefixes, substrings, then token matching with conservative edit-distance tolerance. Selection is always explicit. No runtime search service or network request is involved.
