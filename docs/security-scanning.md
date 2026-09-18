# Security scanning

The `CodeQL` job in `.github/workflows/deploy.yml` analyzes JavaScript and TypeScript on pull requests targeting `main`, pushes to `main`, and manual workflow runs. Deployment depends on this job as well as the existing test jobs. There is no scheduled deployment or separate scan workflow.

## Scope and permissions

CodeQL uses `security-extended` queries and `build-mode: none`. It scans checked-out source, including the application, Worker, and JavaScript scripts, without path exclusions. It does not install npm packages or run repository build scripts. The ignored generated validator modules are consequently absent from this scan; their generators are source, and the separate build and test jobs validate their output. This scan does not establish that generated bundles, dependencies, or runtime behavior are vulnerability-free.

The job grants only `contents: read`, `actions: read`, and `security-events: write`. It has no production environment or Cloudflare credentials, and checkout does not retain credentials. PRs use `pull_request`, never `pull_request_target`; fork and Dependabot PRs can upload scanning results through that event without granting them a privileged base-branch token. A platform-required first-contributor workflow approval may still apply; this is separate from mandatory human PR review, which this repository does not require.

Checkout and both CodeQL action steps use immutable commit pins. The CodeQL v4 annotated tag was resolved through GitHub's API to `b96794f015dfd88f77b49b1c93e0fa7110f94c63`; checkout v4 resolved to `11d5960a326750d5838078e36cf38b85af677262`. Dependabot's existing `github-actions` configuration proposes action updates through PRs.

## Merge protection and acceptance

Require the exact Actions job check **CodeQL** once the first PR run has reported it. This blocks a failed or incomplete scan, but a successful analysis job can still upload vulnerability findings. It is not a severity gate.

The Actions check requirement was applied and verified on 2026-09-18 UTC, pinned to the GitHub Actions app. The first PR analysis reported one high-severity finding in a test HTML-parsing regex; that test was changed to use an inert DOM parser. Both CodeQL execution and results passed on revision `6540eabd5c110792ddd0dcb1fab5cf01def5ae71` in [run 35305122321](https://github.com/Enablement-Engineering/tin-to-cellar/actions/runs/35305122321), with no open alerts reported for PR #16. After the first main baseline, severity ruleset 23638752 was activated and read back on 2026-09-18 UTC, requiring CodeQL results and blocking high-or-greater security alerts and error-level alerts.

After the first analysis, verify GitHub's separate **Code scanning results / CodeQL** result and configure a code scanning ruleset for CodeQL, blocking `high` or greater security alerts and `error` alerts. GitHub's default result-check thresholds match those levels, but a ruleset explicitly requires the tool and completed results. This configuration is separate from an ordinary required status check, and must be verified in repository settings rather than inferred from workflow YAML. No mandatory human approval is needed.

The first scan introduces a baseline: review all branch alerts in Security, including findings outside the PR diff. GitHub's PR alert protection applies to findings on changed lines, so a green PR check does not settle existing findings. Record fixes or justified dismissals, and do not label the repository clean solely because this job succeeds. Keep default setup disabled when using this advanced workflow to avoid conflicting analysis configurations.

Local workflow validation cannot run GitHub's hosted analysis or prove SARIF upload permission. Before release, confirm `CodeQL` completed and results were processed on the current PR revision, inspect the first baseline, verify the configured severity rule, and record the scan link. The main-branch deployment dependency gates scan execution only; severity enforcement belongs to the protected PR merge.

## First main baseline review — September 18, 2026

The first main analysis on `e876b85` reported nine findings outside the original PR's changed-line results. Deployment was cancelled before upload while they were reviewed. This illustrates why a passing PR result is not a repository-wide clean bill.

- Alert 2 identified an import-preview MIME gap: filename-based PDF detection preserved an incoming HTML MIME type in a blob link. PDF.js accepted an HTML/PDF polyglot in a local probe. Accepted PDFs now receive an `application/pdf` Blob before link creation, preserving the original bytes. A regression checks the MIME, bytes and URL cleanup. No CSP bypass was demonstrated.
- Alert 3 was dismissed as a false positive: `ReviewEditor` renders its reference link only after `publicReference` parses and accepts exactly HTTPS, without credentials or unsafe characters.
- Alerts 4 and 5 were dismissed as false positives for security: the URL substring regexes select local catalog naming/exclusion rules, not network authorization. Exact URL parsing remains a possible data-quality improvement.
- Alerts 6–9 were dismissed as false positives: these explicit local CLI tools intentionally store fetched content. Diagnostic output names are fixed literals, and gallery pack filenames use IDs validated by an anchored hexadecimal/dash-only pattern. Remote contents cannot select arbitrary paths.
- Alert 10 was dismissed as a test artifact: permission assertions and reading synthetic bytes in a private temporary directory do not form a production check/use boundary. Actual output creation uses exclusive creation and refuses symlinks.

Each dismissal has a specific explanation in GitHub. Re-evaluate if these trust boundaries change. Alert 2 remains subject to analysis of the MIME fix; do not equate these dismissals with proof that all code is vulnerability-free.

## References


- [CodeQL action permissions and build modes](https://github.com/github/codeql-action/blob/main/README.md)
- [Workflow configuration options](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options)
- [Dependabot and read-only token uploads](https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/resource-not-accessible)
- [Code scanning merge protection](https://docs.github.com/en/code-security/concepts/code-scanning/merge-protection)
- [Configure required tools and severity thresholds](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/manage-your-configuration/set-merge-protection)
