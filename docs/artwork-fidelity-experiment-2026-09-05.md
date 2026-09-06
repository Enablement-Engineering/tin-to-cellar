# Packaging fidelity experiment — September 5, 2026

## Acceptance criterion

The user's target is essentially the original packaging perfectly reformatted to the specified label geometry. A recognizable theme, matching colors, valid ZIP, or attractive new design is insufficient.

## Controlled source and geometry

- Product: Orlik Golden Sliced 100g, Smokingpipes product 2823 / SKU 003-046-0001.
- Product page: https://www.smokingpipes.com/pipe-tobacco/orlik/golden-sliced-100g/product_id/2823
- Exact main image: https://c647068.ssl.cf2.rackcdn.com/products/003-046-0001.jpg
- Source exported from the rendered browser page: `output/experiments/orlik-fidelity/reference.jpg`, 450 × 446 pixels.
- Output: 2.5-inch circle, 0.125-inch bleed and circular safe inset, one small blank light writing surface with no words or line. At least 1024-square PNG. No ZIP requested for this isolated artwork experiment.

The source is a round red lid, not a rectangular tin: white-wigged judge portrait above, paired gold circular borders, horizontal gold stripes behind a black oval with the distinctive white Orlik script, gold italic Golden Sliced lettering below. The earlier large-batch run incorrectly called the portrait invented and removed it. That is a reference-verification failure, independent of generation quality.

## Methods

Two fresh ChatGPT Work sessions, GPT-5.6 Sol Medium, identical target and source URL:

- A: visually inspect the source, create a detailed reconstruction brief, generate with text only and no package-image input.
- B: pass the exact source JPEG as the image-edit input; stop rather than silently fall back to text if image conditioning is unavailable.

Each may make one initial render and at most one correction, retaining both. Both must compare with the original and list mismatches. Both received the same explicit source-URL clarification after the product page returned 403 to their fetch tools; no substitute variant was allowed.

## Evaluation

Check original composition, judge illustration, exact logo form, type hierarchy, stripe/border geometry, palette, invented/deleted elements, legibility, circular safe area, and blank writing surface. Record structural/geometry checks separately from artwork fidelity. Model self-assessment is not an independent pass.

## Sessions

- Method A: researched text-only generation.
- Method B: generation using the inspected original image.

Status: complete. Both methods produced an initial render and one correction. All four PNGs were exported from their rendered ChatGPT pages and independently inspected against the exact reference. Both corrected outputs are 1254 × 1254 pixels.

## Observed results

| Check | A: researched text only | B: original image input |
| --- | --- | --- |
| Recognizable package identity | Yes | Yes, noticeably closer |
| Original judge illustration preserved | No; different naturalistic figure | No; closer but redrawn face, gesture and wig |
| Logo and title letterforms preserved | No; substantially different script and title font | Closer, still approximated |
| Small emblem preserved | No; invented ornate coat of arms | Closer heraldic symbol, still regenerated |
| Original wording preserved | No; corrected image invents QUALITAS SEMPER | Main wording and top slogan closer; fine copy is reconstructed |
| Original proportions preserved | No; enlarges portrait, logo, title and crest | Improved after correction, still enlarged/rebalanced |
| Strict user acceptance | Fail | Fail; closest of the two |

The corrected B image was directly supplied the source JPEG according to the visible conversation; B's correction also received V1. A explicitly reports no reference-image paths, recent-image context, or URL in either generation call. Tool-input transport was reported by the model, not independently instrumented. Final judgments above are based on inspecting actual output pixels.

The optional geometry overlay in the comparison uses a 2.75-inch canvas, 2.5-inch trim and 0.125-inch safe inset. No manifest was requested; exact write-in geometry was not validated by the pack importer. No print-ready or pack-validation claim is made for these images.

## Artifacts and conclusion

`output/experiments/orlik-fidelity/index.html` presents the original beside both methods, with initial/corrected toggles and trim/safe guides. Source JPEG and all four unchanged generated PNGs are retained alongside it.

This single-blend test supports image conditioning over text-only reconstruction for fidelity. It does not establish universal success rates. Neither method met the user's essentially-perfect reformatting criterion. The next approach to test is preserving original image elements through cropping, masking and layout, using generation only for necessary fill areas rather than redrawing logos, portraits and lettering. A higher-resolution source would help; this retailer image cannot supply detail that it never contained.

No production prompt or website changes were made as part of this experiment.

## Method C: original-artwork assembly with bounded critique

Method C ran in a separate conversation.

Same exact source JPEG and output geometry. Explicitly allow cropping, masking, resampling and compositing. Preserve original image elements instead of regenerating them. Generative fill is permitted only for background gaps that cannot otherwise be filled. No complete redraw. At most two targeted corrections; retain versions and disclose source-resolution limitations. Status: complete; see Method C result below.

### Proposed acceptance loop

1. Inspect the exact reference and record its identifying elements before editing: portrait/illustration, logo, lettering, emblem, palette, borders and layout. Record the reference variant and actual image, not just a product name.
2. Specify permitted changes for the shape and writing surface. Distinguish low-priority copy that may move from defining elements that must remain.
3. Assemble or generate the initial artwork.
4. Compare source and output side by side. For each locked feature, name a visible match or a concrete defect. A pleasing overall theme is not a pass. Check geometry and source resolution separately.
5. Repair only failed regions, retaining successful artwork. At most two corrections; keep the best version rather than automatically choosing the newest.
6. Include only accepted labels in the final pack, disclose omissions and unresolved problems, and run the existing structural validator afterward. Structural validation is not a substitute for visual acceptance.

The critic must use the original reference on every pass. Its written feature list helps prevent drift but cannot replace looking at the source. A same-chat self-critique remains fallible; it should not be described as independent review.

### Method C result

Completed with two targeted corrections and no generative fill. The initial writing plaque overlapped the title subline; correction one touched the emblem; correction two moved/narrowed the plaque and tightened the face crop. Initial and final PNGs plus the model's comparison were exported through the browser and retained in the experiment folder.

Independent visual inspection: original logo letterforms, portrait and heraldic emblem are retained much better than in A/B. However, the tightened crop cuts away part of the gold ring on the right. This contradicts the model's broad statement that all locked features passed. The source's glare and softness also remain. Treat C as the strongest preservation method tested, not an accepted production label.

Reported geometry: writing surface 0.5482 × 0.1974 inches, approximately 14 × 5 mm, at trim-relative x=0.5482 inches and y=1.9518 inches. The model reports its full rounded boundary within the 513px safe radius, with 8.77px minimum clearance. No importer validation was run. A writing surface of this size is cramped for a handwritten date even if its geometric test passes.

The useful face crop contains 359 × 366 source pixels, about 144–146 effective PPI across 2.5 inches. The 1254px output does not recover detail. Need at least 750 source pixels across the printed face for 300 PPI, preferably more for cropping. The model itself correctly marked print quality as failed.

Conclusion: retain the bounded source-grounded critique loop, but require checks for full border continuity, useful writing space and effective source resolution, not only object preservation and safe-area containment. On a failed final pass, omit the label from the final ZIP or explicitly return it as an unaccepted proof; do not represent it as ready. The same-chat critic missed a visible crop defect, so its pass is not definitive.
