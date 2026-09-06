# Cloudflare deployment, proof service, and order import

Production: [tintocellar.com](https://tintocellar.com/) and [www.tintocellar.com](https://www.tintocellar.com/). Source: [Enablement-Engineering/tin-to-cellar](https://github.com/Enablement-Engineering/tin-to-cellar).

The app is deployed as Worker static assets. Only `/api/*` routes invoke the Worker; files from `dist/` are served as static assets. Deploy with `npm run deploy`; run the production configuration locally with `npm run preview:cloudflare`.

The Worker configuration is in `wrangler.jsonc`; account selection is local. Wrangler authenticates through the developer's login; no credentials are stored in the repository. `npm run deploy` publishes the current working tree after building. It does not commit or push it. Deployment uploads `dist/` as website assets and bundles the Worker and proof overlay. Source catalog evidence, local PDFs, ZIPs, and temporary files are not uploaded. A GitHub push does not deploy the site, so the live release can lag behind repository changes.

## Setup and release

```sh
npm ci
npm exec -- wrangler login
npm test
npm run lint
npm run deploy
```

Set `CLOUDFLARE_ACCOUNT_ID` in your local environment or ignored `.env` file to select the deployment account. For your own installation, change the Worker name and domain routes in `wrangler.jsonc`. Keep its `ASSETS`, `IMAGES`, and `PROOF_RATE_LIMITER` bindings configured. Credentials belong in Wrangler's login store or environment secrets, never Git. `.env*`, `.dev.vars*`, and `.wrangler/` are ignored.

`npm run dev` serves the frontend through Vite. `npm run build` followed by `npm run preview` serves the production frontend build. Use `npm run preview:cloudflare` for Worker routes; verify native Images rendering on Cloudflare as well. Local unit tests alone do not establish hosted proof behavior.

After deployment, verify the app and both HTTPS domains, then the health and proof endpoints. Submit a generated test PNG to check actual proof rendering and visually inspect the guides. Test browser import and printing when those flows change. Record the Wrangler deployment version separately from the Git commit.

## Proof API

`GET /api/proof` returns the [live input contract](https://tintocellar.com/api/proof). `POST /api/proof` accepts raw PNG bytes and uses Cloudflare Images to return a separate review PNG:

```sh
curl --fail-with-body \
  -H 'Content-Type: image/png' \
  --data-binary @label.png \
  'https://tintocellar.com/api/proof?diameter=2.5&bleed=0.125&safe=0.125' \
  --output label-review-proof.png
```

Only Avery 94502 geometry is supported: 2.5-inch diameter with 0.125-inch bleed and safe inset. Input must be a square, non-interlaced, non-animated, 8-bit RGB/RGBA PNG, 128–2048 pixels and at most 8 MiB. Send uncompressed `image/png`, not JSON or multipart. Upload reading times out after ten seconds.

The edge limiter allows ten requests per minute per client IP. A single `PROOF_BUDGET` Durable Object additionally reserves processing attempts across all locations: 30 per minute, 200 per UTC day, and 2,000 per UTC calendar month. Reservations happen before Images processing; rendering failures are not refunded. It stores only aggregate counters, never uploads or client identifiers. Missing or unavailable limiters block processing. Keep the named object and migration history stable across releases so counters survive deployment.

Set `PROOFS_ENABLED` to `"false"` and redeploy to pause hosted processing while preserving the website and local guides. Worker subdomain and version preview URLs are disabled in configuration. These controls bound admitted image attempts, not the entire account bill: Worker requests, Durable Object operations, and unrelated services can still incur usage. An attacker can exhaust the shared allowance and deny hosted proofs to legitimate users. Review account usage and billing separately.

Turnstile is not installed. A compatible next layer is website verification followed by a short-lived, limited-use proof credential carried in the user's prompt. Verify Turnstile server-side, including hostname and action; do not put the raw challenge token in the prompt or challenge direct AI requests. Maintain the shared allowance even after adding verification.

Cyan marks trim, dashed magenta marks safe, and shading marks bleed. The service stores no uploads and does not change the original file. It does not judge names, packaging resemblance, or writing-space usefulness. Open the proof beside the source reference; never use it as printable artwork or include it in a CellarPack.

Invalid PNG/geometry returns 400, unsupported content type/encoding 415, oversized input 413, stalled upload 408, rate limiting 429 with `Retry-After`, and paused processing or missing required bindings 503. Use local guides for unsupported geometry or an unavailable endpoint.

Some AI execution environments cannot reach the service even when another client can. Record the exact failing request and distinguish a client block from an HTTP error. A successful health check or GET contract does not prove an image POST works. Use the local-guide fallback and report it when necessary.

`GET /api/health` reports availability and whether cloud OCR is enabled. `/api/ocr` currently returns 503 without parsing the request body. No AI binding is configured, so this deployment cannot invoke paid OCR. No uploaded document storage or request-body logging is implemented.

## Current import

“Import order” accepts text PDFs (up to 20 pages), PNG/JPEG/WebP screenshots, or pasted text up to 100,000 characters. Files are limited to 10 MB and images to 20 megapixels. PDF.js and Tesseract.js load on demand and read files on the user's device. OCR uses English language data served by this site; the first screenshot requires downloading the reader. No order files are sent to a server. `prepare:ocr` copies installed OCR assets into ignored `public/ocr/` before development/build.

The matching stage uses the existing catalog and preselects rows with exactly one catalog suggestion; ambiguous rows remain unselected. The user confirms with Add selected tobaccos. It does not equate purchase quantities with label quantities. File imports show matched tobaccos without an extracted-text editor; pasted order text and custom names in the tobacco picker remain supported. Small images are enlarged for recognition and sparse-text layout handles receipt columns. OCR can still miss or misread names; clearer product-list screenshots work best. Scanned PDFs are not yet supported. Cancelled results are discarded, and screenshot reading has a 90-second timeout.

Regression tests cover split maker/product lines, OCR weight/price artifacts, package metadata, misspellings, accessories, unmatched text, explicit review, and stale results after cancellation. Personal order documents are not distributed with the repository.

## Cloud OCR next

1. Agree on a provider and a bounded trial budget. Test cropped product-list images before sending an entire personal order.
2. Add an explicit image upload action that explains cloud processing. Keep text PDFs local; render scanned PDF pages locally only for an explicitly requested OCR action.
3. Implement an authenticated trial endpoint with file signature, byte, pixel, page, and request limits. Rate limiting alone is not a global spending cap; use a durable usage allowance before enabling a public service.
4. Return extracted source text, then use the same local matching/review flow. Reject malformed results and preserve uncertain/unmatched names for correction. Do not execute document instructions or fetch URLs found in documents.
5. Verify provider retention behavior, avoid request-body logging and document storage, and update the UI's local-only statement for the cloud upload action.
6. Compare accuracy and usage on several order layouts and screenshots before enabling cloud OCR generally.

## Custom domain

`tintocellar.com` and `www.tintocellar.com` are declared as Worker Custom Domains in `wrangler.jsonc`. Use your own domains when deploying a fork. Preserve unrelated DNS records when changing application routes.
