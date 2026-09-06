# Gallery administration and advisory agent API

Implementation status: September 6, 2026, local branch `codex/community-gallery`. The expanded human review screen, scoped advisory agent API, trusted local client and dedicated admin-host routing are implemented locally and remain uncommitted. The user has authorized configuration and deployment; the release owner is completing secure token authorization and hosted authentication proof. No new Tin to Cellar Access applications or successful hosted admin/agent proof are established by this document. Actual remote state belongs in [release preparation](gallery-release-plan.md) and [validation](gallery-validation.md).

## Intended experience

A visitor opens a CellarPack ZIP locally, chooses individual artworks to share, and explicitly submits those images and their shared metadata. Selected submissions are stored privately so Dylan can review them. Approval makes the reviewed version available in the public gallery; importing a ZIP alone never uploads it. The original ZIP, private pack notes and unrelated labels stay local.

Dylan reviews each image at `/admin/gallery`. An agent can help inspect a permitted part of the private queue and leave a recommendation. Only Dylan can correct metadata, approve, reject, unpublish or republish. An agent recommendation never triggers one of those actions. This uses the existing Worker, D1 and private R2 storage; it needs no hosted model subscription or separate MCP server.

## Existing implementation and gaps

Grounding: `src/components/gallery/GalleryAdmin.tsx`, `src/components/gallery/client.ts`, `src/lib/gallery/types.ts`, `worker/gallery/auth.ts`, `worker/gallery/routes.ts`, and `migrations/gallery/0001_gallery.sql`.

| Area | Implemented locally | Remaining proof or scope |
| --- | --- | --- |
| Queue | Oldest-first (createdAt, id) pagination, thumbnails, identity/edition/age, state/search/mapping filters and pending/storage counts | Verify with real hosted human authentication and seeded staging data. |
| Review | Full-resolution private artwork, image-failure approval gate, searchable catalog mapping, geometry/validation summary, uploaded/canonical/metadata hashes and approval digest | Visual fidelity remains human judgment; hosted image access and login still need proof. |
| Decisions | Version/digest-guarded human actions, pending-only corrections, unchanged-snapshot republish, atomic state/audit writes | Hosted conflict/revocation workflow; no bulk or agent decisions. |
| Identity and routing | Separate human/machine JWT verifiers, revocable scoped grants, dedicated admin-host guards, legacy public admin redirect, minimal admin shell | Create/configure actual Access applications and verify fresh signed identities and policies. |
| History and operations | Human history/recommendation views, stale advice labeling, cleanup/retention status, agent grant registration/revocation UI | Prove real scheduled cleanup and operations signals after staging configuration. |
| Agent support | Scoped pending queue/detail/image endpoints, strict version-bound append-only recommendations, quotas/audit, protected local HTTP client | Initial synthetic grant, real service token, hosted permission/revocation and human-boundary proof. |


The earlier bounded review found and repaired three gaps:

1. The UI sent `digest` when republishing, but the backend accepts only `expectedVersion` for that action. The bounded correction aligns the UI with that existing contract; the API already checks the stored approval digest internally. A future contract update can also require the displayed digest explicitly on republish.
2. The UI enabled metadata editing for unpublished submissions, while the backend accepts edits only while pending. The bounded correction keeps unpublished snapshots read-only. Changed artwork or metadata needs a new submission and review.
3. Review-event inserts ran after state changes. A failed insert could leave a completed decision without its audit event. The bounded repair now persists the guarded transition and corresponding event atomically. R2 preparation remains outside the database transaction and retains existing cleanup/race protections.

These repairs are complete locally and preserved by the expanded implementation. The existing local test evidence is in [gallery validation](gallery-validation.md); the completion note below records bounded corrections separately.

## Human review screen

Default to pending submissions, oldest first, with a stable `(createdAt, id)` cursor and 24 rows per page. Each row shows thumbnail, maker and blend, edition, age, state and mapping-needed status. Filters cover lifecycle state and mapping needed; add maker/blend search with bounded queries and supporting indexes. Show queue totals only to the human reviewer. Loading a new filter cancels stale requests and resets pagination/selection.

Selecting a label presents:

- Canonical full-resolution artwork, separate thumbnail preview, zoom/open controls and an image-loading failure state that disables approval. Image URLs remain private, use `no-store`, and Blob URLs are revoked when replaced or closed.
- Submitted identity beside the permanent catalog match; edition, package, variant and description. Show stable catalog ID and published identity snapshot where applicable. Unknown tobacco requires a catalog update through the existing catalog process; agents cannot create catalog entries.
- Finished dimensions, bleed, safe area and blank writing-area geometry. These are inspection information, never overlays added to generated or printed artwork.
- Raw uploaded hash, canonical artwork hash, metadata hash, approval digest and validator/format version, clearly distinguished. Show what validation checked and what still needs visual judgment. A matching hash proves byte integrity, not authorship, packaging fidelity or permission to share.
- Reference URLs rendered as text and explicit links with `noreferrer`. Do not fetch or embed them automatically. A manually opened reference can be compared alongside the label.
- Advisory recommendations and a timeline of saved corrections, review decisions, agent activity and cleanup outcomes. Show version, actor type, time and reason. Separate current recommendations from stale ones.

Saving pending metadata increments the submission version and changes its digest. Clear the review checkbox after every save, reload, selected-image change or conflict. Approval requires a loaded image, valid catalog mapping, saved metadata, review acknowledgement and exact version/digest. A 409 requires reloading and reviewing again; never retry a decision automatically with a new version.

Reject uses the existing reason codes. Unpublish immediately removes subsequent public access and shows its deletion deadline. Republish applies only to the unchanged approved snapshot before retention expires, with assets present and publication enabled. There is no bulk approval or agent approval in v1. Already-downloaded copies cannot be recalled.

Expose cleanup waiting/failed counts, last successful run, oldest overdue deadline and redacted per-item state. Distinguish scheduled deletion from completed deletion. The screen must not recover expired private content merely to display history. Operational pause flags remain documented operator controls; a new delete or maintenance-execution UI is out of v1 scope.

## Identities and permissions

Human reviewer: `dylan@enablement.engineering`, bound to the verified Access user subject in the release configuration. Keep the existing human JWT verifier and human application audience. Do not add service tokens to that application's policy.

Implemented machine boundary, awaiting hosted configuration: a dedicated Access application for `/api/gallery/v1/agent/*`, with a distinct `GALLERY_AGENT_ACCESS_AUD` and Service Auth policy selecting named per-agent service tokens. Machines send the service-token headers on each request. Cloudflare documents this header pair, Service Auth policy, and secret rotation. [Service-token documentation](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/)

The Worker independently validates the signed assertion against the configured issuer, machine audience, RS256, expiry and application-token type. A service-token assertion identifies its client ID in `common_name` and has an empty `sub`; do not use the human subject verifier for it or trust a raw client-ID header. [Application-token claims](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)

After JWT validation, load an active D1 grant for that verified client ID on every request. Check expiry, revocation, scopes and submission restrictions without caching authorization. A signed token by itself grants no application permissions. Missing configuration or grant storage fails closed. Existing workers.dev/alternate-host access must pass the same Worker verifier, and the hosted test must verify Access path matching and absence of origin bypass.

| Operation | Visitor | Contributor | Human admin | Agent grant |
| --- | --- | --- | --- | --- |
| Read published gallery | Yes | Yes | Yes | Yes |
| Submit selected artwork | Explicit challenge/upload flow | Same | Same | No machine intake scope |
| Read submitted private record | No | No contributor status/preview route | Read through admin | Granted pending records only |
| Read private queue, metadata and images | No | Own record only | Yes | Restricted by explicit scopes and selection |
| Append recommendation | No | No | No machine impersonation | Yes, for current permitted pending version |
| Edit pending shared metadata | No | No | Yes | No |
| Approve/reject/unpublish/republish | No | No | Yes | No |
| Manage grants or view audit | No | No | Yes | No |
| Delete stored artwork | No | No direct deletion | Existing retention process | No |

Default grant: one named agent, 30-day maximum application expiry, `queue:read`, `submission:read`, `artwork:read`, `recommendation:write`, and a human-selected list of at most 50 pending submission IDs. Queue discovery reveals only those records. Broader access to all pending submissions is a separate explicit grant choice, never an implicit wildcard. Non-pending content is denied by default even if it was previously selected. Scopes can be reduced individually.

Create/rotate Cloudflare tokens through the existing account administration workflow, with secrets delivered to a trusted local credential store. The gallery UI registers the non-secret client identity, label, scopes and restrictions, and can revoke its D1 grant; the app need not hold a Cloudflare management token. Rotation normally replaces the credential and verifies the new client works before retiring the old one. For suspected compromise, revoke the D1 grant first, then revoke/replace the Cloudflare token; already-issued assertions cannot bypass the D1 check. If retaining the client ID during secret rotation, keep the application grant disabled until the credential/session exposure is resolved.

Keep credentials out of prompts, source, browser storage, query strings, shell history and logs. A trusted local HTTP client injects headers from its secret store. Do not forward credentials across redirects. Human cookies and contributor capabilities are never accepted as machine authorization.

## HTTP contract additions

All paths below are relative to `/api/gallery/v1`. These additions exist locally; their hosted availability is not established here. Reuse shared read projections and validation helpers behind distinct human and machine route guards.

| Method and path | Contract |
| --- | --- |
| GET `/agent/submissions` | Scoped pending queue, opaque bounded cursor, max 24; no global counts |
| GET `/agent/submissions/:id` | Allowlisted review DTO with version/digest, catalog identity, geometry and validation; no capability, IP/quota fields, bucket keys or private pack notes |
| GET `/agent/submissions/:id/artwork` or `/thumbnail` | Authenticated bytes, current visibility/grant check, `no-store`; no public or signed bearer download URL |
| POST `/agent/submissions/:id/recommendations` | Strict typed body bound to current pending version/digest, idempotency key; append only |
| GET `/admin/submissions/:id/recommendations` | Human view of current and stale recommendations |
| GET `/admin/submissions/:id/history` | Paginated redacted audit and lifecycle events |
| GET `/admin/operations` | Retention and cleanup status, no arbitrary job execution |
| GET/POST `/admin/agent-grants` | Human lists/registers scoped client grants with expiry |
| POST `/admin/agent-grants/:id/revoke` | Human version-guarded revocation, audited |

Retain existing human admin endpoints. Machine routes do not alias human actions. Refactor the current global same-origin mutation check only enough to dispatch the dedicated machine namespace through its header-based verifier; preserve it for browser/admin/contributor mutations. No permissive browser CORS or credential-cookie fallback for machine requests. Unknown actions and methods remain denied.

Implemented recommendation body: `schemaVersion: 1`, `expectedVersion`, `digest`, `idempotencyKey`, `assessment` (`ready-for-human-review`, `needs-attention`, `unable-to-assess`), and up to 10 findings. Each finding has a typed category (`catalog-match`, `duplicate`, `artwork`, `writing-area`, `geometry`, `reference`, `sharing-concern`), severity (`info`, `warning`), bounded plain-text explanation and optional evidence pointers. Pointers reference the reviewed image/region, a metadata field, or an already supplied reference URL; duplicate IDs must be readable by that grant or already public. Optional suggested catalog ID is an existing ID, not an instruction to mutate it. Reject unknown fields, markup payloads beyond text limits, oversized bodies and arbitrary attachment URLs.

Server supplies actor and timestamp. A 409 rejects stale version/digest or no-longer-pending submissions. Recommendations do not increment the submission's review version. Store append-only records; repeated identical idempotency keys return the existing result, different bodies with that key conflict. New recommendations can supersede prior ones by reference without overwriting history. Display all agent text as untrusted plain text, label it advisory, and never let it set the review checkbox or pre-authorize a decision.

## Persistence, audit and privacy

Versioned gallery migrations add grants, grant-to-submission assignments, recommendations and expanded audit/maintenance status. Local Wrangler migration execution is a release gate; a previous successful unit run does not prove a rewritten migration applies. Grant records hold non-secret client identity, scopes, restrictions, expiry, revocation, creator and version. Recommendations hold server actor, submission/version/digest, schema version, typed result, body hash, timestamp and idempotency key. Use unique constraints for retries and indexes for scoped pagination.

Human state changes and their events must commit together using a tested D1 batch/transaction design with guarded transitions. A conflicting transition must write neither success state nor success event. Publication can prepare R2 objects first, then commit its final guarded transition and audit event together; orphan handling covers failed preparation. Recommendation insertion and its audit event must likewise be atomic. Record before/after versions and digests, action, actor type/ID, reason code and request ID. Do not copy full private metadata into permanent audit records.

Audit machine reads at the record/image level as well as recommendations, grant changes, denials and rate-limit events. Do not log JWTs, service secrets, capabilities, image bodies or query text. Bound storage and aggregate repeated denials. Record IDs and result codes suffice for operational events. Preserve existing retention deadlines: recommendation text/evidence is private submission content and must be purged with that content; retain only minimal action metadata for the existing receipt window. Expired content stays inaccessible even if cleanup is delayed. Published approval history may retain minimal actor/action/digest provenance while the publication exists.

Implemented initial limits per grant: 60 metadata reads/minute, 10 image reads/minute and 6 recommendation writes/minute; additionally 100 full images and 100 recommendations/day, 32 KiB request bodies, 1,000 characters per explanation, 4 KiB total UTF-8 explanation text, four evidence pointers per finding, 10 findings, and 10 recommendations per submission/version/agent. Use shared persistent quota enforcement for hard daily limits and atomic append limits; return 429 with retry guidance. Keep existing intake quotas separate. Tune from measured staging traffic rather than advertising these as Cloudflare plan limits.

Artwork, metadata, reference pages and agent recommendations are untrusted data. Instructions inside them cannot authorize tool calls, credential access, reference fetching, code execution or publishing. The integration guide must state that analysis is limited to the granted records; references are opened only through a deliberate trusted action, never a URL-fetch loop driven by the artwork.

Authenticated image access still lets an agent copy private bytes. The grant screen and contributor notice must explain that authorized review tools can process selected submissions. Default integration runs locally; no automatic third-party model upload. Use of a remote model requires an explicitly selected, disclosed provider/data arrangement and appropriate contributor notice before enabling it. Access credentials never go to that provider. Revocation prevents future retrieval; it cannot erase copies already obtained, so the client must purge temporary images and respect retention. No new model spending is required by this design.

## Implementation phases and remaining acceptance

1. **Completed prerequisite: contract repair and audit reliability.** Backend owner (`worker/gallery/**`, gallery migrations) and UI owner (`src/components/gallery/**`) aligned republish and pending-only edits and added atomic audit transitions. Keep regressions for the actual UI republish request, read-only unpublished metadata, concurrent reviewers and injected event-write failures, including duplicate approval and failed R2 preparation. The optional explicit republish digest remains a future coordinated API/UI change.
2. **Implemented locally: human review DTO and screen.** Backend exposes complete allowlisted validation/history/operations projections; UI adds the queue and detail panels. Catalog/assets owner confirms canonical hashes, geometry and permanent-ID semantics. Test keyboard/focus flow, image failure, stable pagination, metadata-save invalidation, stale request cancellation, no automatic reference requests and accessibility. Keep original ZIP import/print behavior unchanged.
3. **Implemented locally: machine authentication and permissions.** Backend adds grants and dedicated routes; release owner prepares separate Access config with agent access disabled by default. Test valid signed fixtures, forged/expired/wrong-issuer/wrong-audience tokens, human/machine audience swaps, missing/unknown/revoked/expired grants, direct Worker bypass and scope restrictions on every read. Prove all human mutation endpoints reject machine credentials even when the caller supplies a same-origin header.
4. **Implemented locally: recommendations and integration guide.** Backend adds strict schema, quotas, idempotency and atomic audit. UI shows advisory/stale results. Test metadata changes during analysis, rejection/expiry during image reads, concurrent revocation, duplicate retries, forged actor fields, unavailable storage, limits and prompt-injection strings rendered inert. A trusted client fetches one permitted image, submits a recommendation, and fails to approve it. Human approval remains a separate exact-version action.
5. **Staging proof complete; production proof remains: hosted configuration and checks.** Provision separate staging identities/resources under the release plan; use synthetic labels and disposable machine grants. Verify real Access JWT claims and routing, token revocation, private image denial, unchanged human login and full human approval/unpublish/republish. Do not use personal Downloads packs outside local testing without authorization. Run relevant unit/API/browser tests, typecheck/build and lint; only claim hosted readiness once this proof passes.

The default local client uses an external owner-only credential file and downloads review images only into a private local directory; see [the agent workflow](gallery-agent-workflow.md). The release owner exercised the named service identity against a synthetic selected-record grant and revoked that grant after staging proof. Any remote-model arrangement still requires an explicit choice; none is built into the client. Broader queue access requires an explicit grant. Bulk actions, automatic moderation, an MCP wrapper and an immediate-delete UI remain outside this implementation.

## Bounded correction evidence

The existing review page now sends only `expectedVersion` when republishing, matching the backend's stored-digest guard. Unpublished metadata and correction actions are disabled while visual review and republishing remain available. Two component regressions cover the exact request and disabled controls.

The earlier review correction covered contributor withdrawal before that feature was removed. Current corrections, duplicate decisions, final approval, rejection, unpublish and republish batch each state change with its event. The insert uses the preceding guarded update's SQLite `changes()` result, preventing a stale reviewer from recording a competing winner's change. Version and digest are captured within the batch. D1 documents rollback of failed batch sequences. [D1 batch contract](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)

Seven trigger-injected audit failures prove rollback and safe retry with one exact event; a competing edit/reject regression proves one success, one conflict and one event. All 228 unit tests in 39 files and the TypeScript/production build passed. That earlier 228-test checkpoint covered the prerequisite repair. The expanded implementation has subsequent local evidence below; neither checkpoint identifies a hosted release.

## Dedicated admin-host integration

The configured production reviewer hostname is `admin.tintocellar.com`; staging uses `admin-staging.tintocellar.com`, separate from the public staging host `gallery-staging.tintocellar.com`. `GALLERY_ADMIN_HOST` drives the Worker guard. Private human and machine APIs return 404 on other hosts when configured. Public `/admin/gallery` redirects to the configured HTTPS admin root without forwarding query data.

Protect the entire admin host with the human Access application. A more-specific `/api/gallery/v1/agent/*` machine Access application has its own audience and Service Auth policy. Every admin HTML/static asset request is independently human-JWT guarded by the Worker; machine requests enter only their dedicated verifier. Public contributor and unrelated API routes are denied on the admin host. Worker-first asset routing covers every path. With no admin-host setting, the existing localhost harness remains available.

The admin root renders a minimal review shell with an explicit link to the public site, avoiding the prompt/import/printing navigation. The agent client only permits the two exact admin hostnames, refuses redirects and has no human mutation commands. The release generator emits portable and local configs, keeps agent access disabled, and requires a target-specific admin host plus a distinct optional machine audience.

## Expanded local evidence checkpoint

The release owner reports **258 unit tests passed before the subsequent migration rewrite**, **two mocked browser/accessibility tests passed**, and **one real local Wrangler agent workflow test passed**. These are distinct checkpoints: mocked browser tests cover interaction/accessibility, while the Wrangler test exercises local storage/runtime behavior. The backend owner subsequently reports the pure-SQL parser repair, 53 focused backend tests, a real Wrangler statement-splitting regression, and all three staging migrations applied by the release owner. Treat those as separate migration checkpoints; those earlier checkpoints are superseded by the current staged proof in the release report.

The root integration independently passed 36 focused routing/generator/App tests plus six trusted-client tests, TypeScript checks and scoped lint. Client tests cover exact host restrictions, redirects, credential-safe errors, recommendation validation, padded cursor compatibility and private local files. No test supplies a production bypass in the deployed Worker. Fresh staging human sessions, selected service-token access and hosted denial/revocation have now passed; production remains unreleased.

## Current submission simplification

The user removed contributor private links and withdrawal controls. Successful upload ends with “Submitted for review.” The internal same-tab nonce exists only for reservation/upload retry; there is no post-submission contributor management surface. Admin rejection/unpublishing and retention remain, including cleanup of historical withdrawn records. Fresh staging OTP login, queue/detail and full-resolution 2048px image viewing have now passed; selected-machine reads/advice, human publication/unpublish and grant revocation have also passed. Production is not released. Earlier withdrawal evidence above describes the retired flow.

Current release checkpoint: the simplified flow passes 260 unit tests in 42 files, lint, the 448-module build, all 20 historical protocol versions and all three updated local end-to-end flows. Hosted staging proof and remaining deployment boundaries are recorded in gallery-release-status.md and gallery-validation.md; no production release is claimed here.
