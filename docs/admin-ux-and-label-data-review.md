# Admin UX and label data review

Implementation update: the user approved a simpler model without early-version compatibility. See [Simplified label review](admin-review-implementation.md) for the implemented workflow, validation, and release state. The assessment below records the original proposal; its adapter recommendations were superseded.

Reviewed September 9, 2026. This is a source-backed assessment of the current working tree, including its existing uncommitted changes. Authenticated production layout and behavior were not inspected: browser approval review blocked the redirect from `admin.tintocellar.com` to its Cloudflare Access sign-in destination. `wrangler.jsonc` identifies that destination as the configured Access issuer. Live access approval was requested separately.

No application code or stored label data was changed. The data assessment was assigned to a dedicated subagent.

## Review workflow findings

| Priority | Finding and impact | Proposed change | Source |
| --- | --- | --- | --- |
| High | Approve/reject follows the large artwork, all metadata inputs, references, recommendations, and history. Every routine decision requires passing through secondary information. | Keep the decision bar visible alongside artwork, with approval, rejection, and any blocking reason. Use a sticky footer on narrow screens with enough content padding to prevent overlap. | `src/components/gallery/GalleryAdmin.tsx:52`, `src/components/gallery/GalleryAdmin.tsx:55`, `src/styles/gallery.css:39` |
| High | Queue items only open individual records. There is no selection state, bulk approval, or bulk rejection. The backend exposes per-item actions. | Add selection checkboxes and a persistent batch toolbar showing an exact count. Offer a review grid with readable previews and expanded inspection, followed by one explicit batch decision. | `src/components/gallery/GalleryAdmin.tsx:16`, `src/components/gallery/GalleryAdmin.tsx:50`, `worker/gallery/routes.ts:281` |
| High | Routine review presents a full editing form, raw catalog ID, and approval hash. History and recommendation sections remain expanded even when empty. | Default to artwork, maker/blend, optional edition, meaningful warnings, and decision controls. Put corrections behind Edit details; place history, hashes, and geometry in disclosures. Keep actionable warnings visible. | `src/components/gallery/GalleryAdmin.tsx:52`, `src/components/gallery/ReviewEvidence.tsx:26` |
| High | Successful decisions replace a row in place but do not remove it from the pending queue, refresh counts, or advance to the next pending item. | Reconcile the active filter after each decision, update counts from the server, announce the result, and offer Approve and next. Preserve queue scroll position. | `src/components/gallery/GalleryAdmin.tsx:35` |
| High | Opening another record, reloading, or refreshing filters clears the draft without checking for unsaved changes. | Preserve per-item drafts or offer Save / Discard / Keep editing before navigation discards corrections. | `src/components/gallery/GalleryAdmin.tsx:23`, `src/components/gallery/GalleryAdmin.tsx:29` |
| Medium | Changing status/search/mapping controls does not apply the filter until Refresh queue. More submissions then uses the edited controls with the previous queue cursor, which can combine pages from different filters. | Keep applied filters separate from draft controls, name the action Apply filters, and reset pagination when filters are applied. Alternatively apply changes automatically with a search debounce. | `src/components/gallery/GalleryAdmin.tsx:23`, `src/components/gallery/GalleryAdmin.tsx:48` |
| Medium | Approval can be disabled for several reasons without a nearby explanation. Errors appear above the entire queue and progress appears below the review layout. | Put a concise blocker and operation result in the decision bar: Save corrections first, Choose a tobacco match, Artwork is loading, or Reload this changed submission. Announce results through a live status region. | `src/components/gallery/GalleryAdmin.tsx:46`, `src/components/gallery/GalleryAdmin.tsx:56` |
| Medium | Queue navigation remains enabled during a save or decision. A late mutation response unconditionally replaces the selected record, so a review can jump back to the previous item. | Associate each response with its submission ID. Update the queue independently and update the detail pane only if it still shows that item. | `src/components/gallery/GalleryAdmin.tsx:35`, `src/components/gallery/GalleryAdmin.tsx:50` |
| Medium | At narrow widths the queue is stacked above the detail view and has its own scrolling region. Moving between items requires returning to the queue. | Use a queue/detail view switch on narrow screens, with Back to queue and Previous/Next controls within the review view. Verify focus and scroll restoration. | `src/styles/gallery.css:43`, `src/styles/gallery.css:72` |

The existing heading focus on selection, full-resolution artwork link, version-conflict handling, and saved-metadata review gate are useful foundations. Keep them while reducing navigation and reading effort. Current accessibility tests cover keyboard entry, automated checks, and horizontal overflow; their source does not establish efficient review at scale. These tests were inspected, not rerun for this documentation-only assessment.

## Suggested review layout

Desktop: queue with thumbnails and selection on the left; fitted artwork and a short identity summary on the right. Show the selected blend name as the review heading. Keep Edit details, Sources, and Review history available without expanding them by default. Show current warnings near the artwork. Place the review acknowledgement and decision buttons in a persistent bar.

Batch view: show selected labels in a review grid, including maker/blend, artwork, and blockers. Selection and human review are separate states. A single human acknowledgement can cover the displayed batch once inspected. Bind that acknowledgement to each saved version and digest; changing an item invalidates its reviewed state. Explicitly label Select loaded items because the API returns at most 24 items per page. Do not imply selection of unseen results.

Bulk actions should return a result for each item and retain failures for retry. Preserve the existing per-item version, digest, catalog mapping, duplicate, and publication checks. A small bounded client batch can use the existing routes initially. Any dedicated batch API should preserve the same checks and audit events. After an uncertain network result, refresh item state before retrying. Batch rejection should show the count and chosen reason before execution.

Acceptance checks for implementation: decisions remain reachable at 320px width and browser zoom; sticky controls do not cover content or keyboard focus; changing filters cannot mix result pages; unsaved edits survive navigation or require an explicit discard; delayed responses do not steal selection; successful decisions update the queue and counts; batch changes/conflicts produce clear per-item results. Use fixtures for these behaviors before testing authenticated deployment.

## Smaller label model

The dedicated subagent recommends this proposed domain model:

```ts
interface Label {
  id: string
  tobacco: { catalogId: string } | { maker: string; blend: string }
  artworkId: string
  artworkProfileId: string
  writingArea: NormalizedWriteAreaGeometry
  edition?: string
  altText?: string
}
```

`artworkProfileId` describes the artwork surface and bleed. Printer sheet geometry remains separate. Catalog mapping remains required for community publication; an unmapped maker/blend identity remains useful for local labels and intake.

| Existing properties | Proposed home or treatment |
| --- | --- |
| `catalogId`, `proposedIdentity` | One tobacco reference in the core label. |
| `surface` | Versioned artwork profile. The gallery currently enforces one 2.5-inch circle with 0.125-inch bleed and safe inset, so repeating the full tree adds no per-label variation. Preserve explicit geometry when adapting other supported local pack surfaces. |
| `writeInArea.geometry` | Keep actual per-artwork geometry; it varies between labels. |
| Writing-area ID, purpose, integrated-background flag, blank-overlay flag | Generate an ID when adapting the single gallery writing area; preserve legacy IDs when needed. Derive the purpose/background/overlay constants constrained by the gallery format. Keep the entire blank writing surface inside the artwork. |
| `edition` | Optional core field. Preserve known editions because matching and duplicate behavior depend on them. |
| `description` | Optional artwork alternative-text override. Provide an identity fallback; retain existing descriptive text where useful. |
| `package`, `variant`, `references` | Optional review evidence. Remove from the routine form. Preserve existing provenance and public-sharing choices. |
| Image SHA-256, bytes, width, height | Verified artwork asset record, populated automatically. |
| Consent, submission ID, state, version, digest, timestamps, history | Internal submission/review records. These remain necessary even though they need not be routinely displayed. |
| Published maker/blend snapshot | Retain internally for stable publication identity. Resolve ordinary display identity for the UI. |
| Research palette, motifs, border, typography, hierarchy, style, adaptation summary | Optional research document outside the core label. |

Evidence: `src/lib/gallery/types.ts:3` mixes submission, content, asset measurements, and consent. `src/lib/gallery/schema.ts:37` fixes gallery geometry. `src/lib/gallery/pack.ts:12` fills required research fields with placeholder text such as "Not recorded in the shared label". `worker/gallery/routes.ts:76` repeats edition and description in the public response.

## Implementation order

1. Simplify the review presentation, add persistent decisions, repair queue progression and draft handling. This can improve the workflow without a storage migration.
2. Add batch selection, a batch review view, and bounded decisions with per-item results.
3. Introduce the small domain model through adapters. Keep approved v1 metadata and artwork intact.
4. Version the submission contract to use artwork profiles and optional evidence. Define duplicate identity deliberately before removing package/variant/reference fields from its current comparison.
5. Revise CellarPack research requirements in a separate versioned change, updating importer, exporter, and prompt release together while preserving old-pack imports.

Deleting fields directly from v1 would break its exact-key parser and change approval hashes and duplicate comparison. Making research optional also affects importer semantics and collection edition extraction. Relevant code: `src/lib/gallery/schema.ts:24`, `worker/gallery/routes.ts:302`, `worker/gallery/routes.ts:325`, `src/lib/cellarpack/importer.ts:241`, and `src/lib/collection/import.ts:67`.
