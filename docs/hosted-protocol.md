# Hosted protocol operation

The default Copy prompt embeds the complete current release. Hosted retrieval remains an experiment until fresh ChatGPT sessions can reliably read the complete contract. `https://tintocellar.com/api/protocol/v1` returns Markdown; `/api/protocol/v1/instructions.html` returns the same complete instructions and both schemas as readable HTML. Neither requires proof access or accepts uploads. The content identifies its revision and immutable URL and ends with `END TIN TO CELLAR PROTOCOL N`.

## Published resources

- `/api/protocol/v1` selects the current release and requires cache revalidation.
- `/api/protocol/v1/instructions.html` selects the current HTML release and requires cache revalidation.
- `/api/protocol/v1/releases/5/instructions.html` is the first immutable HTML representation. It is generated and hashed at release creation from the exact Markdown contract, with escaped text, both schemas, no scripts, and a distinct ETag.
- `/api/protocol/v1/releases/1/instructions.md` retains revision 1.
- `/api/protocol/v1/releases/1/cellarpack.schema.json` exposes its manifest schema.
- `/api/protocol/v1/releases/1/feedback.schema.json` exposes its feedback schema.

Immutable responses use a one-year cache lifetime. All support GET, HEAD, ETag, and conditional requests. Unknown routes return 404; unsupported methods on existing resources return 405. No protocol request depends on proof configuration. Private proof access remains separately appended to copied prompts and is never in downloadable instructions.

## Publishing a revision

Canonical authoring files are `src/lib/prompt/protocol.md`, `src/lib/prompt/feedback.md`, `src/lib/cellarpack/cellarpack-v1.schema.json`, and `src/lib/feedback/schema.json`. `src/lib/protocol/releases.json` preserves immutable release snapshots and SHA-256 hashes and selects the current revision. These snapshots are versioned protocol documents, not website build output.

1. Review voluntarily shared feedback, separated by revision. Edit the canonical instructions to address a concrete issue. Update the revision recorded in the authoring instructions and advance `current` in the release registry to a new bounded integer.
2. Run `npm run protocol:release -- --create`. This refuses to overwrite an existing revision. It creates the complete snapshot and updates the public portable instruction file.
3. Run tests, build, and lint. The build runs `npm run protocol:release` in check mode and fails when sources or portable instructions disagree with the selected immutable release.
4. Deploy with `npm run deploy` when authorized. Worker routing and release data are bundled in that deployment. Verify actual endpoint bodies and a fresh agent trial.

To roll back, select the retained older revision and restore its matching canonical authoring files and portable instructions, without deleting newer immutable snapshots. Check and deploy the result. A published revision must never be rewritten to correct a mistake; publish another revision instead.

## Compatibility and inspection

Manifest output remains CellarPack 1.0.0. Workflow revisions and feedback schemas evolve separately. The new reader accepts original feedback 1.0.0 and feedback 2.0.0 with a bounded numeric protocol revision. Unknown revisions are explicitly unrecognized. Older already-open clients may need to reload before they can read new feedback; optional feedback errors do not invalidate artwork.

Pack attribution uses `extensions["tin-to-cellar:protocol"]` with `revision`, `cellarpackVersion`, and `feedbackVersion`. It is strictly checked locally. Attribution is agent-reported, not authenticated. Malformed or conflicting attribution does not prevent artwork import, but cannot silently select a repair contract or enter the current pack's comparison totals.

Copy prompt includes the bundled contract and project request, pinning its revision. Download instructions contains only reusable instructions and schemas, without project details or proof access. Request-only delivery requires separately supplied or retrieved instructions. Before promoting hosted-only delivery, verify the revision, final marker and both schemas across fresh chats, then complete a hosted-only pack/import test. A successful small HTML control page does not establish complete protocol retrieval. Reported MIME errors without raw evidence are not a confirmed diagnosis.

Repair prompts reuse the recorded release. For legacy packs they prefer original conversation instructions and only use a compatible baseline if those are absent. The importer never fetches revision or provenance URLs or uploads artwork. Import submits only validated bounded feedback and eligible catalog source observations automatically; this is separate from hosted instruction retrieval.
