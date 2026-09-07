# Curated gallery intake

Use the protected **Curated CellarPack intake** in the gallery administration site for a release whose source research, artwork, and print proofs were completed outside the public contribution form.

## What it automates

1. Import one or more ready CellarPacks.
2. Reject any pack with quarantined labels, blocking validation issues, duplicate label IDs, or duplicate artwork hashes in the selected release.
3. Require an administrator to attest that the source evidence, full-resolution artwork, blank writing areas, and print-safe proofs were reviewed.
4. Upload the validated PNG through protected, bounded reconciliation. Exactly one matching published catalog identity is replaced in place, preserving its public UUID; ambiguous matches fail closed. A missing route never triggers fallback intake.
5. If the server explicitly confirms there is no matching publication, add the item to the private review queue and record a `curated-intake` audit event.

New labels still require the normal human publication action. Replacements are an explicit administrator publication action for an already reviewed release. They record a `reconcile` audit event and atomically replace metadata and all public asset pointers. Concurrent review changes, storage failures, or publication shutdown preserve the previous publication. Identity-only refresh stages a new pack and commits it with its identity snapshot in one transaction.

The server strips PNG metadata through lossless normalization and rebuilds ZIPs. Input ZIP and PNG file hashes need not equal public file hashes; verify unchanged decoded pixels and consistent canonical public artwork/manifest hashes. Imported edition and recognized variant classifications are retained rather than assuming every label depicts current packaging.

## Release verification

After publication, verify the public collection rather than relying on the deployment result alone. The release check must confirm:

- exactly one public record for each expected catalog ID;
- the approved package reference is present;
- the writing area is declared as part of the artwork;
- public artwork bytes are unique across the release; and
- every downloadable CellarPack contains the exact public artwork bytes declared in its manifest.

The community-resource release script and its evidence ledger live in `scripts/community-resources/verify-publications.mjs` and `data/community-resources/research/publications-2026-09-07.json` in the production workspace.

## Combined release recovery, September 7

The curated implementation was previously deployed from an older checkout without the budget fixes. Restoring current main exposed that the curated changes had not been merged. This integration brings intake, reconciliation, identity refresh, and the confirmed catalog corrections onto the same source as the diagnostic allowance and protocol 0.0.23.

Validation: 399 automated tests passed, including concurrent replacement, failed storage/audit writes, publication shutdown, request bounds, and UI retry behavior. All five local Worker/D1/R2 browser flows passed, including administrator intake followed by in-place public replacement and canonical artwork/ZIP verification. Build and lint passed. Release CI requires the live health response to identify both budget and curated capabilities and separately requires the protected budget route. These capability names identify implemented routes, not permission to publish or evidence that any particular artwork was accepted.
