# Usage analytics critic review

September 16, 2026. Three independent critic agents reviewed the [implementation plan](usage-analytics-implementation-plan.md), using the existing application and Worker code. The coordinator checked the material findings and revised the plan. This is a design review; no application code, collection setting, database, or production behavior changed.

## Verdict

Keep the aggregate-only approach and the private admin Usage page. The original plan needed two activation/reporting blockers fixed: legacy clients could bypass the new explicit choice, and successful event totals could not show when the request allowance was exhausted. The revised plan closes those specification gaps and narrows what its reports claim.

The largest product limitation remains: separate aggregate counts cannot establish that someone copied instructions and never returned. This plan measures received activity and reported friction, not adoption, retention, or individual abandonment. A few observed user sessions or voluntary feedback are the next evidence source for that question.

## Technical requirements and reliability critic

| Finding | Why it matters | Disposition |
| --- | --- | --- |
| P1: legacy config could awaken old implicit-permission clients | The existing client permits collection with no saved preference and reads only the old `enabled` boolean. New preference code cannot control an already-loaded old bundle. | Accepted. Keep legacy config false and legacy ingestion no-write; use explicit version-2 config and ingestion for updated clients, including mixed-tab and rollback tests. |
| P1: accepted counts do not measure allowance exhaustion | Admission is consumed before canonical validation and storage success. A day can exhaust its allowance with zero recorded events, and the existing singleton loses that day's state on rollover. | Accepted. Persist daily admitted counts and allowance-reached state atomically with reservation; record successful totals separately with counter writes. Preserve nonrefundable admission. |
| P2: zero-event dates have no historical availability evidence | Current flags and a first received event cannot establish whether collection ran on a quiet date. | Accepted using the smaller option: show historical availability as unknown and label zero as “0 received.” Defer a release-owned configuration journal until it is needed. |

Evidence: [legacy permission default](/Users/dylanisaac/Projects/tin-to-cellar/src/lib/analytics/client.ts:11), [config consumption](/Users/dylanisaac/Projects/tin-to-cellar/src/lib/analytics/client.ts:38), [admission and downstream writes](/Users/dylanisaac/Projects/tin-to-cellar/worker/analytics/index.ts:22), and [scheduled cleanup](/Users/dylanisaac/Projects/tin-to-cellar/worker/index.ts:25).

## Privacy and truthful controls critic

| Finding | Why it matters | Disposition |
| --- | --- | --- |
| P1: mixed-version consent migration | Old clients and old tabs can ignore the expanded preference record. | Same accepted compatibility cutover as the technical review; this is one shared blocker, not two independent defects. |
| P2: custom-counter shutdown and Cloudflare beacon shutdown differ | A Worker can refuse D1 writes, but its script-loading flag does not stop a beacon that is already sending directly to Cloudflare. | Accepted. Separate runbooks and admin status. Keep traffic activation gated on demonstrated, accurately described revocation/shutdown behavior. |
| P2: 365-day policy conflicts with “aggregates may be kept longer” | The existing Privacy exception could negate the new specific retention promise. | Accepted. Explicitly exclude usage/demand counters from the blanket exception; define UTC buckets, scheduled cleanup, delayed deletion, and backup limits. |

Evidence: [current aggregate retention exception](/Users/dylanisaac/Projects/tin-to-cellar/src/components/Privacy.tsx:58) and [Cloudflare's documented navigation/unload reporting and collection destinations](https://developers.cloudflare.com/web-analytics/faq/).

Additional clarification accepted: put the continued automatic sharing of import diagnostics and eligible packaging observations immediately beside analytics controls. Do not treat those reports as a way to measure opted-out users. The proposed explicit-choice default remains a product decision, not a legal conclusion.

## Data usability and product decisions critic

| Finding | Why it matters | Disposition |
| --- | --- | --- |
| The original AI-handoff abandonment question remains unanswered | Copy/import totals cannot distinguish abandonment, delayed return, repeat copying, or unrelated packs. | Accepted. Add a decision-to-evidence table and identify observed sessions/voluntary feedback as the missing evidence. |
| Local pack saves and gallery saves have unequal units | One local save may contain twenty labels; twenty gallery saves may produce the same number. | Accepted. Name and explain the units, prohibit source-share percentages, and defer additional per-label volume collection. |
| Demand alone is not unmet artwork need | Adds include both new requests and existing-gallery selection; prints favor already available artwork. | Accepted. Join current eligible published-artwork availability into the private table and add a “No currently published artwork” filter. Label availability as current, not historical. |
| Print preparation can fail before a print event exists | The existing preview-error state prevents the success/request events the plan intended to count. | Accepted. Measure a fixed result at an explicit attempt to open print preparation, including preview unavailable. Do not count render loops or claim coverage of all asynchronous/physical printing failures. |
| Partial days and small samples make trend displays misleading | Missing hours, collection limits, opt-in changes, and a few repeated actions can look like a product trend. | Accepted. Initial release shows counts and known limitations, with no automatic percentage comparisons/trend arrows. Later comparisons require completed periods and explicit denominator/availability rules. |
| Root-cause analysis already has a diagnostics workflow | Coarse optional events cannot replace versioned, source-traceable diagnostic findings. | Accepted as a small explanation/runbook link from Problems. Do not build another diagnostics system or mix its denominators with optional events. |

Evidence: [pack/gallery save boundary](/Users/dylanisaac/Projects/tin-to-cellar/src/hooks/usePackImport.ts:53), [single gallery-design processing](/Users/dylanisaac/Projects/tin-to-cellar/src/hooks/usePackImport.ts:89), [print-state handling](/Users/dylanisaac/Projects/tin-to-cellar/src/PublicApp.tsx:195), and [existing diagnostics analysis design](/Users/dylanisaac/Projects/tin-to-cellar/docs/diagnostics-improvement-plan.md:88).

## Scope and decisions still visible

- Explicit choice is the recommended default for broader collection. It will produce a self-selected sample; the admin page must say so. Do not claim the plan measures total adoption.
- Keep the existing daily allowance initially, with accurate admission and missing-data reporting. Review capacity using staging evidence before raising it. Do not fix sparse data by silently collecting more personal information.
- Keep Cloudflare Web Analytics independently deferred until its controls work. The D1 Usage page does not depend on it.
- Keep 365-day usage retention as a proposal. Existing aggregate expiry must be included in implementation authorization before deleting older records.
- Defer session identifiers, source-volume dimensions, CSV export, embedded Cloudflare charts, automated artwork prioritization, and statistical significance machinery.

## Review acceptance boundary

All three critics performed a closure pass and confirmed their findings resolved at the design level. The data critic's final wording correction was also applied: the outcome asks what collection availability is known, and ordinary loading/empty/needs-artwork states are not labeled defects. Local document links and whitespace are checked separately.

The plan now specifies the critical corrections. Implementation still needs the tests, browser observations, authenticated-host checks, and privacy/abuse evidence listed in the plan. No critic review is evidence that collection is enabled, the policy is deployed, or production checks have passed.

## Implementation review, September 16

The earlier sections record the design review against base `b08526f`; their line references describe that baseline. The user subsequently authorized implementation, including browser-local request matching. The current implementation plan supersedes the initial proposal.

The same three critics performed read-only implementation reviews. Material findings and fixes:

- Keep the fulfilled target revision with each partial local match. Changed requests can no longer complete the older request or its print milestone.
- Associate local attempts with the current consent generation, filter every read/write, and serialize opt-out cleanup behind existing Web Locks. Compare that generation immediately before dispatch, including when consent changes after matching has started.
- Count published artwork independently of a retired catalog entry, matching public gallery behavior.
- Derive current-day admission blocking from today's admissions and the current allowance, including a reduced or zero allowance. Keep historical observed exhaustion separate.
- Include whole intersecting starting weeks, with a separate cohort range. Exclude expired boundary cohorts from the 365-day report even before cleanup succeeds, and explain that omission.
- Explicitly limit failure reporting to workflow stage and known ZIP outcomes. Underlying capacity/conflict/network cause classification is deferred.

All three critics confirmed closure of their material findings after the fixes. Their closure was source/test review, not production verification. Regression tests exercise each corrected edge case. Chrome accessibility checks also found and prompted a fix for keyboard access to horizontally scrollable tables.

Production collection remains off. The implementation does not create a Cloudflare traffic beacon or change account settings. Browser matching improves the aggregate progress evidence but still cannot establish individual abandonment or the AI provenance of imported artwork.
