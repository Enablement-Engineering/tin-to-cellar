# Hosted protocol operation

Copy prompt supplies the request and an immutable `/api/labels/protocol/v1/releases/N/instructions.html` URL selected by the deployed site. The agent must verify the expected revision, both schemas and exact end marker; mismatched or incomplete retrieval requires the complete-copy fallback. This avoids silently accepting an older response from the current-release URL. Copy complete prompt is the self-contained recovery if retrieval fails. `https://tintocellar.com/api/labels/protocol/v1` returns Markdown; the HTML URL returns the same complete instructions and both schemas as readable HTML. Both are public read-only resources. The content identifies its revision and immutable URL and ends with `END TIN TO CELLAR PROTOCOL N`.

## Published resources

Revision 6 moves label APIs under `/api/labels/`, including protocol, proof, proof-access, sources, contributions, and the disabled OCR stub. `/api/health` remains site-wide. Former unnamespaced routes return 404; reload already-open clients and create a fresh prompt after deployment. Revisions 1–5 remain byte-identical archival documents served under the new namespace, so their embedded historical URLs are evidence of the original release and are not active compatibility routes. Revision 7 retires hosted proof and access endpoints and embeds the local proof program. Revision 8 adds script checksum verification, atomic proof output, and individual-image generation. Revision 9 isolates the current blend reference and completes each label before starting the next, using a fresh single-reference attachment when isolation fails. Revision 10 requires an exact clean edit target, a separate brief for each label, selection of accessible existing files before reattachment, a shared image-call limit, and renewed proofs after artwork changes. Revision 11 makes continuation resume the recorded review step, permits width/height and surrounding layout changes when repairing writing-panel overflow, and requires reopening the delivered ZIP to verify its root manifest and asset paths. These are workflow requirements, not a guarantee that every chat surface can execute them. New runs use the revision named by the site-issued prompt.

- `/api/labels/protocol/v1` selects the current release and requires cache revalidation.
- `/api/labels/protocol/v1/instructions.html` selects the current HTML release and requires cache revalidation.
- `/api/labels/protocol/v1/releases/5/instructions.html` is the first immutable HTML representation. It is generated and hashed at release creation from the exact Markdown contract, with escaped text, both schemas, no scripts, and a distinct ETag.
- `/api/labels/protocol/v1/releases/1/instructions.md` retains revision 1.
- `/api/labels/protocol/v1/releases/1/cellarpack.schema.json` exposes its manifest schema.
- `/api/labels/protocol/v1/releases/1/feedback.schema.json` exposes its feedback schema.

Immutable responses use a one-year cache lifetime. All support GET, HEAD, ETag, and conditional requests. Unknown routes return 404; unsupported methods on existing resources return 405. No protocol request depends on private credentials. The current protocol includes the complete local proof program; copied prompts contain no proof access tokens.

## Publishing a revision

Canonical authoring files are `src/lib/prompt/protocol.md`, `src/lib/prompt/feedback.md`, `src/lib/prompt/local-proof.py`, `src/lib/cellarpack/cellarpack-v1.schema.json`, and `src/lib/feedback/schema.json`. `src/lib/protocol/releases.json` preserves immutable release snapshots and SHA-256 hashes and selects the current revision. The release builder embeds the exact local proof source and its SHA-256; changes to that program require a new protocol revision. These snapshots are versioned protocol documents, not website build output.

1. Review voluntarily shared feedback, separated by revision. Edit the canonical instructions to address a concrete issue. Update the revision recorded in the authoring instructions and advance `current` in the release registry to a new bounded integer.
2. Run `npm run protocol:release -- --create`. This refuses to overwrite an existing revision. It creates the complete snapshot and updates the public portable instruction file.
3. Run tests, build, and lint. The build runs `npm run protocol:release` in check mode and fails when sources or portable instructions disagree with the selected immutable release.
4. Deploy with `npm run deploy` when authorized. Worker routing and release data are bundled in that deployment. Verify actual endpoint bodies and a fresh agent trial.

To roll back, select the retained older revision and restore its matching canonical authoring files, including the local proof program where present, and portable instructions, without deleting newer immutable snapshots. Check and deploy the result. A published revision must never be rewritten to correct a mistake; publish another revision instead. Selecting an older protocol does not restore retired endpoints or bindings. Review its runtime requirements before rollback; pre-retirement instructions are not a supported way to restore hosted proof processing.

## Compatibility and inspection

Manifest output remains CellarPack 1.0.0. Workflow revisions and feedback schemas evolve separately. The new reader accepts original feedback 1.0.0 and feedback 2.0.0 with a bounded numeric protocol revision. Unknown revisions are explicitly unrecognized. Older already-open clients may need to reload before they can read new feedback; optional feedback errors do not invalidate artwork.

Pack attribution uses `extensions["tin-to-cellar:protocol"]` with `revision`, `cellarpackVersion`, and `feedbackVersion`. It is strictly checked locally. Attribution is agent-reported, not authenticated. Malformed or conflicting attribution does not prevent artwork import, but cannot silently select a repair contract or enter the current pack's comparison totals.

Copy complete prompt includes the bundled contract and project request, pinning its revision. Download instructions contains only reusable instructions and schemas, without project details. Request-only delivery requires separately supplied instructions. Two fresh ChatGPT sessions historically read the full revision-5 HTML, including both schemas and final marker. That result does not establish current retrieval reliability or complete generation/pack/import success. Reported MIME errors without raw evidence are not a confirmed diagnosis. The primary compact prompt must name the actual Copy complete prompt fallback and stop if the hosted contract is unavailable rather than inventing a format.

Repair prompts reuse the recorded release. For legacy packs they prefer original conversation instructions and only use a compatible baseline if those are absent. The importer never fetches revision or provenance URLs or uploads artwork. Import submits only validated bounded feedback and eligible catalog source observations automatically; this is separate from hosted instruction retrieval.

## Current trial status — 2026-09-06

Revision 11 was deployed and completed a fresh three-label ChatGPT Work run through ZIP download, production import and the on-site sheet preview. This is a delivery/import pass, not a full visual-quality pass.

- Ordinary Chat trials produced composites. Work kept each generation and repair isolated; these are different tested surfaces.
- Work could not retrieve the hosted protocol and used the site's unchanged Copy complete prompt fallback. Hosted retrieval remains unreliable in this tested path; the errors do not establish their origin or a server-side block.
- Work acquired all three references and completed seven image calls automatically: Orlik two, Westminster three, Autumn Evening two. No Continue messages, long repair cues or reference reattachments were supplied. One Westminster call addressed spacing that need not differ from catalog typography.
- The exact delivered ZIP hash matched the report. Independent checks verified the root manifest, PNG dimensions and hashes, and alpha through the bleed region. Production accepted all three labels with zero structural issues; all three appeared in the correct preview slots.
- Independent canonical proofs and a second reviewer found remaining text clearance defects: Westminster's maker G and Orlik's small side lettering cross the safe boundary. All writing panels fit. The agent's all-clear claim was therefore too broad.
- Revision 12 adds checks of declared text/panel boxes with review crops and permits harmless source-accurate spacing differences. Measurements remain agent-supplied; this is not OCR or independent text certification. Fresh revision 12 end-to-end verification is still required.

Earlier revision 10 also failed ZIP root layout and Westminster panel geometry; a bounded fourth diagnostic repair still failed. Historical evidence is preserved separately. Local ignored experiment records in `output/protocol-r10-e2e/` and `output/protocol-r11-e2e/` distinguish model claims, independently inspected artifacts, and observed website outcomes.
