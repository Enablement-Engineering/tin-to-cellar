# Prompt feedback

A normal CellarPack ZIP includes fixed diagnostic feedback at `manifest.extensions["tin-to-cellar:feedback"]`. Protocol 0.0.19 also requests an optional process retrospective at `manifest.extensions["tin-to-cellar:retrospective"]`. No separate download is needed for a successful ZIP.

The fixed feedback schema remains 0.2.0 with semantic-version protocol attribution. Supported original 1.0.0 reports retain their reader. The retrospective uses its own 0.1.0 schema, so an invalid or absent retrospective does not invalidate structured diagnostics or artwork. Historical releases are immutable.

The AI should report what helped, where work required retries, actual recovery results, and concrete instruction/tool improvements. The retrospective permits up to five short observations and bounded capability/tool metadata. It must not contain hidden reasoning, raw logs, transcripts, personal information, filenames, URLs, or user notes. Narrative shape/length checks cannot certify that text is free of personal information.

ZIP import automatically sends fixed feedback, recognized website validation results, and eligible source observations. The print page has a compact View shared diagnostics action and collection failure/retry status. It no longer displays the run-history panel or local comparison UI. Optional narrative stays local until the user previews and explicitly shares it. The exact structured submission and optional notes are separately visible in the inspection dialog.

A run that cannot produce a ZIP may return a strict standalone feedback report, or an envelope containing exactly `feedback` and `retrospective`. The help page and rejected-import flow expose Report a failed AI run. Opening that JSON is local; Share failure report submits fixed data, and process notes still require a separate action.

Feedback remains agent-reported evidence, not proof of artwork quality. Website validation is recorded separately, as fixed codes/counts with a validator version, never raw messages or file paths. User ratings are not implemented.

See [diagnostics operations](diagnostics/operations.md) for storage, retention, private exports, weekly Codex reviews, and release gates. See [shared source behavior](contributions.md) for reference-link handling.
