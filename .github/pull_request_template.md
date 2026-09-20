## Change

Describe the problem and resulting behavior.

## Validation

Record relevant tests and what still needs browser, hosted, assistive technology or physical print verification.

## Review findings

List AI code reviews checked on the current revision. Record each actionable finding and its fix, or the concrete reason it does not apply. Re-run affected checks after review fixes; green CI alone does not resolve review feedback.

## Migration compatibility

If schema changes are included, describe how the currently serving Worker continues to read and write after migration, how the new Worker is tested, and which rollback candidates remain compatible. Keep deployed migrations immutable. Use a later release for destructive contraction. See [deployment requirements](../docs/ci-deployment.md#schema-compatibility-across-releases).

## Release

Identify configuration or publication changes requiring a release. Integrate onto current main and use its release workflow. Record exact build, health and protected budget checks separately from local tests.
