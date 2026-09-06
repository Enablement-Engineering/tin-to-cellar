# Tobacco selector proposal

Status: the inline autocomplete is implemented. The starter catalog contains 1,482 entries across 146 maker/brand names, with source references and review dates. Tobacco entry remains optional and package research stays in the user's AI chat. Catalog expansion and live web search remain future work.

## First version

Use one searchable input with compact removable selections. Results show maker and blend, with packaging edition only when it distinguishes otherwise similar entries. Support keyboard navigation, Enter to select, Escape to dismiss, and accessible result announcements. Never select a fuzzy match automatically. Uncommitted typed text remains in the generated prompt, so copying without selecting a suggestion does not lose the user's request.

Always offer “Use this name” for an unmatched entry. Keep bulk paste available for people with a cellar list. An empty selection is valid: the full prompt or request-only text tells the AI to use explicitly supplied chat context and ask if the desired blends remain unclear. Do not silently select every blend mentioned in a conversation.

Search a small static catalog locally. Start with maker/blend names, stable IDs, aliases, and optional source links. Prefer exact matches, then prefixes and token matches, then conservative typo tolerance. For example, an alias can connect “GL Pease” with “G. L. Pease”; an edition such as Orlik 50 g versus 100 g remains a deliberate choice when relevant. Duplicate handling uses the selected identity and edition, not just the displayed name.

Catalog matches help identify the request. They are not evidence of current packaging, ownership, stock, or prices. The AI must still inspect the actual package before generation. Avoid thumbnails in the first version; they add asset maintenance and can imply the pictured package is current.

## Catalog provenance

Seed a reviewed catalog from identified manufacturer or specialist-retailer pages. Record source URLs and review dates. Establish source permissions or a suitable data license before distributing a scraped catalog. Do not treat web search results as a ready-made authoritative database. Begin with a modest supported catalog plus unrestricted custom names rather than claiming exhaustive coverage.

Ship catalog data as a static asset and perform matching in the browser. Queries need no hosted AI service, search API, or per-keystroke network request. Reviewed catalog updates can be published with the site. Keep aliases, maker renames, and packaging variants separate so updates do not silently rewrite saved user choices.

## Why not live web search first?

A general web search needs a search service or a supported external integration. A service adds operating costs, rate limits, query handling, and result cleanup; retailer scraping adds ongoing maintenance. Cross-origin page fetching from a static app also depends on the source host's browser access policy. None of those costs are necessary to collect a label request.

If users often fail to find a blend, first expand the reviewed catalog. Later, offer explicit “Search the web” for a submitted query, with source links and user-confirmed matches. Never search on every keystroke or silently turn a likely match into the user's selection. Keep arbitrary-name entry available during network failures.

## Delivery plan

1. Expand the starter catalog with reviewed manufacturer or retailer identities as needed. Per-entry provenance lives in src/lib/tobacco-catalog/catalog.json.
2. Maintain local autocomplete with aliases, custom names, and bulk paste. Pass selected names and edition notes through the existing request builder.
3. Retain coverage for ambiguous names, misspellings, duplicate entries, keyboard/screen-reader use, empty requests, and pasted multi-line lists.
4. Observe missing-match reports before deciding whether a live search service is worth maintaining.

## Website return handoff

The instruction file includes the current website's Print labels URL. The AI returns the ZIP download and a separate return link, with directions to download, open Print labels, choose or drop the ZIP, set quantities, and print at actual size. A URL fragment selects the tab; it carries no artwork or pack data.

Do not encode image archives in URLs or imply a ChatGPT sandbox download is a public file endpoint. Automatic transfer would require a supported provider handoff or an explicit file-sharing integration. An installed-app share target is a possible future experiment, subject to source-app and browser support; ordinary file import remains the fallback.
