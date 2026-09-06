# Cloudflare deployment and order import

Production: [tintocellar.com](https://tintocellar.com/) and [www.tintocellar.com](https://www.tintocellar.com/). Source: [Enablement-Engineering/tin-to-cellar](https://github.com/Enablement-Engineering/tin-to-cellar).

The app is deployed as Worker static assets. Only `/api/*` routes invoke the Worker; files from `dist/` are served as static assets. Deploy with `npm run deploy`; run the production configuration locally with `npm run preview:cloudflare`.

The Worker configuration is in `wrangler.jsonc`. Manual deployments authenticate through the developer's Wrangler login; GitHub Actions uses a dedicated deployment secret and account variable. No credentials are stored in source files. Once the deployment secret is configured, pushes to `main` deploy after tests, lint, and build pass; see [Deployment from GitHub](ci-deployment.md). `npm run deploy` publishes the current working tree after building. It does not commit or push it. Deployment uploads `dist/` as website assets and bundles the Worker. Source catalog evidence, local PDFs, ZIPs, and temporary files are not uploaded.

## Setup and release

```sh
npm ci
npm exec -- wrangler login
npm test
npm run lint
npm run deploy
```

Set `CLOUDFLARE_ACCOUNT_ID` in your local environment or ignored `.env` file to select the deployment account. For your own installation, change the Worker name and domain routes in `wrangler.jsonc`. Keep its `ASSETS`, `CATALOG_CONTRIBUTIONS`, and `CONTRIBUTION_RATE_LIMITER` bindings configured. Credentials belong in Wrangler's login store or environment secrets, never Git. `.env*`, `.dev.vars*`, and `.wrangler/` are ignored.

`npm run dev` builds the frontend and runs it with the Worker locally through Wrangler. `npm run build` followed by `npm run preview` also serves the built frontend and Worker together. Rebuild after frontend edits; Wrangler watches Worker source changes. `npm run dev:frontend` and `npm run preview:frontend` explicitly run only Vite, without API routes. Use them for isolated presentation work, not backend verification.

The full local server routes `/api/*` through `worker/index.ts`, so an API request cannot fall through to the frontend HTML page. After deployment, verify both HTTPS domains, `/api/health`, and the complete hosted protocol. Check that retired proof and access endpoints return 404. Test browser import and printing when those flows change. Record the deployment version separately from the Git commit.

## Local review guides

The hosted protocol includes a versioned Python/Pillow program for the AI to execute inside its chat environment. It produces a separate review image with trim, safe-area, and bleed guides while preserving the printable original. The AI must open that image and compare it with the source package, including the entire blank writing surface. Guides do not certify artwork fidelity, and annotated proofs must stay out of the final ZIP.

Hosted proof processing and access issuance have been retired. There are no Images, Turnstile, proof-rate-limit, or proof-budget bindings. The Wrangler migration history retains the creation of `ProofBudget` and adds its deletion; do not rewrite previously deployed migrations. This retires only proof usage counters and expiring credential hashes, not catalog contributions. Historical protocol snapshots remain unchanged for evidence; use the current revision for new runs.

No artwork upload, token, or network request is needed to generate these guides. Cloudflare serves static files and protocol/source APIs; import, OCR, and printing run locally. `/api/health` reports availability and that cloud OCR is disabled. `/api/labels/ocr` returns 503 without parsing request bodies. No AI inference or uploaded-document storage is configured.

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
