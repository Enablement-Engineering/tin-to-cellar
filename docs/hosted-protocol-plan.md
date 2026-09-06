> Historical plan. Hosted instruction retrieval was retired in revision 13; see hosted-protocol.md for the current bundled delivery.

> Historical plan: revision 7 replaces hosted proof and credential handling described below with a supplied local Python proof program. See [current protocol operations](hosted-protocol.md).

# Hosted CellarPack protocol plan

Status: proposed implementation plan, reviewed from contract, reliability, and experience perspectives. No application changes or deployment are included in this planning task.

## Outcome

Make the default prompt short enough to inspect comfortably. Keep the label request and visible artwork requirements in it, and have the agent retrieve the complete technical instructions from Tin to Cellar. Publish reviewed improvements from feedback as protocol releases without changing an ongoing run's contract.

The server owns publication and selection of the current release. It does not generate instructions dynamically, collect feedback automatically, or validate imported files remotely.

## Current implementation and constraints

- `src/lib/prompt/prompt.ts` embeds workflow instructions, the complete manifest schema, and feedback instructions/schema. Its ChatGPT launch builder returns the same full prompt.
- `public/agent/tin-to-cellar-prompt.md` and `public/spec/cellarpack-v1.schema.json` already publish static contracts. Reuse their canonical sources rather than introducing handwritten copies.
- `worker/index.ts` handles `/api/*`; other requests go to the deployed assets. Worker and assets can ship together under the existing deployment.
- `PromptHandoff.tsx` supports full-prompt and request-only copying, previews, clipboard failure recovery, and optional proof access.
- Feedback currently requires exactly `promptVersion: 2026-09-06.1`. An independent protocol update would otherwise make new reports invalid in existing clients.
- The importer accepts major-1 version strings but uses one bundled validator. That is not proof that it supports future manifest formats.
- Repair prompts currently embed today's schema. They need explicit revision handling.

Keep imports local, untrusted text non-executable, artwork geometry separate from sheet geometry, and the blank writing surface entirely inside the generated artwork. Existing worktree changes remain untouched during planning.

## Endpoint and release design

Use one required fetch for the agent. A separate discovery request is unnecessary initially.

| Proposed route | Response | Policy |
| --- | --- | --- |
| `GET /api/labels/protocol/v1` | Complete current Markdown bundle, including both schemas | Revalidate on each new run |
| `GET /api/labels/protocol/v1/releases/<revision>/instructions.md` | Exact immutable release bundle | Long-lived immutable caching |
| `GET /api/labels/protocol/v1/releases/<revision>/cellarpack.schema.json` | Exact manifest JSON schema for that release | Immutable |
| `GET /api/labels/protocol/v1/releases/<revision>/feedback.schema.json` | Exact feedback JSON schema for that release | Immutable |

Use the API namespace for strict route handling: missing resources must return 404, never a successful SPA document. The resources themselves remain static release content. Implement handlers from a finite release map; no database or arbitrary filesystem/path lookup is needed. GET and HEAD are supported; other methods return 405 with an Allow header.

Every instruction bundle includes its numeric release revision, immutable canonical URL, manifest version, feedback version, and an explicit end marker in the body. Headers alone are insufficient for agents. The end marker helps identify truncated retrieval; it is not proof the agent understood or followed the instructions.

Keep a small source-controlled release record with file hashes and current selection. Generate hosted resources, separate schemas, and the portable bundle from the same sources through an npm script. Preserve immutable historical release files and verify their hashes. Existing unversioned public URLs remain available as documented compatibility resources; new prompts use the API contract.

Publish the release map, Worker, and assets together. Rollback changes the current selection while retaining released resources. Do not edit a published revision in place.

Protocol reads are public and independent of proof configuration, Turnstile, image bindings, or proof budgets. They carry no credentials, task text, or uploads. Keep proof tokens in the existing per-request access text and restrict them to the proof POST endpoint. Decide cross-origin headers only for an actual browser consumer; do not couple document availability to proof authorization.

## What users inspect and copy

The primary Copy prompt action produces a compact, self-sufficient starting request containing:

- Only the supplied or confirmed tobacco list and user direction.
- A requirement to inspect package imagery and preserve defining artwork and exact maker/blend names.
- Finished geometry, applicable print preference, and exactly one blank writing area with no words or writing line.
- The requested downloadable CellarPack and return-to-print link.
- A short instruction to fetch the official technical bundle before starting, keep that revision through repairs, and request the portable bundle if retrieval is unavailable or incomplete.
- A brief statement that feedback stays local unless the user chooses to share it.

Technical archive limits, coordinates, hashes, schema fields, detailed proof mechanics, and diagnostic vocabulary move into the fetched bundle. The agent still receives all technical requirements; this change reduces the user-visible starting prompt, not necessarily total model context.

Keep a visible Current hosted instructions link beside the preview. Explain that these maintained instructions are fetched when the run starts and that the copied prompt is not the entire effective instruction set. Inspecting that current link does not freeze a subsequent run's revision.

Under More options, offer Copy complete prompt and Download complete instructions, each labeled with the bundled revision. The complete prompt includes the project request and separately appended proof access, and does not instruct the agent to fetch current. It is a standalone path for users who want to inspect and freeze the full contract. The downloaded instruction file is a reusable supplemental attachment containing the full contract, with no project details or proof credential; use it alongside the label request. The locally bundled fallback may be older than current hosted guidance. Update the compact example's fallback language and UI labels together.

Retain request-only copying for an existing conversation and explicitly reuse its pinned revision. Clipboard failure must reveal exactly the payload selected for copying. The preview and copy result must not diverge. Do not retain the current claim that the compact prompt was copied with all instructions.

Example starting instruction:

> Create the cellar labels listed below. Before researching or generating, read the complete technical instructions at https://tintocellar.com/api/labels/protocol/v1. Use the release identified there for this run and its repairs. If you cannot retrieve the complete instructions, ask me to attach the complete instruction file available under More options on Tin to Cellar. Do not invent the pack format.

The production builder adds the visible artwork requirements and project input described above. This example is not the full proposed prompt.

## Revision, compatibility, and repairs

Keep workflow revision, manifest schema version, and feedback schema version separate. The first hosted release continues emitting CellarPack `1.0.0`. Guidance-only releases may advance the workflow revision; format changes require an explicit importer compatibility decision and tests.

Record the workflow revision in an optional namespaced pack extension, with declared schema versions. Validate that extension locally with a strict schema independent of feedback validation. Derive official URLs from validated identifiers and fixed configuration rather than trusting a URL from a pack. The importer does not fetch the recorded revision. Packs without it remain importable. If provenance and feedback claim different revisions, preserve artwork import but flag inconsistent attribution; do not silently select either revision for repair or comparison.

Resolve current once at the start. Repairs in the same chat reuse that release. Repair prompts generated by the website use validated revision metadata and the immutable endpoint. For a legacy pack without a revision, prefer the original instructions still present in the conversation. Only when those are absent use the documented compatible bundled baseline, explicitly described as recovery guidance rather than the original contract. An unknown or unavailable recorded revision requests the original instructions rather than silently switching to current. Conflicting revision evidence requires clarification. Keep existing bounded, untrusted diagnostic handling and preserve successful artwork.

Separate the protocol origin from the return-to-print address, which may be localhost. Never derive a contract URL from user input, a pack URL, or `websiteUrl`.

## Feedback transition and improvement process

Add a new feedback schema version and retain the existing strict legacy parser. The new schema uses a bounded numeric protocol revision rather than a constant prompt-version string or arbitrary free text. Keep unknown properties rejected and existing privacy restrictions. A valid but unrecognized revision is labeled unrecognized, not authenticated or verified. Numeric fields, like existing counts, remain agent-reported and cannot certify truthful attribution.

Update the feedback type, parser, comparison UI, instructions, and export handling together. Group comparisons by protocol revision so reports from different instructions are not silently pooled. Older apps may reject the new feedback shape while still importing its artwork. Deploy the compatibility reader before switching the default prompt; document that already-open older clients may need a reload to view new reports.

Initially reuse existing issue categories for retrieval failures where appropriate. Add retrieval-specific stage/codes only with the new schema if needed for useful diagnosis; keep fields bounded and omit raw errors and URLs.

The maintainer reviews voluntarily shared, validated reports, selects a concrete recurring failure, edits the canonical guidance, and runs regression checks and a fresh-agent trial. Publish a new revision only after that review. Reports remain self-reported observations, not independent artwork-quality scores. No feedback ingestion endpoint or automatic rewriting is part of this change.

## Implementation sequence

1. **Release model and compatibility.** Establish release metadata, legacy/new feedback validation, optional pack provenance, and fixtures. Define supported contracts explicitly without broadening manifest acceptance.
2. **Publication and endpoint routing.** Add the build-time release generator and read-only routes. Verify complete/standalone schema parity, immutable history, errors, and operation without proof bindings. Preserve the full-prompt default while this is verified.
3. **Prompt and handoff.** Split compact request from portable complete bundle, update preview/copy/download actions, and wire pinned repair context. Keep the public portable instructions consistent.
4. **Integration and evaluation.** Test the complete flow, including protocol advancement during a conversation and a client with older bundled instructions.
5. **Release.** Build and prepare a concrete deployment for review under the user's deployment authorization. Verify live endpoints before enabling the compact handoff. Keep the portable mode as rollback/fallback.

Suggested ownership follows AGENTS.md: prompt work owns `src/lib/prompt/**` and `public/agent/**`; format work owns `src/lib/cellarpack/**` and `public/spec/**`; website work owns components and UI tests. Assign Worker routing, feedback, and release-generation files explicitly to one implementation owner. Agree on release metadata and builder interfaces before parallel edits.

## Acceptance checks

- Current and immutable endpoints return complete matching bodies and correct media types; unknown versions/routes return real errors; HEAD and unsupported methods behave correctly.
- Endpoints work with proof disabled or missing its bindings. No public bundle contains a token or per-user data.
- Hosted, portable, and standalone schemas match their declared release. Historical release hashes remain unchanged. No runtime network `$ref` resolution is introduced.
- Compact prompt omits schema payloads while retaining scope, fidelity, writing-area, geometry, delivery, retrieval, and fallback requirements. Test representative requests and long input without truncating user content.
- Clipboard success/failure, rendered/source previews, full-bundle download, and request-only reuse produce the selected payload and accurate status text.
- The full-copy path starts a fresh task without fetching current; the credential-free download works alongside the request. The UI distinguishes current hosted guidance from the locally bundled revision and does not imply that viewing current pins it.
- Existing packs still import offline. Legacy and new feedback reports remain readable; malformed or extra fields are rejected; no import or feedback action uploads data or fetches provenance.
- Conflicting provenance/feedback revisions are flagged without blocking artwork import or silently assigning attribution. Legacy repairs prefer available original conversation instructions before compatible baseline guidance.
- A run starts with release A, current advances to B, and repair still requests A. Rollback preserves both immutable releases.
- Run relevant Vitest suites, `npm run build`, and `npm run lint`.
- Exercise a fresh agent with successful retrieval and inspect its actual returned pack. Exercise unavailable/incomplete retrieval and confirm it requests the portable bundle before generation. Exercise a full portable run. Any provider-spend trial needs its own authorized budget.
- After authorized deployment, verify actual response bodies, media types, caching, immutable URLs, and a hosted fresh-agent handoff. Local passing tests alone do not establish agent fetchability or artwork fidelity.

## Review decisions

The contract review exposed feedback revision rejection, overly broad assumptions about major-1 support, and repair prompts using today's schema. These are explicit migration requirements above.

The reliability review favored one complete fetch over a descriptor followed by several dependent fetches. Separate JSON endpoints remain available for tools, but agents do not need to follow that chain. Publication stays within the existing Worker/assets deployment.

The experience review kept the artistic promises visible and feedback collection manual. Technical details are available for inspection without dominating the default prompt. Hosted guidance remains a reviewed release process.
