# Opt-out analytics investigation

September 16, 2026. Audience confirmed by the owner: US and international users. Reviewed deployed-source revision `54d4702`. This is an implementation and product assessment informed by regulator guidance, not a determination of every law applicable to the operator. No collection, account, or deployment settings were changed.

## Recommendation

Keep explicit opt-in for browser analytics as the worldwide default, and put the choice directly in the app. Supplement it with bounded statistics from requests the service already handles. Opt-out remains a possible regional design for a narrower event set after a documented exemption assessment. The evidence does not support simply enabling all current streams by default worldwide.

This revises the earlier provisional recommendation to favor opt-out for basic counts. Minimal payloads make that design a better candidate for an exemption; they do not establish an exemption across the intended audience.

## What the implementation measures

| Stream | Information sent | Assessment |
| --- | --- | --- |
| App actions and problems | Version, fixed event name, fixed outcome; aggregated by UTC day | Best candidate for a limited statistical exemption. Still deliberate browser instrumentation. Counts actions, not visitors. |
| Label demand | Canonical catalog IDs, action, and print quantities; aggregated by day and blend | Useful for artwork prioritization, but reveals more specific tobacco interests in each incoming request. Keep separately optional. This is not evidence of consumption or a diagnosis. |
| Request progress | Starting week, milestone, broad elapsed-time range | Matches requests locally for up to 30 days using request, row, collection and design identifiers. IDs stay local, but this is still measurement-specific device storage/access. Keep opt-in. |
| Existing operations | Bounded route class, response status, duration and cache outcome | Can describe service reliability and gallery requests without adding client telemetry. Cannot observe local copy, ZIP checking or printing. |

Evidence: `src/lib/analytics/events.ts`, `schema.ts`, `client.ts`, `preferences.ts`, `progress.ts`; `worker/analytics/usage.ts`, `index.ts`; `worker/operations.ts`.

The client omits credentials and referrers and has no automatic retries or offline queue. D1 stores aggregate rows, not event histories or visitor IDs. IP addresses still reach the hosting service and are used for rate limiting. These protections do not justify saying that the entire processing chain is anonymous. Account-level security logs, exports, provider retention and processing terms were not inspected during this investigation.

## What the primary sources establish

- **UK:** the statistical-purpose exception can permit service-improvement measurement without prior consent when its conditions are met, including clear information and an easy, free way to object. It is limited by purpose, aggregation, retention and provider use. It can cover aggregate journey analysis; a 30-day local matching window is neither automatically permitted nor automatically forbidden. Its necessity needs justification. [ICO exceptions guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/)
- **France:** an audience-measurement exemption exists for restricted purposes and anonymous statistics, with limits on linkage and reuse. It requires an assessment of the actual configuration. [CNIL guidance, July 2025](https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience). Its self-assessment proposes aggregation and display rounded to tens, or a documented alternative anonymity analysis. Exact small blend/day and progress cells merit scrutiny; rounding alone is not a universal guarantee. [CNIL self-assessment, page 4](https://www.cnil.fr/sites/default/files/2025-07/outil_d_auto-evaluation_mesure_d_audience.pdf)
- **Ireland:** the DPC explicitly requires consent for analytics cookies, including first-party analytics. That FAQ alone does not classify every possible cookieless counter, but it disproves a uniform European analytics-cookie exemption. [DPC FAQ](https://www.dataprotection.ie/en/faqs/cookies/do-i-need-consent-analytics-cookies)
- **Germany:** DSK guidance distinguishes simple counters from richer behavioral analysis and requires assessment of the exact configuration and purpose. The label "audience measurement" is insufficient. [DSK guidance, November 2024, paragraphs 87–90](https://www.datenschutzkonferenz-online.de/media/oh/OH_Digitale_Dienste.pdf)
- **EU technical scope:** browser-local processing followed by transmission can still fall within device-access rules. No cookie, no transmitted identifier, or immediate server aggregation is not a blanket escape. Applicability of those rules and eligibility for an exemption are separate questions. [EDPB final guidelines 2/2023, paragraphs 52–56](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf)
- **US:** California's sale/sharing opt-out and notice rules are not interchangeable with European device-access consent. Business applicability, service-provider arrangements and other state rules need their own assessment. This investigation does not establish that Tin to Cellar is exempt from US obligations. [California Attorney General CCPA overview](https://oag.ca.gov/privacy/ccpa)

Legitimate interests for personal-data processing would not itself remove a separate device-access consent requirement. Hosting in the US also does not resolve the intended international audience's requirements.

## Practical next step

Offer a nonblocking choice in the workspace, including direct-entry pages, before optional measurement starts. A basic-count prompt could say:

> Help improve Tin to Cellar by sharing counts of app actions and problems. These counts exclude your files, prompts and blend names.
>
> Allow basic counts · No thanks · Data choices

This proposed wording requires separating basic counts from the richer streams first. It must not enable catalog demand or request matching under a generic basic-count choice. Give those streams their own explanations and choices, and make all choices easy to revisit. Dismissing the prompt should leave collection off. Preserve refusals without repeatedly asking.

Use the existing operations evidence alongside consenting-browser analytics. Repository configuration samples explicit operational logs at 10%, so these logs are not exact totals. Describe a gallery pack response as a pack served, not an import or a printed label. Do not add measurement pings and call them server-only statistics. Existing automatically shared import diagnostics have a separate purpose and denominator; this review does not certify or expand that processing.

An international opt-out alternative would need jurisdiction-specific eligibility, appropriate defaults where eligibility is unknown, and verification of provider behavior. IP-derived country alone does not establish which laws apply. That complexity is difficult to justify before testing a visible opt-in choice.

## Changes needed if a limited opt-out design is pursued

1. Split stream preferences and server capabilities. `ANALYTICS_ENABLED` currently both acts as master switch and enables demand. Basic-only server activation therefore needs an independent demand gate or equivalent explicit capability separation.
2. Preserve existing `usage-choice-v2` refusals and the older `tin-to-cellar:aggregate-demand=off` when no newer valid decision supersedes it. The current reader ignores the legacy key safely because its default is off; that would become unsafe under default-on. Preserve compatible opt-out signaling to already-loaded older clients. Invalid or unavailable storage should remain off.
3. Keep progress consent generations, Web Locks, expiry and cross-tab cleanup intact. A missing preference must not create progress records. Check writable storage before claiming that an automatic default always permits a durable opt-out.
4. Consider honoring GPC and DNT as product privacy preferences, including server checks for stale clients. These signals currently have no handling here. This recommendation is not a claim that they universally prohibit first-party statistics by law.
5. Show the notice before the first measured action and update Privacy, the shared preference UI, importer/help copy and admin descriptions together. Current copy explicitly promises "off until you choose."
6. Test migration, blocked storage, cross-tab and mixed-version behavior, independent stream gating, privacy signals, strict payloads and immediate stopping of future sends. Already-sent requests cannot be recalled.
7. Review authenticated reporting, Cloudflare logs/settings, abuse limits, retention and the proposed exemption before activation. Update `wrangler.jsonc`, release preparation and production smoke assertions together. Keep v1 config false and ingestion no-write.

## Data usefulness and limits

Broader collection would improve coverage but would not create user counts or identify abandonment. If basic events and progress use different choices, never divide progress imports by generic instruction copies to report completion. Progress comparisons must use their own starting cohorts and observation window, and remain affected by lost receipts, changed requests and opt-out.

All streams share 1,000 daily admissions, not 1,000 people. A sequence that emits 10 events consumes 10 admissions. Default-on basic counts could exhaust the allowance and suppress richer milestones. Quota-limited observations are not a random sample. Record any policy change as a break in comparability rather than interpreting the resulting count increase as app growth.

## Independent review and verification scope

The technical and data-usefulness critics considered unlinked action/error counts the best opt-out candidate, conditional on an applicable exemption. Both recommended separating richer measurement and preserving refusals. The privacy critic recommended global opt-in because the international exemption case is not established. The recommendation above reconciles those findings rather than treating technical feasibility as legal clearance.

Critics inspected the implementation checkout at `07059a1`; the primary review checked current main and verified that the relevant runtime modules and release controls were unchanged at `54d4702`. Only test storage setup differed in the compared analytics files. This was source review and primary-source research. No new runtime tests were necessary for this documentation-only investigation, and no authenticated Cloudflare account review or legal sign-off occurred.
