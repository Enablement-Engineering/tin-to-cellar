# Prompt feedback

Each new generation prompt requests a diagnostic report at `manifest.extensions["tin-to-cellar:feedback"]`. A failed run can return `tin-to-cellar-feedback.json` separately. Older packs work without feedback, and invalid feedback does not block artwork import.

In Print labels, expand Prompt feedback to review and download a valid report. Open individual saved JSON reports there to compare outcomes and issue frequencies, then download a summary containing the validated reports and totals. Selecting a new group replaces the previous group. Reloading clears the reports. No server receives them automatically; collection consists of people deliberately sharing downloaded reports with the maintainer.

The schema in `src/lib/feedback/schema.json` allows only fixed categories and bounded integer counts. It rejects unknown properties at every level. No free-text fields, raw prompts, logs, source URLs, timestamps, pack IDs, generator names, product names or user identifiers enter the export. A malformed report is excluded entirely, never partially displayed or exported. Files are limited to 32 KiB each and 100 per selection. Treat any original agent file as untrusted; use the app's validated export for sharing.

The report records the prompt version, requested label count and shape, overall outcome, stage status and attempt counts, and categorized issues with resolution flags. These are agent self-reports, not verified quality scores. Counts reflect only the loaded sample; identical JSON reports count once, which can also collapse separate runs with identical diagnostics. Do not interpret this as a unique-user count or production success rate.

The task instructions prohibit pulling personal context into the task or report. User-entered request text is still supplied to the chosen AI provider as entered; the app cannot certify arbitrary text as free of personal information. The strict schema applies to collected feedback. It does not sanitize the complete pack, artwork, research records, or chat.

When changing the diagnostic contract, update the schema and TypeScript type, prompt version, feedback instructions, and published instruction file together. The prompt parity test guards the published copy. No CellarPack schema bump is required because feedback uses the existing optional extensions object.
