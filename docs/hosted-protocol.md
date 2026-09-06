# Bundled protocol operation

Protocol 0.0.16 uses semantic versions and keeps Copy prompt self-contained. It includes the project request, complete instructions, both schemas and unchanged canonical proof program. Read prompt shows a request preview; Full copied text reveals exactly what is copied. There is no separate retrieval step or Copy complete prompt action.

The protocol API under `/api/labels/protocol/` is retired and returns 404. Versioned instruction snapshots and hashes remain in the local registry for provenance and same-chat repairs. Known repairs embed the recorded bundle; unknown revisions require the original instructions rather than guessing. Optional instruction downloads remain in How it works. Site deployment updates the protocol used for new prompts; existing chats keep their pinned revision.

## Pre-release versions

Current new-run versions are protocol `0.0.16`, CellarPack `0.1.0`, and feedback `0.2.0`. Protocol version strings are stored in the existing `revision` and `protocolRevision` fields. Numeric entries in the release registry are historical snapshots, not the current version scheme. New releases use `major.minor.patch` strings and remain immutable. Bump protocol patch for instruction edits; use a new minor version for incompatible pre-release schema changes. Existing CellarPack 1.x imports remain readable, but new prompts emit 0.1.0.

The protocol includes example opening, repair, resume, missing-reference, successful-delivery and incomplete-delivery messages. Routine chat omits versions, hashes and proof coordinates; required checks still run, and unresolved problems remain visible. Technical details are available on request.

Protocol 0.0.16 allows five total image attempts per label, stops successful or ineffective repairs early, delivers validated successful subsets with partial feedback, and accepts an explicit retry request as authorization for one additional attempt. Existing chats remain pinned to their earlier instructions.

## Publishing a revision

Canonical authoring files are `src/lib/prompt/protocol.md`, `src/lib/prompt/feedback.md`, `src/lib/prompt/local-proof.py`, `src/lib/cellarpack/cellarpack-v1.schema.json`, and `src/lib/feedback/schema.json`. `src/lib/protocol/releases.json` preserves immutable release snapshots and SHA-256 hashes and selects the current revision. The release builder embeds the exact local proof source and its SHA-256; changes to that program require a new protocol revision. These snapshots are versioned protocol documents, not website build output.

1. Review voluntarily shared feedback, separated by revision. Edit the canonical instructions to address a concrete issue. Update the revision recorded in the authoring instructions and advance `current` in the release registry to a new semantic-version string.
2. Run `npm run protocol:release -- --create`. This refuses to overwrite an existing revision. It creates the complete snapshot and updates the public portable instruction file.
3. Run tests, build, and lint. The build runs `npm run protocol:release` in check mode and fails when sources or portable instructions disagree with the selected immutable release.
4. Deploy with `npm run deploy` when authorized. Worker routing and release data are bundled in that deployment. Verify the actual copied prompt and a fresh agent trial.

To roll back, select the retained older revision and restore its matching canonical authoring files, including the local proof program where present, and portable instructions, without deleting newer immutable snapshots. Check and deploy the result. A published revision must never be rewritten to correct a mistake; publish another revision instead. Selecting an older protocol does not restore retired endpoints or bindings. Review its runtime requirements before rollback; pre-retirement instructions are not a supported way to restore hosted proof processing.

## Historical trials

## Current trial status — 2026-09-06

Revision 11 was deployed and completed a fresh three-label ChatGPT Work run through ZIP download, production import and the on-site sheet preview. This is a delivery/import pass, not a full visual-quality pass.

- Ordinary Chat trials produced composites. Work kept each generation and repair isolated; these are different tested surfaces.
- Work could not retrieve the hosted protocol and used the site's unchanged Copy complete prompt fallback. Hosted retrieval remains unreliable in this tested path; the errors do not establish their origin or a server-side block.
- Work acquired all three references and completed seven image calls automatically: Orlik two, Westminster three, Autumn Evening two. No Continue messages, long repair cues or reference reattachments were supplied. One Westminster call addressed spacing that need not differ from catalog typography.
- The exact delivered ZIP hash matched the report. Independent checks verified the root manifest, PNG dimensions and hashes, and alpha through the bleed region. Production accepted all three labels with zero structural issues; all three appeared in the correct preview slots.
- Independent canonical proofs and a second reviewer found remaining text clearance defects: Westminster's maker G and Orlik's small side lettering cross the safe boundary. All writing panels fit. The agent's all-clear claim was therefore too broad.
- Revision 12 adds checks of declared text/panel boxes with review crops and permits harmless source-accurate spacing differences. Measurements remain agent-supplied; this is not OCR or independent text certification. Fresh revision 12 verification is recorded below.

Earlier revision 10 also failed ZIP root layout and Westminster panel geometry; a bounded fourth diagnostic repair still failed. Historical evidence is preserved separately. Local ignored experiment records in `output/protocol-r10-e2e/` and `output/protocol-r11-e2e/` distinguish model claims, independently inspected artifacts, and observed website outcomes.

### Revision 12 verified run

Deployed commit `e586533d3a56b35751a26462ca30a2821bf5d8fe` completed a fresh ChatGPT Work / GPT-5.6 Sol Medium run on 2026-09-06. The exact site prompt required the complete-copy fallback after hosted retrieval failed. Following that fallback, Work acquired the references and completed seven isolated image calls automatically, with no additional continuation prompts or reference uploads. Orlik and Autumn Evening each used two calls; Westminster used three.

The untouched ZIP, SHA-256 `6cc57412d02402e8357dd56b5624ff3d010416edbcc501392814f264a2f959df`, contains a root manifest and three 1254-pixel PNGs whose hashes match the manifest. Production import accepted all three with zero issues, and the on-site Avery 94502 preview displayed the correct three labels. Physical printing was not tested.

The downloaded original proof bundle matches its reported hash. Its canonical script matches the repository byte for byte. All three original proof images match independently reproduced proof pixels exactly, despite differing PNG encoding hashes. All nine declared text/panel regions pass local checks. Two visual reviews found the text and whole writing surfaces inside the safe guides, with recognizable source motifs and no composite images. Exact facial detail in the Autumn Evening adaptation remains an editorial judgment; the checks do not certify pixel-identical package reproduction.

This verifies the tested Work workflow with complete-copy fallback. It does not establish reliable hosted retrieval or fix the ordinary Chat image-tool behavior. Evidence and the preserved audit are in local ignored `output/protocol-r12-e2e/`.

Conversation examples were expanded from the recorded test chats in protocol 0.0.15. See [Conversation review](conversation-review.md) for the observed failure modes, successful behavior and evidence limits.
