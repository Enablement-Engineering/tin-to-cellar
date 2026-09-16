# Application assets across deployments

Vite emits `app-version.json` and the `__APP_BUILD_ID__` client constant from the same build identity. Production uses `<commit>-<workflow-run>-<attempt>`; local builds get a fresh UUID unless `BUILD_ID` is supplied. The Worker serves the version document with `Cache-Control: no-store`. The AI instruction release version remains separate.

The current-main production workflow retains the hashed assets from three previous deployments alongside the current build. This lets a tab opened before a deployment request lazy modules that were not previously downloaded. It does not promise indefinite compatibility for old tabs or old clients using newer APIs.

The release sequence is:

1. Build the current source and snapshot only its hashed `dist/assets/*` files with a size and SHA-256 manifest.
2. Discover up to three prior asset artifacts, newest first. Check their actual producing run against this repository's exact deployment workflow, main branch, and push/manual event. An artifact is eligible even if a later production smoke check failed, because the artifact upload happens after deployment succeeds.
3. Verify the build identity, filename restrictions, regular file types, byte/count limits, and every checksum. Reject conflicting bytes under an existing hashed filename. Merge validated asset files into the current build.
4. Deploy using the current Worker and configuration, then upload the fresh generation captured in step 1. Never snapshot the merged directory: doing so would accumulate old assets indefinitely.
5. Run the existing health, protected budget, capability, and analytics checks; also verify the exact app build on both public domains.

No prior HTML, Worker, configuration, app-version document, instruction archive, OCR files, or other mutable public files are restored. Admin authorization and security headers continue to come from the current Worker.

Artifacts expire after 90 days. Discovery scans at most 300 repository artifact records; expired generations are reported and skipped. The first deployment starts without historical artifacts, so it cannot rescue tabs opened before retention was introduced. A deployment that succeeds but whose artifact upload fails also leaves a retention gap; the workflow fails visibly. API failures and corrupt or conflicting eligible artifacts stop the next release before deployment rather than silently dropping validation.

The local tests cover archive validation, provenance, bounded retention, collision refusal, and preserving the fresh-only snapshot. The separate `npm run test:recovery` browser suite exercises built release changes. These local checks do not establish that a production release or artifact round trip has occurred.
