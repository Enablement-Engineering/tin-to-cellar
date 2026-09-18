# Security scanning

The `CodeQL` job in `.github/workflows/deploy.yml` analyzes JavaScript and TypeScript on pull requests targeting `main`, pushes to `main`, and manual workflow runs. Deployment depends on this job as well as the existing test jobs. There is no scheduled deployment or separate scan workflow.

## Scope and permissions

CodeQL uses `security-extended` queries and `build-mode: none`. It scans checked-out source, including the application, Worker, and JavaScript scripts, without path exclusions. It does not install npm packages or run repository build scripts. The ignored generated validator modules are consequently absent from this scan; their generators are source, and the separate build and test jobs validate their output. This scan does not establish that generated bundles, dependencies, or runtime behavior are vulnerability-free.

The job grants only `contents: read`, `actions: read`, and `security-events: write`. It has no production environment or Cloudflare credentials, and checkout does not retain credentials. PRs use `pull_request`, never `pull_request_target`; fork and Dependabot PRs can upload scanning results through that event without granting them a privileged base-branch token. A platform-required first-contributor workflow approval may still apply; this is separate from mandatory human PR review, which this repository does not require.

Checkout and both CodeQL action steps use immutable commit pins. The CodeQL v4 annotated tag was resolved through GitHub's API to `b96794f015dfd88f77b49b1c93e0fa7110f94c63`; checkout v4 resolved to `11d5960a326750d5838078e36cf38b85af677262`. Dependabot's existing `github-actions` configuration proposes action updates through PRs.

## Merge protection and acceptance

Require the exact Actions job check **CodeQL** once the first PR run has reported it. This blocks a failed or incomplete scan, but a successful analysis job can still upload vulnerability findings. It is not a severity gate.

The Actions check requirement was applied and verified on 2026-09-18 UTC, pinned to the GitHub Actions app. The first PR analysis completed and reported one high-severity finding in a test HTML-parsing regex; that test was changed to use an inert DOM parser. Verify resolution on the updated revision. The separate severity rule remains pending a main-branch analysis baseline; do not describe it as enforced yet.

After the first analysis, verify GitHub's separate **Code scanning results / CodeQL** result and configure a code scanning ruleset for CodeQL, blocking `high` or greater security alerts and `error` alerts. GitHub's default result-check thresholds match those levels, but a ruleset explicitly requires the tool and completed results. This configuration is separate from an ordinary required status check, and must be verified in repository settings rather than inferred from workflow YAML. No mandatory human approval is needed.

The first scan introduces a baseline: review all branch alerts in Security, including findings outside the PR diff. GitHub's PR alert protection applies to findings on changed lines, so a green PR check does not settle existing findings. Record fixes or justified dismissals, and do not label the repository clean solely because this job succeeds. Keep default setup disabled when using this advanced workflow to avoid conflicting analysis configurations.

Local workflow validation cannot run GitHub's hosted analysis or prove SARIF upload permission. Before release, confirm `CodeQL` completed and results were processed on the current PR revision, inspect the first baseline, verify the configured severity rule, and record the scan link. The main-branch deployment dependency gates scan execution only; severity enforcement belongs to the protected PR merge.

## References

- [CodeQL action permissions and build modes](https://github.com/github/codeql-action/blob/main/README.md)
- [Workflow configuration options](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options)
- [Dependabot and read-only token uploads](https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/resource-not-accessible)
- [Code scanning merge protection](https://docs.github.com/en/code-security/concepts/code-scanning/merge-protection)
- [Configure required tools and severity thresholds](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/manage-your-configuration/set-merge-protection)
