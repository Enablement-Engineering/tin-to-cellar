# CellarPack maintainability follow-up

Reviewed against main `5b6765f` after the code-quality cleanup. The older description of a roughly 650-line importer predates that cleanup.

## Findings reported before changes

| Severity | Finding | Resolution |
| --- | --- | --- |
| Medium | `JSON.parse` silently overwrote duplicate manifest and sheet-profile keys; custom profiles also omitted the documented depth limit. This violated the artifact contract and could let different consumers interpret the same input differently. | Shared `cellarpack/json.ts` decodes UTF-8, checks depth and duplicate keys, and returns `unknown`. Callers retain their existing structured errors: fatal `INVALID_MANIFEST_JSON` for the manifest, warning `INVALID_SHEET_PROFILE` for optional profiles. |
| Low | `CellarPackImportResult.manifest` was easy to mistake for fully verified content. It contains schema-checked metadata, including labels subsequently quarantined. Existing consumers correctly use `result.labels` for usable artwork. | Documented the distinction on public result types and added artifact regression coverage showing that metadata and agent claims cannot bypass hash validation. |
| Low, unresolved contract discrepancy | The prose specification promises fallback for unknown optional enum values, but the published schema rejects them, including unknown `defaultPrintIntent.labelQuantityMode`. No general fallback or diagnostic is defined. | Preserved current behavior and published schemas. A future protocol change should define specific fallbacks or narrow that promise; silently accepting new values here would change compatibility behavior. |

## Module boundaries

- `archive.ts` and `archive-contents.ts`: archive structure, path safety, resource limits, bounded extraction, active and nested content checks.
- `json.ts`: archive bytes to untrusted JSON; no schema assertions or UI diagnostics.
- `schema.ts`: version preflight and schema validation. This establishes metadata shape, not artwork integrity.
- `geometry.ts` and `artwork.ts`: deterministic geometry, media, dimensions, decoding and hash checks. The importer only admits artwork after checking accumulated blocking issues.
- `sheet-profiles.ts`: optional printer-profile validation, independent of artwork geometry.
- `issues.ts`: blocking predicates and deduplication. Existing structured codes remain unchanged.
- `importer.ts`: orders those checks, quarantines invalid labels, and constructs the import result. These orchestration responsibilities remain together.
- `contributions`, `feedback`, and `import-workflow/prepare.ts`: separately validate agent evidence, derive local validation summaries, and prepare permitted diagnostics. Feedback extraction does not belong in the artifact validator.

## Remaining review areas

The application still owns deterministic import, collection, geometry, export and printing. External agents return artifacts; their claims do not decide local validity.

Manifest research sources, generator metadata, protocol extensions, agent feedback, local validation results, and artwork bytes remain separate. Extensions remain untrusted until their own validators accept them. Import never fetches provenance URLs. Automatic diagnostic sharing passes through an explicit bounded projection; source observations sent automatically are restricted to known catalog URLs. Packs, artwork, raw prompts and retrospective text are not part of that automatic payload. Optional process notes require a separate user action. Community artwork submission uses a separate workflow.

Standalone reports remain supported without a successful pack. They are validated locally and require the user to select Share failure report before submission. This preserves evidence of failed runs.

Version handling deliberately accepts current `0.1.x` and historical `1.x` families, including compatible minor versions. It rejects `0.2.0`, unsupported majors and malformed versions. No speculative migration or version-policy change was added. Existing archive, malformed schema, hash, geometry and partial-import fixtures remain, with additional duplicate-key, nesting-limit, version-matrix and trust-boundary tests.

Only the JSON reader is a new production module. No architecture, network flow, published schema or diagnostic code changes were needed. Invalid duplicate-key or over-depth profile inputs now receive the rejection already specified by the contract.

## Verification

- 429 tests across 63 files passed; lint and strict production build passed.
- Local Chromium import workflow passed against a fresh Worker server. Duplicate-key rejection preserved saved labels and printing, with no extra diagnostic submission or provenance fetch.
- Independent sub-agent review found no actionable defects in the JSON reader, depth semantics or error handling.
