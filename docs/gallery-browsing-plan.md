# Gallery browsing design and critique

## Goals and assumptions

The primary task is finding artwork for a blend someone already owns. Other tasks are comparing designs for that blend, collecting labels for several jars, and discovering artwork without a specific blend in mind. These are product hypotheses, not findings from participant research.

## Critique and decisions

- Search completeness comes first. The old catalog search chose eight IDs before looking for artwork. A maker with many blends could appear to have very few designs. Search all published metadata, including maker aliases, partial words, and editions. Suggestions can be short; results must not inherit that limit.
- Keep the first screen useful. Put one search field, a maker filter, and ordering above an image grid. Maker options include published design counts and sort by that count, highest first, with alphabetical ties. Avoid extra browsing modes that ask people to classify their intention first.
- Make availability explicit. Suggestions distinguish published designs from catalog blends with no artwork. An exact chosen blend without artwork gets a creation route. A service failure must never look like zero results.
- Keep comparisons stable. Default to recently added, switch to best match when searching, and provide an explicit shuffle button. A shuffle is retained during filtering, selection, pagination, and navigation back to the gallery. Adding a label does not reset results.
- Expose alternatives without nesting the whole gallery into groups. Cards with multiple designs offer a blend filter. Named editions appear on cards. Bare date editions remain hidden because existing imported records use dates as administrative markers.
- Retain manual pagination. Show 24 cards at a time; loading more never rearranges existing cards. Keep keyboard focus on the control, and announce counts. Images remain lazy except for the first few cards.
- Keep search, filters, expanded results, order, and scroll position when returning from saved labels. Clear filters is an explicit action.
- Defer color/style tags, popularity, and personalized recommendations. Existing metadata does not support them reliably.

## Data boundary

Fetch public label metadata in bounded pages of 250 through the same serving controls, rate limiter, anonymous cache rules, and public projection as existing label reads. Finish the index before claiming complete counts. At the current library size this requires two metadata requests, with no per-keystroke network traffic. Artwork and packs are fetched separately as needed. The list is a browsing snapshot; publication changes appear on reload. If the library becomes large enough to make this initial load slow, move search/count/order to a server query with stable pagination.

## Verification

Cover search beyond eight blends, aliases, exact blend alternatives, explicit shuffle stability, missing-artwork states, partial-load failure, serving-off, unpublished-record exclusion, keyboard suggestions, preserved selections, and pagination. Run gallery and Worker tests, build, lint, and inspect desktop and narrow layouts locally. Browser checks do not substitute for participant testing.

Local verification completed: 206 gallery, Worker, and catalog tests passed in an isolated snapshot containing only this commit. The working-tree app/gallery integration run passed 77 tests. Build and lint passed. The build still reports its existing large-chunk advisory. Browser checks showed 314 designs, 139 under the Cornell & Diehl maker filter, and 141 for the broader C&D alias search. The maker menu starts with Cornell & Diehl, 4th Generation, and Amphora by published artwork count. Verified keyboard suggestions, explicit shuffle, unchanged first-page order after loading 48 cards, preserved state after visiting Your labels, missing-artwork messaging, and focus moving to the results when comparing Autumn Evening's two designs. At 390px, cards and controls fit without horizontal overflow. The verification tab reported no console errors. No production deployment or participant testing was performed.
