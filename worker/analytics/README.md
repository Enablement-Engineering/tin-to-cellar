# Print intent ingestion

Collection is off unless `ANALYTICS_ENABLED=true` and the database and separate
`ANALYTICS_RATE_LIMITER` bindings exist. Configure that Cloudflare limiter for
30 requests per IP per minute. It is approximate and location-local. IP values
are passed only to that limiter; no IP, user agent, raw payload, client identity,
event receipt or event timestamp is stored by this module.

`ANALYTICS_DAILY_ALLOWANCE` defaults to 1,000 batch admissions per UTC day and
cannot exceed 1,000. Invalid values or zero disable admission. An atomic singleton
upsert reserves admission before catalog access. Failed canonical validation or
rollup writes consume admission. Dates cannot reset the counter backward. Each
admitted request has at most 100 canonical blend counters, so the ceiling is
100,000 blend-counter row mutations/day, plus up to 1,000 job-total row mutations
and 1,000 successful admission mutations. Admission attempts and catalog lookups
have additional D1 work; indexes have write overhead. This is neither a bound on
all D1 activity nor a Cloudflare billing cap.

Counters are anonymous daily aggregates. Added and selected events increment
one participation count per distinct canonical blend; quantity is counted only
at a print-job request. Job totals count a batch once; per-blend job counts count
its participation. Custom blends and inactive/unknown IDs are rejected. Aliases
resolve to canonical IDs; duplicate canonical identities are rejected. A batch
and its daily job total commit atomically. Aggregates are retained; the admission
table contains one row, not a growing request log. No public aggregate reader is
provided; the future priority report requires separate admin authorization.

The browser sends only explicit supported actions. Local import, restoration,
rendering and alignment printing must not send demand. Delivery is best effort:
no retries, offline queue or receipt storage. Repeating a valid request counts
again. Counts describe requested actions, not unique users or physical output.
Bot-originated valid actions remain possible; these counters are prioritization
hints, not audited usage totals. Endpoint failure must never block local printing.
