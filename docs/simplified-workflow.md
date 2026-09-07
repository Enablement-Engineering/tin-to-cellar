# Tin to Cellar workflow

Start with [Choose labels](https://tintocellar.com/labels/create). Assemble one set of labels from community artwork and new designs made in your own AI chat. The site saves this work in your browser and prints the ready designs together.

## Choose artwork

Add a blend by selecting a catalog suggestion, entering a custom name, pasting a list, or reviewing an imported order. A confirmed catalog identity checks for existing community designs. Choose a thumbnail with **Use this design**, or select **Create my own**. A matching blend does not choose an edition or design for you.

Community browsing at `/gallery` adds to the same saved work. Artwork only counts as ready after its full pack downloads, passes the existing CellarPack and Avery checks, and saves. Library unavailability is distinct from a successful lookup with no designs. Ready rows can print while others wait for artwork.

Order reading remains local. Supported input includes text PDFs up to 20 pages, PNG/JPEG/WebP screenshots up to 20 million pixels, and pasted text up to 100,000 characters. Files are limited to 10 MiB. Scanned PDFs are not supported. Review the extracted identities before adding them. Purchase quantities never determine print quantities. Original order files and raw OCR are not saved in the label workspace.

## Create only what you need

The creation prompt lists only rows explicitly marked **Create my own**. Selected artwork remains on the website. A ready row may request another design without losing its current printable artwork.

The website saves one exact handoff before copying it, including its target identities, row revisions, source leads and protocol revision. Later source responses do not change that copy. Changing a target prepares a new request. Copying does not prove that the AI is running.

When no rows need creation, the collection does not show a generation prompt. **Choose blends in my AI chat** is a separate, deliberate entrance from an empty preparation workspace. It lets the AI ask for the blend list, without inferring an inventory from account memory or unrelated chats.

The complete copied prompt includes the protocol, schemas and local proof program. It instructs the AI to research actual packaging, generate artwork, review a separate proof, and return a CellarPack ZIP. The AI needs research, image inspection, image generation and file creation tools. There is no provider API integration or automatic file transfer.

The AI return destination remains `/labels/print`. It is a human-facing import page, not an endpoint for the model to fetch. Reusable instructions are available in How it works. Protocol 0.0.22 describes additive import; older immutable instructions remain unchanged.

## Add returned artwork

Importing validates the original ZIP before showing additions and conflicts. Review the proposal and choose **Add labels**. Exact unchanged pending targets can be proposed for filling. Replacements are visible choices; ambiguous or changed names can be mapped manually, kept as separate labels, or skipped.

A repeated design does not add copies or reset quantities. Valid labels from a partial pack can be accepted while failed labels retain their original repair report. Rejected imports and failed saves preserve committed labels. Repair prompts belong to the original import and its protocol, never to a synthetic combined AI job.

Import reports retain their original bounded structured diagnostics. New accepted local imports, and readable rejected imports, can send the existing allowlisted contribution. Restoration, navigation and printing do not replay it. Optional freeform process notes remain transient and require explicit sharing. Imported artwork and provenance URLs are not uploaded or automatically fetched.

## Save and print

Your labels, encoded artwork, quantities, printer settings, creation requests and current handoff are saved in IndexedDB on this browser. Other tabs use revision checks to prevent silent overwrites. A stale import review must be reviewed again. Storage failures leave the previous saved state available and show an actionable error.

**Download labels** produces one validated CellarPack of the ready selected designs. It preserves original artwork bytes and valid geometry/research, but does not preserve quantities or unfinished requests. Keep downloaded ZIPs if you move to another browser or clear browser data. Browser storage is not a permanent backup. **Clear saved labels** requires confirmation and clears the browser workspace; it does not delete downloaded ZIPs.

The current workspace permits up to 100 rows and selected designs, 45 MiB of unique encoded artwork, 250 million unique image pixels, and 2 MiB of metadata. Existing per-image and archive checks still apply. Quantities run from 0 to 99 per row, with at most 450 ready copies. These bounds are enforced in the domain, not only in controls.

Print labels uses Avery 94502, nine 2.5-inch circles on US Letter. A zero quantity omits that row. Pending rows do not insert empty slots. Paper and alignment contains printer offsets, starting position and calibration controls.

Print at Actual Size / 100%, with browser headers and footers disabled. Test alignment on plain paper and measure it with a ruler. Browser tests do not establish physical printer accuracy.

Artwork geometry remains separate from printer sheet geometry. The preview clips at the circular trim boundary; printing includes the original supplied bleed. Generated artwork owns the entire light, blank date-writing surface. The website adds no words, lines, overlays or replacement geometry.

## Implementation boundaries

`src/lib/collection/` owns typed commands, merge plans, validation, atomic storage and export. `src/hooks/useCollection.ts` serializes this tab's writes and refreshes after cross-tab changes. `src/PublicApp.tsx` connects the preparation, original-import diagnostics, handoff and printing views. PrintStudio receives an object-URL display projection, not a second authoritative collection.

Exact per-blend gallery lookup has a shared maximum of four active requests, per-blend pagination and cancellation. Its serving flag distinguishes a closed library from no matches. There is no new bulk API or backend collection store.

The old gallery session selection can be restored explicitly. Its value is retained until every selected publication has downloaded and saved, making retries idempotent. Other tabs' sessionStorage is not discoverable.

Accounts, cloud synchronization, named collections, an inventory, editing a selected community design in AI, loose-image import, provider generation, multiple handoff dashboards, a second backup format and new paper formats are deferred.
