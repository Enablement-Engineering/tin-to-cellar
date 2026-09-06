# Generated-artwork proof service

## What was tested

ChatGPT GPT-5.6 Sol Medium (Work) in https://chatgpt.com/c/6a9c92b0-c858-83ea-8511-28865fc50b0a used its network-capable execution environment to upload actual generated PNG bytes, receive a response, save it, and visually inspect an annotated proof. This demonstrates the capability in that environment, not in every ChatGPT model or tool configuration.

1. A temporary Worker accepted raw image/png and returned size, dimensions and SHA-256 without storing uploads. ChatGPT received HTTP 200 for GET and POST. The 1,654,651-byte final PNG matched local and returned hash `b61894d97e317236cea5047b137bac0d54f49222e3c4da6e4c7652511d092ece`.
2. The temporary Worker was changed to return the actual proof PNG. ChatGPT uploaded the initial 1254px render, received HTTP 200 / image/png, saved and opened the pixels, and identified the unsafe writing-panel ends, illustration, portrait and decorative border.
3. Its reported response was 2,285,227 bytes with hash `53d7aca4886d62900546affd50f69e74f594b58bd033809983bd8b30c07f2c4b`. An independent request from the repository returned the identical proof hash.

The web-page opener initially rejected the unknown trial domain; curl from the chat's execution environment worked. The prompt therefore specifies a network-capable execution tool and a local fallback.

## Implementation

- GET `/api/proof` describes the contract and legend.
- POST `/api/proof?diameter=2.5&bleed=0.125&safe=0.125` accepts raw PNG bytes. Hosted rendering supports only this Avery 94502 geometry; other dimensions return an explicit error and use local guides. Geometry is independent of printer sheet layout.
- Returns a separate PNG at the same dimensions: cyan trim circle, dashed magenta safe circle, light shading outside trim. It adds guides, not content validation or artwork corrections.
- Only square non-interlaced 8-bit RGB/RGBA PNGs, 128–2048px and <=8 MiB. Large artwork needs a separate reduced review copy, retaining its full bleed canvas and clean original.
- Production checks PNG header, encoding and dimensions in JavaScript, then delegates decoding, overlay scaling, compositing and encoding to the native Cloudflare Images binding. The bounded JavaScript renderer remains available in the source for local use and tests, but is not used by the production endpoint.
- No source URL fetching, permanent storage, imported ZIP uploads, or automatic provenance requests. Responses use no-store. No application request logging.
- A Cloudflare rate-limit binding allows 10 POSTs per 60 seconds per connecting IP at the edge. Missing limiter fails closed. This is an abuse control, not a global billing cap.
- The app's complete prompt and published reusable instructions invoke the service after generation and correction. The prompt preserves clean originals and excludes proofs from generation references and final ZIPs. Unsupported environments make local guides instead.
- How it works explains this explicit generated-image transfer. Importing a ZIP remains local-only.

## Validation and deployment

104 tests passed, including local geometry/pixel output, original-byte preservation, malformed and oversized inputs, native-renderer wiring, protocol consistency, and limiter rejection. An additional bundled-overlay geometry test also passed (105 total). App TypeScript/build and lint passed. Worker also passed:

`npx tsc --ignoreConfig --noEmit --target es2023 --module esnext --moduleResolution bundler --lib ES2023,DOM --skipLibCheck worker/index.ts worker/assets.d.ts`

The first production version `d9dd48cd-b85a-4a95-81c4-2632715a5f0b` exposed a real failure: the local control returned 200 but ChatGPT received two 503 responses with Cloudflare error 1102. The Free-plan CPU budget made full JavaScript image processing unreliable. A trial deployment with a higher CPU limit was rejected with code 100328: CPU limits are not supported for the Free plan. No account plan upgrade was made.

The fix uses the native Cloudflare Images binding and a precomputed transparent guide PNG. Regenerate that asset with `npm run proof:overlay`. Native image processing is subject to Cloudflare Images usage/limits; there is no AI inference binding. The free-plan Worker now only validates bounded upload headers and forwards bytes to native compositing.

Deployed the corrected existing working tree (no commit/push) as Cloudflare version `3753335d-3def-4632-8135-2e163ebb21ab` to tintocellar.com, www.tintocellar.com and the Workers domain. Production control returned HTTP 200 / image/png, 1254 square, trim radius 570px and safe radius 513px. The deployed reusable prompt hash matched the local file.

Local ignored evidence: `output/experiments/proof-service/` contains the control and production proof PNGs, response headers and downloaded deployed prompt. The temporary trial Worker is removed after production verification.

## Final production verification

After the native compositor deployment, ChatGPT performed GET and two sequential POSTs to tintocellar.com. All returned HTTP 200. Both POSTs returned image/png, 1,509,011 bytes, 1254×1254, trim radius 570 and safe radius 513. Both hashes were `40818b6b3a2b438a61975c9471bdd0a56c042fb4379f12c1899d95de38b18468`, matching the independent production control.

ChatGPT saved and opened the actual proof. It identified the maker/portrait, smoker, blend name and complete writing panel inside the safe circle, with no essential content crossing trim and only sunburst background in bleed. The clean artwork hash remained unchanged. The original regenerated portrait's identity fidelity is still a separate visual concern; the service does not resolve that automatically.

The final full suite passed all 105 tests. The revised app prompt includes the production endpoint and local fallback; this run tested endpoint use in an existing generation chat, not a new full generation starting with the updated app prompt. No new generation or ZIP was requested during the service experiment.
