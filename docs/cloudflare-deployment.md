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

`GET /api/proof` returns the [live input contract](https://tintocellar.com/api/proof). `POST /api/proof` requires the private allowance from **Enable hosted image checks**, accepts raw PNG bytes, and returns a separate review PNG. Supply the allowance through an authorization header, never a URL. The following assumes `PROOF_ACCESS_TOKEN` is already set privately:

```sh
curl --fail-with-body \
  -H 'Content-Type: image/png' \
  -H "Authorization: Bearer $PROOF_ACCESS_TOKEN" \
  --data-binary @label.png \
  'https://tintocellar.com/api/proof?diameter=2.5&bleed=0.125&safe=0.125' \
  --output label-review-proof.png
```

Only Avery 94502 geometry is supported: 2.5-inch diameter with 0.125-inch bleed and safe inset. Input must be a square, non-interlaced, non-animated, 8-bit RGB/RGBA PNG, 128–2048 pixels and at most 8 MiB. Send uncompressed `image/png`, not JSON or multipart. Upload reading times out after ten seconds.

The edge limiter allows ten requests per minute per client IP. A single `PROOF_BUDGET` Durable Object additionally reserves processing attempts across all locations: 30 per minute, 200 per UTC day, and 1,000 per UTC calendar month. Reservations happen before Images processing; rendering failures are not refunded. It stores aggregate counters and hashes of limited-use credentials with expiry and remaining uses, never uploads, raw credentials, or IP addresses. Expired hashes are pruned when issuing access. Missing or unavailable limiters block processing. Keep the named object and migration history stable across releases so counters survive deployment.

Set `PROOFS_ENABLED` to `"false"` and redeploy to pause hosted processing while preserving the website and local guides. Worker subdomain and version preview URLs are disabled in configuration. These controls bound admitted image attempts, not the entire account bill: Worker requests, Durable Object operations, and unrelated services can still incur usage. An attacker can exhaust the shared allowance and deny hosted proofs to legitimate users. Review account usage and billing separately.

Turnstile loads only when the user enables hosted checks. The Worker verifies the challenge server-side, including the exact allowed origin/hostname and `proof-access` action. Verification issues an opaque credential valid for 24 hours and up to 60 checks, subject to shared limits. Both copy routes include it; the reusable instruction download does not. No credential is saved in browser storage. Expired or exhausted credentials return 401 and the AI uses local guides. Already copied credentials remain usable until expiry/exhaustion even after the user switches back to local guides.

Access issuance has a separate three-per-minute edge limit and shared caps of five per minute, twenty per UTC day, and two hundred per UTC month. Raw Turnstile tokens are single-use and are never handed to the AI. Create a Managed widget restricted to your production domain, set its public `TURNSTILE_SITE_KEY` in Wrangler, and store `TURNSTILE_SECRET_KEY` through `npm exec -- wrangler secret put TURNSTILE_SECRET_KEY`. Configure `ACCESS_RATE_LIMITER` and `PROOF_BUDGET` alongside the existing bindings. Forks must also change the server's allowed hosts. Never deploy Cloudflare test keys to production.

## Keeping hosting within free allowances

Keep Workers Free and Images Free; no paid upgrade is required. Static assets do not invoke this Worker, and import, OCR and printing run locally. No AI, R2, scheduled jobs, or upload storage are bound to this application. The 1,000-attempt monthly cap leaves room below Images' 5,000 free unique transformations, including the overlay operation; it is not a measurement of account-wide transformation usage. Other projects share account allowances. Images Free rejects new transformations beyond its quota without overage charges. Workers Free has a daily request cap and fixed CPU limit; do not configure a custom CPU limit, which requires Workers Paid. See [Images pricing](https://developers.cloudflare.com/images/pricing/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), and [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Prefer local guides when capacity runs out. Do not automatically upgrade or retry paid processing. The shared cap limits Images work, while free-plan platform limits remain the final protection for Worker and Durable Object traffic. A sufficiently large attack can still exhaust shared account quotas and interrupt other Workers. Review billing and quota usage before changing plans or adding paid bindings.

Cyan marks trim, dashed magenta marks safe, and shading marks bleed. The service stores no uploads and does not change the original file. It does not judge names, packaging resemblance, or writing-space usefulness. Open the proof beside the source reference; never use it as printable artwork or include it in a CellarPack.

Missing, unknown, expired, or exhausted proof access returns 401. Invalid PNG/geometry returns 400, unsupported content type/encoding 415, oversized input 413, stalled upload 408, rate limiting 429 with `Retry-After`, and paused processing or missing required bindings 503. Use local guides for unsupported geometry or an unavailable endpoint.

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
