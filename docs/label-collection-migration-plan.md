# Migration to choosing, creating, and printing labels together

Status: implemented and locally verified in an isolated production-based worktree. This document preserves the approved design; see `label-collection-release.md` for implementation choices, verification evidence and remaining external trial boundaries.

Investigated source: production commit `2e7bec8f7af842a33300d65165b172d51fdaa9c4`, refreshed against `origin/main`, in `/private/tmp/tin-community-copy`. The primary checkout contains unrelated changes and is behind that production source. Implement against a fresh production-based worktree, checking for newer work first.

Three independent reviews covered the user experience, collection/import architecture, and catalog/AI handoff. A second pass removed unnecessary complexity following the user's direction. The recommendations below reconcile those reviews with direct source inspection. Suggested limits are design decisions to validate during implementation, not shipped contracts.

## Product decision

Make **Choose labels** the primary starting action. People assemble **Your labels** from existing community designs and artwork they create in their own AI chat. The website retains that work and presents one print workspace.

Use two main surfaces: preparation and printing. Preparation includes blend intake, choosing artwork, and the optional AI handoff. Do not require everyone to complete a sequence of generation steps. Community browsing and importing an existing ZIP are alternate entrances into the same saved work.

Existing artwork comes first in the choices, but the user selects the design. A blend identity match does not establish a preferred edition or approve its appearance. Creation stays available even when community artwork exists or the library cannot be reached.

Scope is one active set of labels saved on this browser and one current AI handoff. Accounts, a cellar inventory, multiple named collections, cross-device synchronization, and automatic transfer from ChatGPT are separate features.

### Deliberate simplifications

- Remove the independent gallery basket and the import-replaces-everything behavior once all entrances use shared state.
- Absorb Make a prompt into preparation; do not retain it as a competing primary journey or add a mandatory wizard.
- Keep one current handoff, without a batch dashboard, progress tracker, or history browser. Original import receipts still retain the information required for repairs.
- Keep selected designs only. Keep both adds another requested row; it does not create a library of unselected alternatives or version history.
- Use existing CellarPack imports and downloads. Defer a second project-backup file format and its separate validator.
- Match returns using the saved handoff, exact identity and user review. Defer machine-readable batch/item extensions unless actual handoff tests show a need.
- Reuse exact gallery lookup and pagination. Defer a bulk API, backend collection service, and synchronization.
- Keep one source of truth. Do not introduce parallel legacy/new stores, an event-sourcing system, or generic plugin infrastructure for this migration.

## What the investigation found

| Current behavior | Consequence for migration |
| --- | --- |
| `src/App.tsx:108` builds the prompt from one string of names and global special requests. | Preserve structured identities and select explicit generation targets before building the prompt. |
| `src/components/TobaccoPicker.tsx:32` publishes unfinished input, and selected catalog entries become display strings. | Separate editing from adding a row; retain catalog IDs when confirmed. |
| `src/components/gallery/GalleryBrowse.tsx:12` saves an independent list of publication IDs in sessionStorage. | Replace the separate basket with shared state; IDs alone do not preserve downloaded artwork. |
| `src/App.tsx:178` replaces printable labels and resets their quantities on a usable import. | Implement additive import with explicit replacement decisions before introducing the mixed flow. |
| `src/components/ui-model.ts:3` represents printable artwork using temporary object URLs. | Keep this as a rendering model, derived from durable artwork bytes and metadata. |
| `src/components/gallery/search-labels.ts:7` limits a search to eight IDs and one merged page. | Use separate exact-ID lookups for requested blends. Do not interpret omitted results as absent artwork. |
| `worker/gallery/routes.ts:281` returns an empty result when serving is disabled. | Return serving availability with each listing response so outages cannot appear as no matches. |
| `src/components/ContributionStatus.tsx:12` sends a contribution when mounted. | Restoring saved work must not replay an import or submit diagnostics. |
| Protocol, repair, feedback, and sharing state are global to the last imported pack in `src/App.tsx:83`. | Preserve them per original import. |

## User experience

### Preparation

The page offers three entrances without requiring a preliminary mode choice: add blends, browse community labels, or import a ZIP. Order extraction remains local and its reviewed output adds structured rows; purchase quantities do not determine print quantities.

Each committed row represents a requested label, with a confirmed catalog identity or the user's custom text. It can show available thumbnails and editions, the chosen artwork, and an action to create a new design. Background lookup never moves focus or changes the selection.

Example: Westminster and Autumn Evening use selected community artwork, while Early Morning Pipe is marked for creation. The summary says **2 labels ready · 1 to create**. The creation action prepares only Early Morning Pipe. **Print 2 ready labels** remains available while it is pending.

Use explicit artwork choices such as **Use this design** and **Create my own**. A selected design becomes ready only after its full pack has downloaded, passed validation, and been saved successfully. While downloading or saving, keep its thumbnail selected with an honest pending state and a retry action on failure.

One selected design per requested row is the default. It is not a uniqueness constraint on a blend: the user may intentionally keep two editions or designs as separate rows. Changing a selected design preserves that row's position and quantity. Requesting a new version can leave the current design printable until the return is accepted.

Collapse completed rows when that helps with a long order. Keep unresolved rows and specific actions easy to find. Use a compact shared summary; adapt the existing floating control's focus behavior rather than copying its hardcoded `gallery-title` target to other pages.

### AI handoff and return

The contextual action reads **Copy prompt for 3 labels**, with a preview of those three targets. Existing selected artwork remains on the website. The AI creates only the requested designs and returns the usual ZIP.

On return, **Add your new labels** validates the ZIP and shows the proposed additions. Clear additions use a compact preview and one add action. Ambiguous matches and replacements expose per-label choices: **Keep current**, **Use new**, **Keep both**, and **Skip**. That preview is also the fallback when the AI changes a name or returns artwork from an older chat. Do not put an additional confirmation dialog after that review.

When all requested artwork is available, omit the generation handoff and offer printing. An explicit secondary **Choose blends in my AI chat** entrance preserves the existing workflow where the website has no blend list. Its return is an ordinary reviewed import.

### Navigation

| Route | Proposed role |
| --- | --- |
| `/` | Site introduction with an obvious entrance into labels. |
| `/labels` | Updated introduction: choose existing designs or create your own, then print together. Primary action: Choose labels. |
| `/labels/create` | Choose labels / Your labels preparation workspace, including contextual generation. Reuse this route for existing inbound links. |
| `/gallery` | Community browsing that adds to the same saved work. |
| `/labels/print` | Quantities, sheet preview, and import/return entry. Includes Add more labels back to preparation. |
| `/labels/help` | Instructions covering existing-only, new-only, and mixed use. |

Keep the current AI return destination `/labels/print`. It restores the shared work and exposes import there, without a new URL parameter or routing contract. A new browser/device without saved state offers ordinary import of existing ZIPs. Do not imply that pending requests transfer across devices.

### States that must remain distinct

| Situation | Behavior |
| --- | --- |
| Name not resolved | Offer identity suggestions or keep custom text and create a design. |
| Lookup pending | Show Checking community designs; allow creation. |
| Exact lookup succeeds with no designs | Say No community designs for this blend yet. |
| Library disabled, timed out, or unreachable | Say lookup was unavailable; offer retry and creation. |
| Artwork selected but unavailable to download | Retain the choice with retry/change/remove; do not count it as ready. |
| Some rows ready, some awaiting artwork | Print the ready subset without inserting empty slots for pending rows. |
| Storage failure | Preserve the last saved state; explain the unsaved change and offer retry. Existing ready labels remain printable/downloadable. Do not add a separate temporary-project mode. |
| Another tab changed the collection | Refresh the committed state and recompute pending import decisions. |

## Local domain and persistence

Introduce a small `src/lib/collection/` domain with pure commands, validation, merge planning, storage, and export. React uses a shared provider/controller; `PrintStudio` continues to receive a derived display model. The records below describe responsibilities, not six services or six independent databases; nest metadata in the draft and keep blobs and import receipts in separate stores only where useful.

| Record | Responsibility |
| --- | --- |
| Collection | Schema version, local ID, revision, ordered row IDs, print settings. |
| Requested label row | Local ID/revision, confirmed catalog ID or custom identity, edition/request notes, selected design ID, quantity. |
| Design | Stable local ID, validated label metadata, artwork reference, source-import/publication association. |
| Artwork | Original encoded image bytes keyed by verified SHA-256, actual media type/dimensions. |
| Current handoff | Frozen target identities, local row revisions, exact prompt and protocol revision. No externally echoed IDs are required. |
| Import receipt | Original pack identity/digest, source-label mapping, validation and quarantine findings, protocol context, bounded diagnostic payload/delivery state. |

Keep user intent, lookup state, and asset readiness separate. A lookup failure is not a failed generation. Copying a prompt does not prove the user sent it or that the AI is running. Track prepared/copied and observed returns; do not invent job progress from elapsed time.

Use IndexedDB for metadata and blobs. Generate object URLs on demand and revoke them when their views no longer need them. Persist selected artwork at selection time, not only at printing. Hydration restores without source URL fetches or uploads. Import validation and image decoding happen outside a database transaction; commit the resulting records and blobs in one short transaction.

Compare an expected collection revision inside each write transaction. Notify other tabs after a successful commit using BroadcastChannel where available; re-read on focus as a fallback. A stale import review must be recomputed. Do not use last-writer-wins replacement or build collaborative editing infrastructure.

Store only information needed to resume the work. Do not persist original order files, raw OCR, original ZIP bytes by default, or arbitrary unknown manifest extensions. Preserve the original manifest's digest and the required validated label/research fields and protocol context. Construct diagnostics from the original validated import before any projection; retain that bounded payload independently. Optional freeform process notes remain transient under their existing disclosure unless a separate deliberate retention change is designed. Existing downloaded ZIPs remain the source archive.

Initial proposed ceilings: 100 requested rows, 100 selected design records, 45 MiB of unique encoded artwork, 2 MiB of serialized project metadata, and the existing 250-million-pixel aggregate budget, retaining existing per-image validation. These are ceilings, not a requirement to decode all images simultaneously. Validate peak memory with realistic PNG imports and mobile browser behavior before choosing final defaults. Remove unreferenced artwork after successful replacement/removal; do not keep an implicit alternatives history. Bound receipts within the metadata budget; never silently prune pending work to make room.

The 100-label count follows the current CellarPack schema's `labels.maxItems`, rather than introducing a 20-label limit for existing local imports just because the old gallery basket used that smaller limit. Capacity handling should reuse the import selection review; it does not need a separate storage-management screen.

Collection capacity is separate from ZIP validity. A valid ZIP that cannot fit can reach subset selection, without committing part of the requested change. The current importer accepts up to 50 MiB compressed, 200 MiB uncompressed, 500 entries, and a 2 MiB manifest. Ready-pack export must independently pass those limits, including final serialized size; the artwork budget alone is not proof of export validity.

Preserve quantity rules in domain validation, including restored or imported state: zero omits a row, at most 99 copies per row and 450 total copies per print job under the current UI. Keep existing sheet/bleed/blank-writing-area behavior unchanged.

## Matching and additive import

The import pipeline is **validate original ZIP → prepare additions/conflicts → review → commit → render**. Parsing or rejecting a candidate cannot clear existing artwork, quantities, or earlier import findings.

Use the current handoff to narrow proposals to its requested rows, then match unambiguous exact canonical identity with relevant edition or exact custom identity. Fuzzy names only suggest a mapping. If the handoff has changed, is absent, or no longer describes the selected row, review the ZIP as an ordinary addition/alternative. Names, IDs and origin claims in a returned ZIP cannot bypass identity/geometry checks, establish authorship, or authorize replacement.

| Return | Merge rule |
| --- | --- |
| Valid result for an unchanged pending row | Propose filling that row. |
| Same source ZIP/design again | Do not add another copy or increase quantity. |
| Same image bytes with different geometry/research | Share blob storage, retain distinct design records. |
| Same blend with another design/edition | Offer an alternative or Keep both. |
| Old chat return after the user changed the row or handoff | Present both choices; never silently overwrite. |
| Deleted target | Offer an addition; do not resurrect the deleted row automatically. |
| Missing result | Leave the target pending. |
| Extra/unmatched result | Offer Add as another label or Skip. |
| Partially valid ZIP | Allow valid additions; retain rejected pieces' repair context. |
| Invalid ZIP or failed save | Preserve the entire prior committed state. |

Separate blob deduplication from design deduplication. Blob identity is verified bytes. Design identity additionally includes relevant geometry, writing areas, identity/edition, research and supported semantic metadata. Normalize source-local asset IDs and paths out of the fingerprint. Different containers may reference one design without losing their original import receipts.

Repairs belong to the original import, using its recorded protocol. A repair may include all prior labels or only failed ones; unchanged labels deduplicate, pending rows can fill, and changed selected artwork goes through review. Never send the whole mixed collection to the AI as one repair job. Historical import information supports this without exposing multiple concurrent handoffs or a job-management screen.

## Catalog lookup and generation contract

Retain canonical IDs from confirmed picker/order selections and preserve unknown custom identities. Do not re-resolve selected rows by their display text. A single autocomplete suggestion is not automatic artwork selection.

For requested rows, use the existing exact `catalogId` listing endpoint with at most four concurrent requests, per-ID pagination, cancellation/stale-response protection, and independent retries. Show the initial matches without fetching every possible design. Fetch more for that blend on demand. A bulk endpoint is a later optimization if measured latency justifies it.

Add a serving-availability field to every gallery listing response, including early empty returns. Update the browser adapter so a closed library cannot become a successful no-match result. Existing gallery search remains a discovery tool; its eight-ID limit must not constrain collection lookup.

Freeze the current handoff when preparing it. Save target row IDs and revisions locally, requested identity/edition/direction/geometry, selected source leads, pinned protocol revision and exact complete prompt before claiming the request is saved. Copying the same frozen request again reuses it. Editing the request replaces the current handoff snapshot; show that the copied request has changed. Late source responses never rewrite one already copied. A return from another chat remains importable through ordinary review.

Use explicit prompt modes: a collection handoff must contain at least one creation target; generic chat mode deliberately permits no website blend list. Zero remaining targets in a collection must never fall through to today's instruction to use the conversation's tobacco list. Retained designs do not appear among generation targets or need to be fetched by the AI.

Do not add a new archive sidecar, schema requirement or generation-ID extension for the first release. The compact return review handles the uncertainty while preserving old ZIP compatibility. Revisit optional versioned manifest/label correlation only if real use reveals significant ambiguity; such IDs would remain matching hints, never overwrite authority.

A small new immutable protocol release is still necessary: `src/lib/prompt/protocol.md:170` currently says importing replaces the current pack. Update that behavior description, the supplied return guidance and portable instructions. Never modify old snapshots. Source leads remain research leads, and original tin photographs remain generation references. A finished community label selected for printing has a different role.

## Diagnostics, sharing, and downloads

Keep original-import protocol, feedback, and delivery state separate from the combined display collection. A combined set must not claim that all artwork used one AI model, one protocol version, or one validation run.

Move contribution sending behind a new-import event and persistent per-receipt delivery state. Restoration, navigation, printing, or building a combined export must not create fresh diagnostic submissions. Unknown delivery outcomes retain the original submission ID and retry path; do not manufacture a new report. Continue applying existing source and feedback allowlists. Never fetch provenance URLs during import.

Record community origin from the known in-app download operation. Restored or imported metadata that claims community or self-created origin is not proof of that origin. Keep provenance descriptive and sharing conservative; labels already known locally as community artwork stay out of the newly-created-artwork sharing selection. Public sharing remains an explicit action and follows existing server validation/deduplication.

Keep one download: **Download labels**, a valid CellarPack containing ready selected artwork. Namespace all label IDs, asset IDs and file paths; rewrite their relationships; preserve original bytes and valid geometry/research. Export supported metadata only and do not copy dangling profile/asset references or synthesize one global AI feedback report. Revalidate the finished pack. Quantities and pending requests are not promised by this format.

The durable browser draft is the normal resume path. A downloaded CellarPack preserves finished artwork if browser data is cleared, but it is not a complete project backup. State that limit in help, without adding a new format and restore workflow to the first release. Do not promise permanent browser storage. Show saving failures when actionable rather than success notices after every change.

## Implementation sequence and ownership

Work from production in an isolated branch. Preserve the existing primary checkout. Keep each change small enough to review; do not expose a mixed flow until restoration and additive imports are ready.

| Phase | Deliverable | Main paths and exit condition |
| --- | --- | --- |
| 1. Reliable shared work | Typed collection, additive import/review, IndexedDB, quantities, conflict-safe writes, original-import diagnostics and combined download. | New `src/lib/collection/`; extract logic from `App.tsx` and reuse existing importer/builder. Reload/new-tab return, rejected candidates and failed writes preserve usable work; restore sends nothing. |
| 2. One preparation workspace | Gallery/example/direct imports and print consume shared state; structured blend intake finds existing designs. | `GalleryBrowse`, `FloatingPack`, `TobaccoPicker`, `OrderImporter`, `Configurator`, `PackImporter`, `PrintStudio`, `App`, and small Worker response addition. Download selected artwork and remove the independent basket. |
| 3. Complete the AI return | One frozen handoff for chosen creation targets, return review and original-import repair, old ZIP compatibility. | Prompt builders, current handoff state and reconciliation. Existing-only users cannot accidentally create a generic prompt. Update immutable protocol wording without changing the pack schema. |
| 4. Switch the main flow | Navigation/copy/help/privacy/design documentation and browser acceptance, then production release. | Landing, SiteHome, handoff, navigation, HowItWorks, Privacy, styles and current docs. Verify the complete mixed journey before promoting. |

These are implementation dependencies, not four separately exposed product releases. The small backend response addition can deploy compatibly first. Switch the primary experience only when the mixed round trip passes.

For parallel implementation, assign one owner to `src/lib/collection/**`; one to prompt contracts and releases; one to website components/styles; one to small gallery backend changes. Reserve `App.tsx`, package files, exports, and release integration for a single named integrator. Existing AGENTS.md module boundaries still apply, so negotiate interfaces before changing another owner's paths.

The gallery selection migration imports an old sessionStorage selection only after validating its shape, resolving publication details, and saving the new record. Old IDs are pending until artwork downloads. Make migration idempotent and retain the old value until the new save succeeds. It cannot discover sessionStorage from other tabs. Current unsaved prompt/print memory cannot be recovered after a page reload; deployment must not imply otherwise, and existing ZIP downloads remain a recovery path.

Version the database schema from the start. Future destructive migrations need a preservation/recovery plan; that does not require a backup product feature now. A fallback UI must still read the new collection and support print/import; reverting to the old replacement importer would strand saved work. Keep the generic creation entrance functional without maintaining two authoritative baskets.

## Validation and release gates

Run meaningful domain/import/storage tests, relevant component and browser suites, typecheck/build, lint and protocol-history checks for the changed areas. This investigation did not execute migration code or exercise a new AI workflow.

Required evidence:

1. Existing-only: select designs, save, reload, retain quantities and print without preparing a prompt.
2. New-only: explicit targets produce the correct prompt; the generic chat entrance still works with no website blend list.
3. Mixed: select two community labels, prepare a third, return in a new tab, add returned artwork, and print all three together with original community bytes unchanged.
4. Partial/repair: preserve ready artwork, pending targets, original quantities and import findings across partial output and subsequent repair.
5. Conflicts: repeated import, same bytes with changed geometry, editions of one blend, changed/ambiguous names, old chat return after a changed row, deleted targets and unexpected extras.
6. Failure: storage quota, aborted writes, unavailable publication, disabled gallery vs no matches, late responses, and two-tab edits leave existing work intact.
7. Network boundaries: restore/merge/print send no new imports or artwork uploads, provenance links are not fetched, and feedback belongs to its original import only.
8. Portability: combined pack passes the real importer and preserves all asset references/bytes; browser restoration preserves quantities and pending rows. A downloaded pack makes no promise to restore pending work.
9. Accessibility: keyboard identity/artwork choices, stable focus on background updates, clear conflict controls, status announcements, and no obstructed controls/overflow at narrow widths.
10. Real handoff: a fresh user-controlled AI chat receives the scoped prompt and returns an importable ZIP. Confirm exact-name proposals, manual fallback, visual output review and the combined print preview. Local test fixtures do not establish actual model compliance. AI execution is separate work; no generation was requested or run during planning.

Prefer a small realistic mixed batch for acceptance, then stress the capacity and pagination paths with fixtures. No need to generate a large catalog to test this migration.

## Deferred decisions and features

- **Customize this design**: a later flow that transfers the selected image to the AI, defines edits, and handles derivative-artwork sharing. Initial Create my own requests a fresh design for that blend.
- Loose image import: continues to need geometry, identity, and writing-area information. The first release accepts validated packs; it does not assume any uploaded image is printable.
- Cloud accounts, synchronization, named project lists, permanent inventory, provider API generation, automatic ChatGPT file transfer, new paper formats and expanded gallery publication workflows.
- Full project backup/restore, generation-ID extensions, multiple active handoffs, batch/history dashboards, and unselected design/version archives.
- Batch gallery availability API, larger collection limits and split exports, if measured use justifies them.

The implementation should begin with additive import and durable state. The visible redesign depends on that foundation: a person can choose existing artwork, leave to create the rest, and return to the same work.
