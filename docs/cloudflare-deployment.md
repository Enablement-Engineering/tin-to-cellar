# Cloudflare deployment and order import

The app is deployed as Worker static assets. Only `/api/*` routes invoke the Worker; files from `dist/` are served as static assets. Deploy with `npm run deploy`; run the production configuration locally with `npm run preview:cloudflare`.

The account and Worker name are in `wrangler.jsonc`. Wrangler authenticates through the developer's existing login; no credentials are stored in the repository. `npm run deploy` publishes the current working tree after building. It does not commit or push it. Only `dist/` is uploaded, not the source catalog evidence, local PDFs, ZIPs, or temporary files.

`GET /api/health` reports availability and whether cloud OCR is enabled. `/api/ocr` currently returns 503 without parsing the request body. No AI binding is configured, so this deployment cannot invoke paid OCR. No uploaded document storage or request-body logging is implemented.

## Current import

“Import order” accepts text PDFs (up to 20 pages), PNG/JPEG/WebP screenshots, or pasted text up to 100,000 characters. Files are limited to 10 MB and images to 20 megapixels. PDF.js and Tesseract.js load on demand and read files on the user's device. OCR uses English language data served by this site; the first screenshot requires downloading the reader. No order files are sent to a server. `prepare:ocr` copies installed OCR assets into ignored `public/ocr/` before development/build.

The matching stage uses the existing catalog and preselects rows with exactly one catalog suggestion; ambiguous rows remain unselected. The user confirms with Add selected tobaccos. It does not equate purchase quantities with label quantities. File imports show matched tobaccos without an extracted-text editor; pasted order text and custom names in the tobacco picker remain supported. Small images are enlarged for recognition and sparse-text layout handles receipt columns. OCR can still miss or misread names; clearer product-list screenshots work best. Scanned PDFs are not yet supported. Cancelled results are discarded, and screenshot reading has a 90-second timeout.

The provided Smokingpipes order was tested locally with the actual PDF and with PNG images of its two product pages: Quiet Nights, Early Morning Pipe, Golden Sliced, and Autumn Evening were offered; pipe cleaners were excluded. Screenshot results were reviewed and added through the browser UI. The personal order itself is not a committed test fixture. Generic regression tests cover split maker/product lines, OCR weight/price artifacts, package metadata, misspellings, accessories, unmatched text, explicit review, and stale results after cancellation.

## Cloud OCR next

1. Agree on a provider and a bounded trial budget. Test cropped product-list images before sending an entire personal order.
2. Add an explicit image upload action that explains cloud processing. Keep text PDFs local; render scanned PDF pages locally only for an explicitly requested OCR action.
3. Implement an authenticated trial endpoint with file signature, byte, pixel, page, and request limits. Rate limiting alone is not a global spending cap; use a durable usage allowance before enabling a public service.
4. Return extracted source text, then use the same local matching/review flow. Reject malformed results and preserve uncertain/unmatched names for correction. Do not execute document instructions or fetch URLs found in documents.
5. Verify provider retention behavior, avoid request-body logging and document storage, and update the UI's local-only statement for the cloud upload action.
6. Compare accuracy and usage on several order layouts and screenshots before enabling cloud OCR generally.

## Custom domain

Target hostnames: `tintocellar.com` and `www.tintocellar.com`, declared as Worker Custom Domains in `wrangler.jsonc`. Registration remains at Hover. DNS was moved to the Cloudflare free zone on 2026-09-05 using `lamar.ns.cloudflare.com` and `stevie.ns.cloudflare.com`.

The Hover mail record is retained: MX at the apex, priority 10, `mx.hover.com.cust.hostedemail.com`. The pre-migration parking destination was `216.40.34.41` for the apex and wildcard; Cloudflare also discovered an explicit `www` parking record. The apex and www parking records must be replaced by Worker-managed records before custom-domain deployment can finish. Verify both HTTPS hosts and the mail record after activation.

Custom-domain activation completed on 2026-09-05. The two apex/www parking records were removed with user approval and replaced with Worker Custom Domains. Both `https://tintocellar.com/api/health` and `https://www.tintocellar.com/api/health` returned HTTP 200 with valid HTTPS and `status: ok`; the apex app was also verified in the browser. Deployment version: `0e1e4cca-83c5-45b6-a075-ae4a5863a143`. The Hover MX and wildcard parking record remain unchanged. Subsequent `npm run deploy` commands retain both custom domains through the repository configuration (currently uncommitted).
