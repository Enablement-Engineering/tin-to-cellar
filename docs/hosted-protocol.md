# Bundled protocol operation

Protocol 0.0.28 keeps Copy prompt self-contained and describes reviewed additive imports. A collection request contains only explicitly requested new designs; selected community artwork remains on the website. The saved handoff includes the exact project request, complete instructions, schemas and canonical proof program. Read prompt shows a request preview; Full copied text reveals exactly what is copied.

The protocol API under `/api/labels/protocol/` is retired and returns 404. Versioned instruction snapshots and hashes remain in the local registry for provenance and same-chat repairs. Known repairs embed the recorded bundle; unknown revisions require the original instructions rather than guessing. Optional instruction downloads remain in How it works. Site deployment updates the protocol used for new prompts; existing chats keep their pinned revision.

## Pre-release versions

Current new-run versions are protocol `0.0.28`, CellarPack `0.1.0`, and feedback `0.2.0`. This migration adds no schema, sidecar or correlation-ID extension. Protocol version strings use the existing `revision` and `protocolRevision` fields. Numeric registry entries are historical snapshots. New releases use immutable semantic versions. Bump the patch for instruction edits and use a new minor version for incompatible pre-release schema changes. Existing CellarPack 1.x imports remain readable; new prompts emit 0.1.0.

Protocol 0.0.24 starts an execution request immediately and pauses only for a real decision, an unresolved blocker, a host-ended image turn, or completion. Before each image call it explains that a host pause may occur and that Continue resumes inspection, preparation, proof and packaging, never another generation. Routine chat omits versions, hashes and proof coordinates; required checks still run, and unresolved problems remain visible. Technical details are available on request.

The canonical proof helper now prepares final artwork as a non-interlaced 8-bit RGB or RGBA PNG with an explicit sRGB chunk and no embedded ICC profile before inspection and packaging. It verifies decoded pixels after export, reports canonical encoding separately from the gallery input envelope, and never upscales artwork to make it pass.

After reference approval, one initial image-producing call is authorized per label. A confirmed artwork defect requires explicit authorization for one focused edit. Full regeneration requires its own explicit authorization. Continue resumes unfinished checks and packaging after an image; it does not authorize a repair. Failed image calls count and do not authorize silent retries. File-only corrections use the existing artwork and rerun dependent proofs and hashes.

Protocol 0.0.28 processes one tobacco from research through proof before starting the next. The assistant displays the current packaging photo with its source link and asks the user to right-click, choose Copy Image, then paste the photo into the chat and send. Pasting the matching photo confirms the reference; words or a URL alone do not supply image input. A saved photo or clear screenshot is accepted when copying is unavailable. The assistant then generates, prepares and proofs that label before researching the next tobacco. Completed artwork is retained for one final ZIP. This replaces batch research and batch reference approval. Earlier releases, including the batch review in 0.0.25 and the five-attempt policy in 0.0.20, remain available for chats pinned to them.

Protocol 0.0.26 adds a proof link in the same message as a visual error and its repair choices. The assistant verifies that the proof opens, belongs to the affected candidate, and shows the stated problem. It explains the relevant guide or crop and reports unavailable proof honestly. Nonvisual errors use available diagnostics. These review artifacts stay outside the CellarPack and generator inputs.

## Local validation status: 2026-09-09

Revision 0.0.28 adds the sequential research/photo-paste/generation/proof cycle. Regression checks require the copy-image instruction, pasted-photo approval, next-tobacco research only after proof, deferred saved-source inspection, and one final ZIP. They also reject the prior batch-research and batch-review instructions. A fresh AI trial is still required to assess host image handoff and generation behavior.

Validation passed: 546 tests, lint, production build, release verification and diff whitespace checks. The local server's portable prompt matched the built 0.0.28 artifact byte-for-byte by SHA-256. The local artwork page offers the updated-copy action while preserving the saved older handoff. Documentation follows the same per-label sequence. This revision has not been deployed.

### Revision 0.0.27 validation

Revision 0.0.27 responds to a user-supplied three-blend run whose attached instructions identified 0.0.24. The screenshot showed a three-label composite followed by another Adagio when Autumn Evening was expected. It did not expose image-tool arguments or native proof files, so the exact backend reference selection and print geometry could not be verified. The revised contract defaults to one photo per message, names the active blend before every image call, checks returned identity before layout, and stops batch generation after an isolation failure. A composite or wrong-blend output must not be offered as a focused-edit target.

The application regression reproduced saved 0.0.24 instructions being recopied after reload. Saved handoffs intentionally retain their revision, but lacked an update action. The new **Copy updated instructions for a new chat** action preserves the frozen request, verifies both release bundles, and saves the replacement before clipboard delivery. It leaves current-chat instructions and imported-pack repair provenance intact. A fresh AI trial is still needed to assess the revised generation behavior.

Local validation passed: all 545 application tests with `npm test -- --maxWorkers=2`, lint, production build, immutable release verification and diff whitespace checks. An earlier full run had one intermittent gallery intersection test failure; that test passed in the focused rerun and the complete suite passed without changing it. In the running local application, the update action copied revision 0.0.27 with the user's three-label request unchanged and returned keyboard focus to the normal Copy button. No deployment or fresh image-generation trial was performed.

### Revision 0.0.26 validation

Protocol 0.0.26 includes the attachment request from 0.0.25 and the proof-link refinement. All 543 application tests passed with `npm test -- --maxWorkers=2`; lint and release verification also passed. An earlier unrestricted test run had one 5-second timeout in the bundled-example import test; the complete rerun passed without changing that test or its timeout. Deployment remains pending.

### Initial integration: 2026-09-08

The integration adapts the Autumn Evening first-pass prompt v0.1.2 into the application-wide protocol while retaining the existing CellarPack, feedback and retrospective schemas. Protocol 0.0.24 and its integrity metadata are created locally. This implementation has not been committed or deployed by this task.

Validation passed: 543 application tests, 10 Python preparation/proof tests, production build, lint, immutable release verification and diff whitespace checks. The PNG tests include conversion of an embedded ICC profile and export without an `iCCP` chunk. These results establish local implementation checks. A fresh AI generation run, production import, gallery submission and physical printing have not been tested for this revision.

## Publishing a revision

Canonical authoring files are `src/lib/prompt/protocol.md`, `src/lib/prompt/feedback.md`, `src/lib/prompt/retrospective.md`, `src/lib/prompt/local-proof.py`, `src/lib/cellarpack/cellarpack-v1.schema.json`, `src/lib/feedback/schema.json`, and `src/lib/feedback/retrospective.schema.json`. `src/lib/protocol/releases.json` preserves immutable release snapshots and SHA-256 hashes and selects the current revision. The release builder embeds the exact local proof source and its SHA-256; changes to that program require a new protocol revision. These snapshots are versioned protocol documents, not website build output.

### Integrity boundary

`src/lib/protocol/metadata.json` carries build-generated SHA-256 and UTF-8 byte-length records for every archived instruction body and each current source component. The release command verifies historical content before regenerating this runtime record. The browser recomputes the selected instruction digest before it saves or copies a handoff, then requires the final prompt to equal those instructions followed by the frozen request. A mismatch stops clipboard delivery and asks the user to reload.

These hashes bind exact bytes to the version-controlled release. They do not authenticate a site whose code and metadata were both replaced. Add detached release signatures only if prompts or test kits need verification outside the trusted application, and keep the signing key outside the repository and deployment credentials.

CellarPacks remain untrusted input even when their internal hashes match. Import always enforces archive limits, rejects active or nested content, decodes artwork, checks declared dimensions, and recomputes artwork hashes. Protocol integrity never bypasses those checks.

### Release procedure

1. Review voluntarily shared feedback, separated by revision. Edit the canonical instructions to address a concrete issue and advance `current` in the release registry to a new semantic-version string. The release builder supplies the version header.
2. Run `npm run protocol:release -- --create`. This refuses to overwrite an existing revision. It creates the complete snapshot and updates the public portable instruction file.
3. Run tests, build, and lint. The build runs `npm run protocol:release` in check mode and fails when sources or portable instructions disagree with the selected immutable release.
4. When deployment is authorized, integrate the scoped changes onto current `origin/main` and use the current release workflow. Coordinate with other release tasks. Verify health, the protected budget endpoint, and the actual copied prompt after deployment, then record a fresh agent trial. See [CI deployment](ci-deployment.md).

To roll back, select the retained older revision and restore its matching canonical authoring files, including the local proof program where present, and portable instructions, without deleting newer immutable snapshots. Check and deploy the result. A published revision must never be rewritten to correct a mistake; publish another revision instead. Selecting an older protocol does not restore retired endpoints or bindings. Review its runtime requirements before rollback; pre-retirement instructions are not a supported way to restore hosted proof processing.

## Historical trials

### Revision 11 trial: 2026-09-06

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
