# Tin to Cellar implementation boundaries

- Use npm for package management and scripts.
- Keep the application local-first. Importing a pack must not upload files or automatically fetch provenance URLs.
- Render untrusted manifest text as text, never as HTML.
- Preserve the separation between label artwork geometry and printer sheet geometry.
- Generated artwork owns the entire blank date-writing surface. The website must not add words, lines, or date overlays.
- Do not commit generated build output or dependency directories.
- Run the most relevant tests, typecheck/build, and lint for changed areas.
- Deploy production through the current `origin/main` release workflow. Older worktrees and generated release configurations can overwrite newer privacy and budget controls. Integrate changes onto current main before release; after deployment verify the protected budget endpoint as well as health. Coordinate concurrent release tasks.

## Shared module ownership during the initial parallel build

- Prompt agent: `src/lib/prompt/**`, `public/agent/**`, and prompt-focused tests.
- CellarPack agent: `src/lib/cellarpack/**`, `src/lib/sheets/**`, `public/spec/**`, and format/validator tests and fixtures.
- Website agent: `src/components/**`, `src/styles/**`, `src/App.tsx`, `src/main.tsx`, UI tests, and public presentation assets.

Do not edit another agent's owned paths. Coordinate through exported interfaces and leave integration notes when an interface is not yet available.
